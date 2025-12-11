"""
Pydantic models for dynamic application settings.

These settings can be changed by users through the UI and take effect
without requiring a server restart (within the cache TTL).
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, validator


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    OLLAMA = "ollama"


class MemoryProvider(str, Enum):
    """Supported memory providers."""
    CHRONICLE = "chronicle"
    OPENMEMORY_MCP = "openmemory_mcp"
    MYCELIA = "mycelia"


class TranscriptionProvider(str, Enum):
    """Supported transcription providers."""
    DEEPGRAM = "deepgram"
    MISTRAL = "mistral"
    PARAKEET = "parakeet"
    AUTO = "auto"


class DiarizationSource(str, Enum):
    """Supported diarization sources."""
    PYANNOTE = "pyannote"
    DEEPGRAM = "deepgram"


class SpeechDetectionSettings(BaseModel):
    """Speech detection settings for conversation creation."""

    min_words: int = Field(
        default=5,
        ge=1,
        le=100,
        description="Minimum words required to create a conversation"
    )
    min_confidence: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum word confidence threshold (0.0-1.0)"
    )
    min_duration: float = Field(
        default=10.0,
        ge=0.0,
        description="Minimum speech duration in seconds"
    )


class ConversationSettings(BaseModel):
    """Conversation management settings."""

    transcription_buffer_seconds: float = Field(
        default=120.0,
        ge=10.0,
        le=600.0,
        description="Trigger transcription every N seconds"
    )
    speech_inactivity_threshold: float = Field(
        default=60.0,
        ge=10.0,
        le=600.0,
        description="Close conversation after N seconds of no speech"
    )
    new_conversation_timeout_minutes: float = Field(
        default=1.5,
        ge=0.1,
        le=60.0,
        description="Timeout for creating new conversations (minutes)"
    )
    record_only_enrolled_speakers: bool = Field(
        default=True,
        description="Only create conversations when enrolled speakers are detected"
    )


class AudioProcessingSettings(BaseModel):
    """Audio processing settings."""

    audio_cropping_enabled: bool = Field(
        default=True,
        description="Enable automatic silence removal from audio"
    )
    min_speech_segment_duration: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Minimum speech segment duration in seconds"
    )
    cropping_context_padding: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Context padding around speech segments"
    )


class DiarizationSettings(BaseModel):
    """Speaker diarization settings."""

    diarization_source: DiarizationSource = Field(
        default=DiarizationSource.PYANNOTE,
        description="Diarization service to use"
    )
    similarity_threshold: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        description="Speaker similarity threshold"
    )
    min_duration: float = Field(
        default=0.5,
        ge=0.0,
        description="Minimum segment duration"
    )
    collar: float = Field(
        default=2.0,
        ge=0.0,
        description="Collar for segment merging (seconds)"
    )
    min_duration_off: float = Field(
        default=1.5,
        ge=0.0,
        description="Minimum silence duration between segments"
    )
    min_speakers: int = Field(
        default=2,
        ge=1,
        le=10,
        description="Minimum number of speakers"
    )
    max_speakers: int = Field(
        default=6,
        ge=1,
        le=20,
        description="Maximum number of speakers"
    )

    @validator('max_speakers')
    def validate_max_speakers(cls, v, values):
        """Ensure max_speakers >= min_speakers."""
        if 'min_speakers' in values and v < values['min_speakers']:
            raise ValueError('max_speakers must be >= min_speakers')
        return v


class LLMSettings(BaseModel):
    """LLM provider and model settings."""

    llm_provider: LLMProvider = Field(
        default=LLMProvider.OPENAI,
        description="LLM provider to use"
    )
    openai_model: str = Field(
        default="gpt-4o-mini",
        description="OpenAI model for general tasks"
    )
    chat_llm_model: Optional[str] = Field(
        default=None,
        description="Model for chat (defaults to openai_model if not set)"
    )
    chat_temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Temperature for chat responses"
    )
    ollama_model: Optional[str] = Field(
        default="llama3.1:latest",
        description="Ollama model name"
    )
    ollama_embedder_model: Optional[str] = Field(
        default="nomic-embed-text:latest",
        description="Ollama embedder model name"
    )


class ProviderSettings(BaseModel):
    """Service provider selection settings."""

    memory_provider: MemoryProvider = Field(
        default=MemoryProvider.CHRONICLE,
        description="Memory provider to use"
    )
    transcription_provider: TranscriptionProvider = Field(
        default=TranscriptionProvider.AUTO,
        description="Transcription provider (auto-selects if 'auto')"
    )


class NetworkSettings(BaseModel):
    """Network and public access settings."""

    host_ip: str = Field(
        default="localhost",
        description="Public IP/hostname for browser access"
    )
    backend_public_port: int = Field(
        default=8000,
        ge=1,
        le=65535,
        description="Backend API public port"
    )
    webui_port: int = Field(
        default=5173,
        ge=1,
        le=65535,
        description="WebUI port"
    )
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000",
        description="Comma-separated list of CORS origins"
    )


class MiscSettings(BaseModel):
    """Miscellaneous settings."""

    debug_dir: str = Field(
        default="./data/debug_dir",
        description="Directory for debug files"
    )
    langfuse_enable_telemetry: bool = Field(
        default=False,
        description="Enable Langfuse telemetry"
    )


class AllSettings(BaseModel):
    """Combined model for all application settings."""

    speech_detection: SpeechDetectionSettings = Field(default_factory=SpeechDetectionSettings)
    conversation: ConversationSettings = Field(default_factory=ConversationSettings)
    audio_processing: AudioProcessingSettings = Field(default_factory=AudioProcessingSettings)
    diarization: DiarizationSettings = Field(default_factory=DiarizationSettings)
    llm: LLMSettings = Field(default_factory=LLMSettings)
    providers: ProviderSettings = Field(default_factory=ProviderSettings)
    network: NetworkSettings = Field(default_factory=NetworkSettings)
    misc: MiscSettings = Field(default_factory=MiscSettings)
