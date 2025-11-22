"""
Conversation models for Friend-Lite backend.

This module contains Beanie Document and Pydantic models for conversations,
transcript versions, and memory versions.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, model_validator, computed_field
from enum import Enum
import uuid

from beanie import Document, Indexed


class Conversation(Document):
    """Complete conversation model with versioned processing."""

    # Nested Enums
    class TranscriptProvider(str, Enum):
        """Supported transcription providers."""
        DEEPGRAM = "deepgram"
        MISTRAL = "mistral"
        PARAKEET = "parakeet"
        SPEECH_DETECTION = "speech_detection"  # Legacy value
        UNKNOWN = "unknown"  # Fallback value

    class MemoryProvider(str, Enum):
        """Supported memory providers."""
        FRIEND_LITE = "friend_lite"
        OPENMEMORY_MCP = "openmemory_mcp"

    class ConversationStatus(str, Enum):
        """Conversation processing status."""
        ACTIVE = "active"  # Has running jobs or open websocket
        COMPLETED = "completed"  # All jobs succeeded
        FAILED = "failed"  # One or more jobs failed

    # Nested Models
    class SpeakerSegment(BaseModel):
        """Individual speaker segment in a transcript."""
        start: float = Field(description="Start time in seconds")
        end: float = Field(description="End time in seconds")
        text: str = Field(description="Transcript text for this segment")
        speaker: str = Field(description="Speaker identifier")
        confidence: Optional[float] = Field(None, description="Confidence score (0-1)")

    class TranscriptVersion(BaseModel):
        """Version of a transcript with processing metadata."""
        version_id: str = Field(description="Unique version identifier")
        transcript: Optional[str] = Field(None, description="Full transcript text")
        segments: List["Conversation.SpeakerSegment"] = Field(default_factory=list, description="Speaker segments")
        provider: Optional["Conversation.TranscriptProvider"] = Field(None, description="Transcription provider used")
        model: Optional[str] = Field(None, description="Model used (e.g., nova-3, voxtral-mini-2507)")
        created_at: datetime = Field(description="When this version was created")
        processing_time_seconds: Optional[float] = Field(None, description="Time taken to process")
        metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional provider-specific metadata")

    class MemoryVersion(BaseModel):
        """Version of memory extraction with processing metadata."""
        version_id: str = Field(description="Unique version identifier")
        memory_count: int = Field(description="Number of memories extracted")
        transcript_version_id: str = Field(description="Which transcript version was used")
        provider: "Conversation.MemoryProvider" = Field(description="Memory provider used")
        model: Optional[str] = Field(None, description="Model used (e.g., gpt-4o-mini, llama3)")
        created_at: datetime = Field(description="When this version was created")
        processing_time_seconds: Optional[float] = Field(None, description="Time taken to process")
        metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional provider-specific metadata")

    # Core identifiers
    conversation_id: Indexed(str, unique=True) = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique conversation identifier")
    audio_uuid: Indexed(str) = Field(description="Session/audio identifier (for tracking audio files)")
    user_id: Indexed(str) = Field(description="User who owns this conversation")
    client_id: Indexed(str) = Field(description="Client device identifier")

    # Audio file reference
    audio_path: Optional[str] = Field(None, description="Path to audio file (relative to CHUNK_DIR)")
    cropped_audio_path: Optional[str] = Field(None, description="Path to cropped audio file (relative to CHUNK_DIR)")

    # Creation metadata
    created_at: Indexed(datetime) = Field(default_factory=datetime.utcnow, description="When the conversation was created")

    # Processing status tracking
    deleted: bool = Field(False, description="Whether this conversation was deleted due to processing failure")
    deletion_reason: Optional[str] = Field(None, description="Reason for deletion (no_meaningful_speech, audio_file_not_ready, etc.)")
    deleted_at: Optional[datetime] = Field(None, description="When the conversation was marked as deleted")

    # Summary fields (auto-generated from transcript)
    title: Optional[str] = Field(None, description="Auto-generated conversation title")
    summary: Optional[str] = Field(None, description="Auto-generated short summary (1-2 sentences)")
    detailed_summary: Optional[str] = Field(None, description="Auto-generated detailed summary (comprehensive, corrected content)")

    # Versioned processing
    transcript_versions: List["Conversation.TranscriptVersion"] = Field(
        default_factory=list,
        description="All transcript processing attempts"
    )
    memory_versions: List["Conversation.MemoryVersion"] = Field(
        default_factory=list,
        description="All memory extraction attempts"
    )

    # Active version pointers
    active_transcript_version: Optional[str] = Field(
        None,
        description="Version ID of currently active transcript"
    )
    active_memory_version: Optional[str] = Field(
        None,
        description="Version ID of currently active memory extraction"
    )

    # Legacy fields removed - use transcript_versions[active_transcript_version] and memory_versions[active_memory_version]
    # Frontend should access: conversation.active_transcript.segments, conversation.active_transcript.transcript

    @model_validator(mode='before')
    @classmethod
    def clean_legacy_data(cls, data: Any) -> Any:
        """Clean up legacy/malformed data before Pydantic validation."""

        if not isinstance(data, dict):
            return data

        # Fix malformed transcript_versions (from old schema versions)
        if 'transcript_versions' in data and isinstance(data['transcript_versions'], list):
            for version in data['transcript_versions']:
                if isinstance(version, dict):
                    # If segments is not a list, clear it
                    if 'segments' in version and not isinstance(version['segments'], list):
                        version['segments'] = []
                    # If transcript is a dict, clear it
                    if 'transcript' in version and isinstance(version['transcript'], dict):
                        version['transcript'] = None
                    # Normalize provider to lowercase (legacy data had "Deepgram" instead of "deepgram")
                    if 'provider' in version and isinstance(version['provider'], str):
                        version['provider'] = version['provider'].lower()
                    # Fix speaker IDs in segments (legacy data had integers, need strings)
                    if 'segments' in version and isinstance(version['segments'], list):
                        for segment in version['segments']:
                            if isinstance(segment, dict) and 'speaker' in segment:
                                if isinstance(segment['speaker'], int):
                                    segment['speaker'] = f"Speaker {segment['speaker']}"
                                elif not isinstance(segment['speaker'], str):
                                    segment['speaker'] = "unknown"

        return data

    @computed_field
    @property
    def active_transcript(self) -> Optional["Conversation.TranscriptVersion"]:
        """Get the currently active transcript version."""
        if not self.active_transcript_version:
            return None

        for version in self.transcript_versions:
            if version.version_id == self.active_transcript_version:
                return version
        return None

    @computed_field
    @property
    def active_memory(self) -> Optional["Conversation.MemoryVersion"]:
        """Get the currently active memory version."""
        if not self.active_memory_version:
            return None

        for version in self.memory_versions:
            if version.version_id == self.active_memory_version:
                return version
        return None

    # Convenience properties that return data from active transcript version
    @computed_field
    @property
    def transcript(self) -> Optional[str]:
        """Get transcript text from active transcript version."""
        return self.active_transcript.transcript if self.active_transcript else None

    @computed_field
    @property
    def segments(self) -> List["Conversation.SpeakerSegment"]:
        """Get segments from active transcript version."""
        return self.active_transcript.segments if self.active_transcript else []

    @computed_field
    @property
    def segment_count(self) -> int:
        """Get segment count from active transcript version."""
        return len(self.segments) if self.segments else 0

    @computed_field
    @property
    def memory_count(self) -> int:
        """Get memory count from active memory version."""
        return self.active_memory.memory_count if self.active_memory else 0

    @computed_field
    @property
    def has_memory(self) -> bool:
        """Check if conversation has any memory versions."""
        return len(self.memory_versions) > 0

    @computed_field
    @property
    def transcript_version_count(self) -> int:
        """Get count of transcript versions."""
        return len(self.transcript_versions)

    @computed_field
    @property
    def memory_version_count(self) -> int:
        """Get count of memory versions."""
        return len(self.memory_versions)

    def add_transcript_version(
        self,
        version_id: str,
        transcript: str,
        segments: List["Conversation.SpeakerSegment"],
        provider: "Conversation.TranscriptProvider",
        model: Optional[str] = None,
        processing_time_seconds: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        set_as_active: bool = True
    ) -> "Conversation.TranscriptVersion":
        """Add a new transcript version and optionally set it as active."""
        new_version = Conversation.TranscriptVersion(
            version_id=version_id,
            transcript=transcript,
            segments=segments,
            provider=provider,
            model=model,
            created_at=datetime.now(),
            processing_time_seconds=processing_time_seconds,
            metadata=metadata or {}
        )

        self.transcript_versions.append(new_version)

        if set_as_active:
            self.active_transcript_version = version_id

        return new_version

    def add_memory_version(
        self,
        version_id: str,
        memory_count: int,
        transcript_version_id: str,
        provider: "Conversation.MemoryProvider",
        model: Optional[str] = None,
        processing_time_seconds: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        set_as_active: bool = True
    ) -> "Conversation.MemoryVersion":
        """Add a new memory version and optionally set it as active."""
        new_version = Conversation.MemoryVersion(
            version_id=version_id,
            memory_count=memory_count,
            transcript_version_id=transcript_version_id,
            provider=provider,
            model=model,
            created_at=datetime.now(),
            processing_time_seconds=processing_time_seconds,
            metadata=metadata or {}
        )

        self.memory_versions.append(new_version)

        if set_as_active:
            self.active_memory_version = version_id

        return new_version

    def set_active_transcript_version(self, version_id: str) -> bool:
        """Set a specific transcript version as active."""
        for version in self.transcript_versions:
            if version.version_id == version_id:
                self.active_transcript_version = version_id
                return True
        return False

    def set_active_memory_version(self, version_id: str) -> bool:
        """Set a specific memory version as active."""
        for version in self.memory_versions:
            if version.version_id == version_id:
                self.active_memory_version = version_id
                return True
        return False

    class Settings:
        name = "conversations"
        indexes = [
            "conversation_id",
            "user_id",
            "created_at",
            [("user_id", 1), ("created_at", -1)]  # Compound index for user queries
        ]


# Factory function for creating conversations
def create_conversation(
    audio_uuid: str,
    user_id: str,
    client_id: str,
    conversation_id: Optional[str] = None,
    title: Optional[str] = None,
    summary: Optional[str] = None,
    transcript: Optional[str] = None,
    segments: Optional[List["Conversation.SpeakerSegment"]] = None,
) -> Conversation:
    """
    Factory function to create a new conversation.

    Args:
        audio_uuid: Unique identifier for the audio session
        user_id: User who owns this conversation
        client_id: Client device identifier
        conversation_id: Optional unique conversation identifier (auto-generated if not provided)
        title: Optional conversation title
        summary: Optional conversation summary
        transcript: Optional transcript text
        segments: Optional speaker segments

    Returns:
        Conversation instance
    """
    # Build the conversation data
    conv_data = {
        "audio_uuid": audio_uuid,
        "user_id": user_id,
        "client_id": client_id,
        "created_at": datetime.now(),
        "title": title,
        "summary": summary,
        "transcript": transcript or "",
        "segments": segments or [],
        "transcript_versions": [],
        "active_transcript_version": None,
        "memory_versions": [],
        "active_memory_version": None,
        "memories": [],
        "memory_count": 0
    }

    # Only set conversation_id if provided, otherwise let the model auto-generate it
    if conversation_id is not None:
        conv_data["conversation_id"] = conversation_id

    return Conversation(**conv_data)