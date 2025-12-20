"""
Pydantic schema for config.yaml structure.

Extends existing settings models with top-level configuration for wizard state,
authentication, and optional services.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, PrivateAttr

# Import all existing settings models
from advanced_omi_backend.settings_models import (
    ApiKeysSettings,
    AudioProcessingSettings,
    ConversationSettings,
    DiarizationSettings,
    InfrastructureSettings,
    LLMSettings,
    MiscSettings,
    NetworkSettings,
    ProviderSettings,
    SpeechDetectionSettings,
)


class AuthConfig(BaseModel):
    """Authentication and admin account configuration."""

    secret_key: str = Field(
        default="",
        description="JWT signing key (auto-generated if empty)"
    )
    admin_name: str = Field(
        default="admin",
        description="Admin account name"
    )
    admin_email: str = Field(
        default="admin@example.com",
        description="Admin email address"
    )
    admin_password_hash: str = Field(
        default="",
        description="Bcrypt password hash (never store plaintext)"
    )


class ChronicleConfig(BaseModel):
    """
    Root configuration model for Chronicle.

    This is the complete config.yaml structure, combining all settings
    categories with top-level metadata.
    """

    # Metadata
    version: str = Field(
        default="1.0.0",
        description="Config schema version"
    )
    wizard_completed: bool = Field(
        default=False,
        description="Whether first-time setup wizard has been completed"
    )

    # Authentication
    auth: AuthConfig = Field(
        default_factory=AuthConfig,
        description="Authentication configuration"
    )

    # Core Settings (from existing models)
    speech_detection: SpeechDetectionSettings = Field(
        default_factory=SpeechDetectionSettings,
        description="Speech detection settings"
    )
    conversation: ConversationSettings = Field(
        default_factory=ConversationSettings,
        description="Conversation management settings"
    )
    audio_processing: AudioProcessingSettings = Field(
        default_factory=AudioProcessingSettings,
        description="Audio processing settings"
    )
    diarization: DiarizationSettings = Field(
        default_factory=DiarizationSettings,
        description="Speaker diarization settings"
    )
    llm: LLMSettings = Field(
        default_factory=LLMSettings,
        description="LLM provider and model settings"
    )
    providers: ProviderSettings = Field(
        default_factory=ProviderSettings,
        description="Service provider selection"
    )
    network: NetworkSettings = Field(
        default_factory=NetworkSettings,
        description="Network and CORS settings"
    )
    infrastructure: InfrastructureSettings = Field(
        default_factory=InfrastructureSettings,
        description="Core infrastructure services"
    )
    misc: MiscSettings = Field(
        default_factory=MiscSettings,
        description="Miscellaneous settings"
    )
    api_keys: ApiKeysSettings = Field(
        default_factory=ApiKeysSettings,
        description="External service API keys"
    )

    # Internal metadata (not shown in UI, runtime only)
    _updated_at: Optional[datetime] = PrivateAttr(default=None)
    _updated_by: Optional[str] = PrivateAttr(default=None)
