"""
Audio file upload and serving routes.

Handles audio file uploads, processing job management, and audio file serving.
"""

from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from advanced_omi_backend.auth import current_superuser, current_active_user_optional, get_user_from_token_param
from advanced_omi_backend.controllers import audio_controller
from advanced_omi_backend.models.user import User

router = APIRouter(prefix="/audio", tags=["audio"])


@router.get("/get_audio/{conversation_id}")
async def get_conversation_audio(
    conversation_id: str,
    cropped: bool = Query(default=False, description="Serve cropped (speech-only) audio instead of original"),
    token: Optional[str] = Query(default=None, description="JWT token for audio element access"),
    current_user: Optional[User] = Depends(current_active_user_optional),
):
    """
    Serve audio file for a conversation.

    This endpoint uses conversation_id for direct lookup and ownership verification,
    which is more efficient than querying by filename.

    Supports both header-based auth (Authorization: Bearer) and query param token
    for <audio> element compatibility.

    Args:
        conversation_id: The conversation ID
        cropped: If True, serve cropped audio; if False, serve original audio
        token: Optional JWT token as query param (for audio elements)
        current_user: Authenticated user (from header)

    Returns:
        FileResponse with the audio file

    Raises:
        404: If conversation or audio file not found
        403: If user doesn't own the conversation
        401: If not authenticated
    """
    # Try token param if header auth failed
    if not current_user and token:
        current_user = await get_user_from_token_param(token)

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get audio file path from controller
    try:
        file_path = await audio_controller.get_conversation_audio_path(
            conversation_id=conversation_id,
            user=current_user,
            cropped=cropped
        )
    except ValueError as e:
        # Map ValueError messages to appropriate HTTP status codes
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        elif "access denied" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        else:
            raise HTTPException(status_code=404, detail=error_msg)

    # Serve the file
    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=file_path.name
    )


@router.post("/upload")
async def upload_audio_files(
    current_user: User = Depends(current_superuser),
    files: list[UploadFile] = File(...),
    device_name: str = Query(default="upload", description="Device name for uploaded files"),
    auto_generate_client: bool = Query(default=True, description="Auto-generate client ID"),
):
    """
    Upload and process audio files. Admin only.

    Audio files are saved to disk and enqueued for processing via RQ jobs.
    This allows for scalable processing of large files without blocking the API.

    Returns:
        - List of uploaded files with their processing job IDs
        - Summary of enqueued vs failed uploads
    """
    return await audio_controller.upload_and_process_audio_files(
        current_user, files, device_name, auto_generate_client
    )
