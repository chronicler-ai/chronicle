"""
Settings adapter - bridges ConfigParser to SettingsManager interface.

This allows existing settings_routes.py to work without modification
while using config.yaml as the source of truth.
"""

import logging
from typing import TypeVar

from .config_parser import ConfigParser, get_config_parser
from .config_schema import ChronicleConfig
from advanced_omi_backend.settings_models import (
    AllSettings,
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

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ConfigBasedSettingsManager:
    """
    Settings manager that uses ConfigParser (config.yaml) instead of MongoDB.

    Implements the same interface as SettingsManager for backward compatibility.
    """

    def __init__(self, config_parser: ConfigParser):
        self.config_parser = config_parser

    async def initialize(self):
        """Initialize settings (no-op for config-based system)."""
        logger.info("ConfigBasedSettingsManager initialized (using config.yaml)")

    # Individual setting getters

    async def get_speech_detection(self) -> SpeechDetectionSettings:
        """Get speech detection settings."""
        config = await self.config_parser.load()
        return config.speech_detection

    async def get_conversation(self) -> ConversationSettings:
        """Get conversation management settings."""
        config = await self.config_parser.load()
        return config.conversation

    async def get_audio_processing(self) -> AudioProcessingSettings:
        """Get audio processing settings."""
        config = await self.config_parser.load()
        return config.audio_processing

    async def get_diarization(self) -> DiarizationSettings:
        """Get diarization settings."""
        config = await self.config_parser.load()
        return config.diarization

    async def get_llm(self) -> LLMSettings:
        """Get LLM settings."""
        config = await self.config_parser.load()
        return config.llm

    async def get_providers(self) -> ProviderSettings:
        """Get provider settings."""
        config = await self.config_parser.load()
        return config.providers

    async def get_network(self) -> NetworkSettings:
        """Get network settings."""
        config = await self.config_parser.load()
        return config.network

    async def get_infrastructure(self) -> InfrastructureSettings:
        """Get infrastructure settings."""
        config = await self.config_parser.load()
        return config.infrastructure

    async def get_misc(self) -> MiscSettings:
        """Get miscellaneous settings."""
        config = await self.config_parser.load()
        return config.misc

    async def get_api_keys(self) -> ApiKeysSettings:
        """Get API keys settings."""
        config = await self.config_parser.load()
        return config.api_keys

    async def get_all_settings(self) -> AllSettings:
        """Get all settings combined."""
        config = await self.config_parser.load()
        return AllSettings(
            speech_detection=config.speech_detection,
            conversation=config.conversation,
            audio_processing=config.audio_processing,
            diarization=config.diarization,
            llm=config.llm,
            providers=config.providers,
            network=config.network,
            infrastructure=config.infrastructure,
            misc=config.misc,
            api_keys=config.api_keys,
        )

    # Individual setting updaters

    async def update_speech_detection(
        self,
        settings: SpeechDetectionSettings,
        updated_by: str = "user",
    ):
        """Update speech detection settings."""
        await self.config_parser.update(
            {"speech_detection": settings.dict()},
            updated_by=updated_by,
        )

    async def update_conversation(
        self,
        settings: ConversationSettings,
        updated_by: str = "user",
    ):
        """Update conversation management settings."""
        await self.config_parser.update(
            {"conversation": settings.dict()},
            updated_by=updated_by,
        )

    async def update_audio_processing(
        self,
        settings: AudioProcessingSettings,
        updated_by: str = "user",
    ):
        """Update audio processing settings."""
        await self.config_parser.update(
            {"audio_processing": settings.dict()},
            updated_by=updated_by,
        )

    async def update_diarization(
        self,
        settings: DiarizationSettings,
        updated_by: str = "user",
    ):
        """Update diarization settings."""
        await self.config_parser.update(
            {"diarization": settings.dict()},
            updated_by=updated_by,
        )

    async def update_llm(
        self,
        settings: LLMSettings,
        updated_by: str = "user",
    ):
        """Update LLM settings."""
        await self.config_parser.update(
            {"llm": settings.dict()},
            updated_by=updated_by,
        )

    async def update_providers(
        self,
        settings: ProviderSettings,
        updated_by: str = "user",
    ):
        """Update provider settings."""
        await self.config_parser.update(
            {"providers": settings.dict()},
            updated_by=updated_by,
        )

    async def update_network(
        self,
        settings: NetworkSettings,
        updated_by: str = "user",
    ):
        """Update network settings."""
        await self.config_parser.update(
            {"network": settings.dict()},
            updated_by=updated_by,
        )

    async def update_infrastructure(
        self,
        settings: InfrastructureSettings,
        updated_by: str = "user",
    ):
        """Update infrastructure settings."""
        await self.config_parser.update(
            {"infrastructure": settings.dict()},
            updated_by=updated_by,
        )

    async def update_misc(
        self,
        settings: MiscSettings,
        updated_by: str = "user",
    ):
        """Update miscellaneous settings."""
        await self.config_parser.update(
            {"misc": settings.dict()},
            updated_by=updated_by,
        )

    async def update_api_keys(
        self,
        settings: ApiKeysSettings,
        updated_by: str = "user",
    ):
        """Update API keys settings."""
        await self.config_parser.update(
            {"api_keys": settings.dict()},
            updated_by=updated_by,
        )

    async def update_all_settings(
        self,
        settings: AllSettings,
        updated_by: str = "user",
    ):
        """Update all settings at once."""
        config = await self.config_parser.load()

        # Update all sections
        config.speech_detection = settings.speech_detection
        config.conversation = settings.conversation
        config.audio_processing = settings.audio_processing
        config.diarization = settings.diarization
        config.llm = settings.llm
        config.providers = settings.providers
        config.network = settings.network
        config.infrastructure = settings.infrastructure
        config.misc = settings.misc
        config.api_keys = settings.api_keys

        # Set private attribute (runtime only, not saved to YAML)
        config._updated_by = updated_by

        await self.config_parser.save(config)

    def invalidate_cache(self, key: str = None):
        """
        Force settings to reload from file on next access.

        Args:
            key: Specific settings category (ignored - always reloads all)
        """
        # Config parser auto-reloads based on file mtime
        logger.info(f"Cache invalidation requested (config auto-reloads from file)")
