"""
MCP Server for Friend-Lite conversations.

This module implements an MCP (Model Context Protocol) server that provides
conversation access tools for LLMs to retrieve conversation data, transcripts,
and audio files.

Key features:
- List conversations with filtering and pagination
- Get detailed conversation data including transcripts and segments
- Access conversation audio files as resources
- User-scoped access with proper authentication
"""

import base64
import contextvars
import json
import logging
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, Request
from fastapi.routing import APIRouter
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport

from advanced_omi_backend.config import CHUNK_DIR
from advanced_omi_backend.models.conversation import Conversation
from advanced_omi_backend.models.user import User

logger = logging.getLogger(__name__)

# Initialize MCP
mcp = FastMCP("friend-lite-conversations")

# Context variables for user_id
user_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("user_id")

# Create a router for MCP endpoints
mcp_router = APIRouter(prefix="/mcp")

# Initialize SSE transport
sse = SseServerTransport("/mcp/messages/")


async def resolve_user_identifier(identifier: str) -> Optional[str]:
    """
    Resolve a user identifier (email or user_id) to a user_id.

    Args:
        identifier: Either an email address or a MongoDB ObjectId string

    Returns:
        User ID string if found, None otherwise
    """
    try:
        # First try to find by email (case-insensitive)
        user = await User.find_one(User.email == identifier.lower())
        if user:
            logger.info(f"Resolved email '{identifier}' to user_id: {user.id}")
            return str(user.id)

        # If not found by email, assume it's already a user_id
        # Verify it exists
        from bson import ObjectId
        try:
            user = await User.find_one(User.id == ObjectId(identifier))
            if user:
                logger.info(f"Verified user_id: {identifier}")
                return str(user.id)
        except:
            pass

        logger.warning(f"Could not resolve user identifier: {identifier}")
        return None
    except Exception as e:
        logger.error(f"Error resolving user identifier '{identifier}': {e}")
        return None


@mcp.tool(description="List all conversations. Returns conversation_id, title, summary, created_at, client_id, segment_count, memory_count, and has_audio. Supports date filtering and pagination.")
async def list_conversations(
    limit: int = 20,
    offset: int = 0,
    order_by: str = "created_at_desc",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> str:
    """
    List conversations with optional date filtering.

    Args:
        limit: Maximum number of conversations to return (default: 20, max: 100)
        offset: Number of conversations to skip for pagination (default: 0)
        order_by: Sort order - "created_at_desc" (newest first) or "created_at_asc" (oldest first)
        start_date: Optional ISO 8601 date string (e.g., "2025-01-01T00:00:00Z") - filter conversations after this date
        end_date: Optional ISO 8601 date string (e.g., "2025-12-31T23:59:59Z") - filter conversations before this date

    Returns:
        JSON string with list of conversations and pagination info
    """
    uid = user_id_var.get(None)
    if not uid:
        return json.dumps({"error": "user_id not provided"}, indent=2)

    try:
        # Validate and limit parameters
        limit = min(max(1, limit), 100)  # Clamp between 1 and 100
        offset = max(0, offset)

        # Build base query
        # If uid is "all", return all conversations (temporary for development)
        # In the future, this will filter by speaker identity
        if uid == "all":
            query = Conversation.find_all()
        else:
            query = Conversation.find(Conversation.user_id == uid)

        # Apply date filtering if provided
        from datetime import datetime

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.find(Conversation.created_at >= start_dt)
            except ValueError as e:
                logger.warning(f"Invalid start_date format: {start_date}, error: {e}")
                return json.dumps({"error": f"Invalid start_date format: {start_date}. Use ISO 8601 format."}, indent=2)

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.find(Conversation.created_at <= end_dt)
            except ValueError as e:
                logger.warning(f"Invalid end_date format: {end_date}, error: {e}")
                return json.dumps({"error": f"Invalid end_date format: {end_date}. Use ISO 8601 format."}, indent=2)

        # Get total count with same filters
        total_count = await query.count()

        # Apply sorting
        if order_by == "created_at_asc":
            query = query.sort(Conversation.created_at)
        else:  # Default to newest first
            query = query.sort(-Conversation.created_at)

        # Apply pagination
        conversations = await query.skip(offset).limit(limit).to_list()

        # Format conversations for response
        formatted_convs = []
        for conv in conversations:

            formatted_convs.append({
                "conversation_id": conv.conversation_id,
                "title": conv.title,
                "summary": conv.summary,
                "start_datetime": conv.created_at.isoformat(),
                "end_datetime": conv.completed_at.isoformat() if conv.completed_at else None,
                "segment_count": len(conv.segments),
                "memory_count": conv.memory_count,
                "client_id": conv.client_id,
            })
            

        result = {
            "conversations": formatted_convs,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "returned": len(formatted_convs),
                "has_more": (offset + len(formatted_convs)) < total_count
            }
        }

        return json.dumps(result, indent=2)

    except Exception as e:
        logger.exception(f"Error listing conversations: {e}")
        return json.dumps({"error": f"Failed to list conversations: {str(e)}"}, indent=2)


@mcp.tool(description="Get detailed information about a specific conversation including full transcript, speaker segments, memories, and version history. Use the conversation_id from list_conversations.")
async def get_conversation(conversation_id: str) -> str:
    """
    Get detailed conversation data.

    Args:
        conversation_id: The unique conversation identifier

    Returns:
        JSON string with complete conversation details
    """
    uid = user_id_var.get(None)
    if not uid:
        return json.dumps({"error": "user_id not provided"}, indent=2)

    try:
        # Find the conversation
        conversation = await Conversation.find_one(
            Conversation.conversation_id == conversation_id
        )

        if not conversation:
            return json.dumps({"error": f"Conversation '{conversation_id}' not found"}, indent=2)

        # Verify ownership (skip if uid is "all" for development)
        if uid != "all" and conversation.user_id != uid:
            return json.dumps({"error": "Access forbidden - conversation belongs to another user"}, indent=2)

        # Format conversation data with explicit fields
        conv_data = {
            # Core identifiers
            "conversation_id": conversation.conversation_id,
            "audio_uuid": conversation.audio_uuid,
            "user_id": conversation.user_id,
            "client_id": conversation.client_id,

            # Metadata
            "start_datetime": conversation.created_at.isoformat(),
            "end_datetime": conversation.completed_at.isoformat() if conversation.completed_at else None,
            "title": conversation.title,
            "summary": conversation.summary,
            # "detailed_summary": conversation.detailed_summary,

            # Transcript data
            "transcript": conversation.transcript,

            # Memory data
            "memory_count": conversation.memory_count,

            # Audio paths
            "has_audio": bool(conversation.audio_path),
            "has_cropped_audio": bool(conversation.cropped_audio_path),

            # Version information
            "active_transcript_version": conversation.active_transcript_version,
            "active_memory_version": conversation.active_memory_version,
            "transcript_versions_count": len(conversation.transcript_versions),
            "memory_versions_count": len(conversation.memory_versions)
        }

        return json.dumps(conv_data, indent=2)

    except Exception as e:
        logger.exception(f"Error getting conversation {conversation_id}: {e}")
        return json.dumps({"error": f"Failed to get conversation: {str(e)}"}, indent=2)


@mcp.tool(description="Get speaker segments from a conversation. Returns detailed timing and speaker information for each segment of the transcript.")
async def get_segments_from_conversation(conversation_id: str) -> str:
    """
    Get speaker segments from a conversation.

    Args:
        conversation_id: The unique conversation identifier

    Returns:
        JSON string with speaker segments including timing and text
    """
    uid = user_id_var.get(None)
    if not uid:
        return json.dumps({"error": "user_id not provided"}, indent=2)

    try:
        # Find the conversation
        conversation = await Conversation.find_one(
            Conversation.conversation_id == conversation_id
        )

        if not conversation:
            return json.dumps({"error": f"Conversation '{conversation_id}' not found"}, indent=2)

        # Verify ownership (skip if uid is "all" for development)
        if uid != "all" and conversation.user_id != uid:
            return json.dumps({"error": "Access forbidden - conversation belongs to another user"}, indent=2)

        # Format segments
        segments_data = {
            "conversation_id": conversation_id,
            "segment_count": len(conversation.segments),
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "duration": seg.end - seg.start,
                    "text": seg.text,
                    "speaker": seg.speaker,
                    "confidence": seg.confidence
                } for seg in conversation.segments
            ]
        }

        return json.dumps(segments_data, indent=2)

    except Exception as e:
        logger.exception(f"Error getting segments for conversation {conversation_id}: {e}")
        return json.dumps({"error": f"Failed to get segments: {str(e)}"}, indent=2)


@mcp.resource(uri="conversation://{conversation_id}/audio", name="Conversation Audio", description="Get the audio file for a conversation", mime_type="text/plain")
async def get_conversation_audio(conversation_id: str) -> str:
    """
    Get audio file for a conversation.

    Args:
        conversation_id: The unique conversation identifier

    Returns:
        JSON string with base64-encoded audio data
    """
    uid = user_id_var.get(None)
    if not uid:
        return json.dumps({"error": "user_id not provided"}, indent=2)

    try:
        # Default to regular audio (not cropped)
        audio_type = "audio"

        # Find the conversation
        conversation = await Conversation.find_one(
            Conversation.conversation_id == conversation_id
        )

        if not conversation:
            return json.dumps({"error": f"Conversation '{conversation_id}' not found"}, indent=2)

        # Verify ownership (skip if uid is "all" for development)
        if uid != "all" and conversation.user_id != uid:
            return json.dumps({"error": "Access forbidden - conversation belongs to another user"}, indent=2)

        # Get the appropriate audio path
        if audio_type == "cropped_audio":
            audio_path = conversation.cropped_audio_path
            if not audio_path:
                return json.dumps({"error": "No cropped audio available for this conversation"}, indent=2)
        else:  # Default to regular audio
            audio_path = conversation.audio_path
            if not audio_path:
                return json.dumps({"error": "No audio file available for this conversation"}, indent=2)

        # Resolve full path
        full_path = CHUNK_DIR / audio_path

        if not full_path.exists():
            return json.dumps({"error": f"Audio file not found at path: {audio_path}"}, indent=2)

        # Read and encode audio file
        with open(full_path, "rb") as f:
            audio_data = f.read()

        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        result = {
            "conversation_id": conversation_id,
            "audio_type": audio_type,
            "file_path": str(audio_path),
            "file_size_bytes": len(audio_data),
            "mime_type": "audio/wav",  # Friend-Lite stores audio as WAV
            "audio_base64": audio_base64
        }

        return json.dumps(result, indent=2)

    except Exception as e:
        logger.exception(f"Error getting audio for conversation {conversation_id}: {e}")
        return json.dumps({"error": f"Failed to get audio: {str(e)}"}, indent=2)


@mcp.resource(uri="conversation://{conversation_id}/cropped_audio", name="Conversation Cropped Audio", description="Get the cropped (speech-only) audio file for a conversation", mime_type="text/plain")
async def get_conversation_cropped_audio(conversation_id: str) -> str:
    """
    Get cropped audio file for a conversation.

    Args:
        conversation_id: The unique conversation identifier

    Returns:
        JSON string with base64-encoded cropped audio data
    """
    uid = user_id_var.get(None)
    if not uid:
        return json.dumps({"error": "user_id not provided"}, indent=2)

    try:
        # Find the conversation
        conversation = await Conversation.find_one(
            Conversation.conversation_id == conversation_id
        )

        if not conversation:
            return json.dumps({"error": f"Conversation '{conversation_id}' not found"}, indent=2)

        # Verify ownership (skip if uid is "all" for development)
        if uid != "all" and conversation.user_id != uid:
            return json.dumps({"error": "Access forbidden - conversation belongs to another user"}, indent=2)

        # Get cropped audio path
        audio_path = conversation.cropped_audio_path
        if not audio_path:
            return json.dumps({"error": "No cropped audio available for this conversation"}, indent=2)

        # Resolve full path
        full_path = CHUNK_DIR / audio_path

        if not full_path.exists():
            return json.dumps({"error": f"Audio file not found at path: {audio_path}"}, indent=2)

        # Read and encode audio file
        with open(full_path, "rb") as f:
            audio_data = f.read()

        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        result = {
            "conversation_id": conversation_id,
            "audio_type": "cropped_audio",
            "file_path": str(audio_path),
            "file_size_bytes": len(audio_data),
            "mime_type": "audio/wav",
            "audio_base64": audio_base64
        }

        return json.dumps(result, indent=2)

    except Exception as e:
        logger.exception(f"Error getting cropped audio for conversation {conversation_id}: {e}")
        return json.dumps({"error": f"Failed to get cropped audio: {str(e)}"}, indent=2)


@mcp_router.get("/conversations/sse")
async def handle_sse(request: Request):
    """
    Handle SSE connections with Bearer token authentication.

    The access token should be provided in the Authorization header:
        Authorization: Bearer <token>

    Note: For development, this bypasses user authentication and returns all conversations.
          In the future, this will validate speaker identity from conversations.
    """
    from fastapi.responses import JSONResponse

    # Extract access token from Authorization header
    auth_header = request.headers.get("authorization")
    if not auth_header:
        logger.error("No Authorization header provided")
        return JSONResponse(
            status_code=401,
            content={"error": "Authorization header required. Use: Authorization: Bearer <token>"}
        )

    # Parse Bearer token
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        logger.error(f"Invalid Authorization header format: {auth_header}")
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid Authorization header. Use format: Authorization: Bearer <token>"}
        )

    access_token = parts[1]
    if not access_token:
        logger.error("Empty access token")
        return JSONResponse(
            status_code=401,
            content={"error": "Access token cannot be empty"}
        )

    # For now, use "all" as the user_id to bypass filtering
    # This will be replaced with speaker-based permissions later
    logger.info(f"MCP connection established with access token: {access_token[:min(8, len(access_token))]}...")
    user_token = user_id_var.set("all")

    try:
        # Handle SSE connection
        async with sse.connect_sse(
            request.scope,
            request.receive,
            request._send,
        ) as (read_stream, write_stream):
            await mcp._mcp_server.run(
                read_stream,
                write_stream,
                mcp._mcp_server.create_initialization_options(),
            )
    finally:
        # Clean up context variables
        user_id_var.reset(user_token)


@mcp_router.post("/messages/")
async def handle_get_message(request: Request):
    return await handle_post_message(request)


@mcp_router.post("/conversations/sse/{user_id}/messages/")
async def handle_post_message_with_user(request: Request):
    return await handle_post_message(request)


async def handle_post_message(request: Request):
    """Handle POST messages for SSE"""
    try:
        body = await request.body()

        # Create a simple receive function that returns the body
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        # Create a simple send function that does nothing
        async def send(message):
            return {}

        # Call handle_post_message with the correct arguments
        await sse.handle_post_message(request.scope, receive, send)

        # Return a success response
        return {"status": "ok"}
    finally:
        pass


def setup_mcp_server(app: FastAPI):
    """Setup MCP server with the FastAPI application"""
    mcp._mcp_server.name = "friend-lite-conversations"

    # Include MCP router in the FastAPI app
    app.include_router(mcp_router)

    logger.info("Friend-Lite MCP server initialized with conversation tools")
