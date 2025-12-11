"""
Dynamic settings manager with MongoDB storage and caching.

Settings are loaded from environment variables on first initialization,
then stored in MongoDB. Subsequent loads use MongoDB as the source of truth.
Changes take effect within the cache TTL (default: 5 seconds).
"""

import logging
import os
import time
from typing import Dict, Any, Optional, TypeVar, Type

from motor.motor_asyncio import AsyncIOMotorDatabase

from advanced_omi_backend.settings_models import (
    AllSettings,
    AudioProcessingSettings,
    ConversationSettings,
    DiarizationSettings,
    LLMSettings,
    MiscSettings,
    NetworkSettings,
    ProviderSettings,
    SpeechDetectionSettings,
    TranscriptionProvider,
)

logger = logging.getLogger(__name__)

T = TypeVar('T')


class SettingsManager:
    """
    Manages dynamic application settings with MongoDB storage and caching.

    Settings are stored in the 'application_settings' collection with documents:
    {
        "_id": "speech_detection",  # Setting category
        "values": {...},             # Pydantic model dict
        "updated_at": datetime,
        "updated_by": "user_id or 'system'"
    }
    """

    def __init__(self, db: AsyncIOMotorDatabase, cache_ttl: int = 5):
        """
        Initialize settings manager.

        Args:
            db: MongoDB database instance
            cache_ttl: Cache TTL in seconds (default: 5)
        """
        self.db = db
        self.settings_col = db["application_settings"]
        self.cache_ttl = cache_ttl

        # Cache storage
        self._cache: Dict[str, Any] = {}
        self._cache_time: Dict[str, float] = {}

        # Initialization flag
        self._initialized = False

    async def initialize(self):
        """
        Initialize settings from environment variables if not already in MongoDB.

        This is called once on application startup to migrate existing env vars
        to the database.
        """
        if self._initialized:
            return

        logger.info("Initializing settings manager...")

        # Check if settings already exist in DB
        count = await self.settings_col.count_documents({})

        if count == 0:
            # First time setup - load from env vars
            logger.info("No settings found in database, initializing from environment variables")
            await self._initialize_from_env()
        else:
            logger.info(f"Found {count} setting categories in database")

        self._initialized = True

    async def _initialize_from_env(self):
        """Initialize all settings from environment variables."""

        # Speech detection
        speech_detection = SpeechDetectionSettings(
            min_words=int(os.getenv("SPEECH_DETECTION_MIN_WORDS", "5")),
            min_confidence=float(os.getenv("SPEECH_DETECTION_MIN_CONFIDENCE", "0.5")),
            min_duration=float(os.getenv("SPEECH_DETECTION_MIN_DURATION", "10.0")),
        )
        await self._save_to_db("speech_detection", speech_detection.dict(), "system")

        # Conversation settings
        conversation = ConversationSettings(
            transcription_buffer_seconds=float(os.getenv("TRANSCRIPTION_BUFFER_SECONDS", "120")),
            speech_inactivity_threshold=float(os.getenv("SPEECH_INACTIVITY_THRESHOLD_SECONDS", "60")),
            new_conversation_timeout_minutes=float(os.getenv("NEW_CONVERSATION_TIMEOUT_MINUTES", "1.5")),
            record_only_enrolled_speakers=os.getenv("RECORD_ONLY_ENROLLED_SPEAKERS", "true").lower() == "true",
        )
        await self._save_to_db("conversation", conversation.dict(), "system")

        # Audio processing
        audio_processing = AudioProcessingSettings(
            audio_cropping_enabled=os.getenv("AUDIO_CROPPING_ENABLED", "true").lower() == "true",
            min_speech_segment_duration=float(os.getenv("MIN_SPEECH_SEGMENT_DURATION", "1.0")),
            cropping_context_padding=float(os.getenv("CROPPING_CONTEXT_PADDING", "0.1")),
        )
        await self._save_to_db("audio_processing", audio_processing.dict(), "system")

        # Diarization (load from existing config or defaults)
        from advanced_omi_backend.config import _diarization_settings
        if _diarization_settings:
            diarization = DiarizationSettings(**_diarization_settings)
        else:
            diarization = DiarizationSettings()
        await self._save_to_db("diarization", diarization.dict(), "system")

        # LLM settings
        llm = LLMSettings(
            llm_provider=os.getenv("LLM_PROVIDER", "openai"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            chat_llm_model=os.getenv("CHAT_LLM_MODEL"),
            chat_temperature=float(os.getenv("CHAT_TEMPERATURE", "0.7")),
            ollama_model=os.getenv("OLLAMA_MODEL", "llama3.1:latest"),
            ollama_embedder_model=os.getenv("OLLAMA_EMBEDDER_MODEL", "nomic-embed-text:latest"),
        )
        await self._save_to_db("llm", llm.dict(), "system")

        # Provider settings
        transcription_provider = os.getenv("TRANSCRIPTION_PROVIDER", "auto")
        # Map empty string to "auto"
        if not transcription_provider:
            transcription_provider = "auto"

        providers = ProviderSettings(
            memory_provider=os.getenv("MEMORY_PROVIDER", "chronicle"),
            transcription_provider=transcription_provider,
        )
        await self._save_to_db("providers", providers.dict(), "system")

        # Network settings
        network = NetworkSettings(
            host_ip=os.getenv("HOST_IP", "localhost"),
            backend_public_port=int(os.getenv("BACKEND_PUBLIC_PORT", "8000")),
            webui_port=int(os.getenv("WEBUI_PORT", "5173")),
            cors_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"),
        )
        await self._save_to_db("network", network.dict(), "system")

        # Misc settings
        misc = MiscSettings(
            debug_dir=os.getenv("DEBUG_DIR", "./data/debug_dir"),
            langfuse_enable_telemetry=os.getenv("LANGFUSE_ENABLE_TELEMETRY", "false").lower() == "true",
        )
        await self._save_to_db("misc", misc.dict(), "system")

        logger.info("✅ Initialized all settings from environment variables")

    async def _get_from_cache_or_db(
        self,
        key: str,
        model_class: Type[T],
    ) -> T:
        """
        Get settings from cache or database.

        Args:
            key: Settings category key
            model_class: Pydantic model class

        Returns:
            Instance of model_class with current settings
        """
        # Check cache freshness
        if key in self._cache:
            age = time.time() - self._cache_time.get(key, 0)
            if age < self.cache_ttl:
                return self._cache[key]

        # Load from DB
        doc = await self.settings_col.find_one({"_id": key})

        if doc and "values" in doc:
            settings = model_class(**doc["values"])
        else:
            # Use defaults if not found
            logger.warning(f"Settings '{key}' not found in database, using defaults")
            settings = model_class()

        # Update cache
        self._cache[key] = settings
        self._cache_time[key] = time.time()

        return settings

    async def _save_to_db(self, key: str, values: dict, updated_by: str = "user"):
        """
        Save settings to database.

        Args:
            key: Settings category key
            values: Settings values as dict
            updated_by: User ID or 'system'
        """
        from datetime import datetime

        await self.settings_col.update_one(
            {"_id": key},
            {
                "$set": {
                    "values": values,
                    "updated_at": datetime.utcnow(),
                    "updated_by": updated_by,
                }
            },
            upsert=True,
        )

    async def _update_settings(
        self,
        key: str,
        settings: T,
        updated_by: str = "user",
    ):
        """
        Update settings in database and cache.

        Args:
            key: Settings category key
            settings: Pydantic model instance
            updated_by: User ID or 'system'
        """
        # Save to DB
        await self._save_to_db(key, settings.dict(), updated_by)

        # Update cache immediately
        self._cache[key] = settings
        self._cache_time[key] = time.time()

        logger.info(f"Updated settings '{key}' (by: {updated_by})")

    # Speech Detection Settings

    async def get_speech_detection(self) -> SpeechDetectionSettings:
        """Get speech detection settings."""
        return await self._get_from_cache_or_db("speech_detection", SpeechDetectionSettings)

    async def update_speech_detection(
        self,
        settings: SpeechDetectionSettings,
        updated_by: str = "user",
    ):
        """Update speech detection settings."""
        await self._update_settings("speech_detection", settings, updated_by)

    # Conversation Settings

    async def get_conversation(self) -> ConversationSettings:
        """Get conversation management settings."""
        return await self._get_from_cache_or_db("conversation", ConversationSettings)

    async def update_conversation(
        self,
        settings: ConversationSettings,
        updated_by: str = "user",
    ):
        """Update conversation management settings."""
        await self._update_settings("conversation", settings, updated_by)

    # Audio Processing Settings

    async def get_audio_processing(self) -> AudioProcessingSettings:
        """Get audio processing settings."""
        return await self._get_from_cache_or_db("audio_processing", AudioProcessingSettings)

    async def update_audio_processing(
        self,
        settings: AudioProcessingSettings,
        updated_by: str = "user",
    ):
        """Update audio processing settings."""
        await self._update_settings("audio_processing", settings, updated_by)

    # Diarization Settings

    async def get_diarization(self) -> DiarizationSettings:
        """Get diarization settings."""
        return await self._get_from_cache_or_db("diarization", DiarizationSettings)

    async def update_diarization(
        self,
        settings: DiarizationSettings,
        updated_by: str = "user",
    ):
        """Update diarization settings."""
        await self._update_settings("diarization", settings, updated_by)

    # LLM Settings

    async def get_llm(self) -> LLMSettings:
        """Get LLM settings."""
        return await self._get_from_cache_or_db("llm", LLMSettings)

    async def update_llm(
        self,
        settings: LLMSettings,
        updated_by: str = "user",
    ):
        """Update LLM settings."""
        await self._update_settings("llm", settings, updated_by)

    # Provider Settings

    async def get_providers(self) -> ProviderSettings:
        """Get provider settings."""
        return await self._get_from_cache_or_db("providers", ProviderSettings)

    async def update_providers(
        self,
        settings: ProviderSettings,
        updated_by: str = "user",
    ):
        """Update provider settings."""
        await self._update_settings("providers", settings, updated_by)

    # Network Settings

    async def get_network(self) -> NetworkSettings:
        """Get network settings."""
        return await self._get_from_cache_or_db("network", NetworkSettings)

    async def update_network(
        self,
        settings: NetworkSettings,
        updated_by: str = "user",
    ):
        """Update network settings."""
        await self._update_settings("network", settings, updated_by)

    # Misc Settings

    async def get_misc(self) -> MiscSettings:
        """Get miscellaneous settings."""
        return await self._get_from_cache_or_db("misc", MiscSettings)

    async def update_misc(
        self,
        settings: MiscSettings,
        updated_by: str = "user",
    ):
        """Update miscellaneous settings."""
        await self._update_settings("misc", settings, updated_by)

    # Combined Settings

    async def get_all_settings(self) -> AllSettings:
        """Get all settings combined."""
        return AllSettings(
            speech_detection=await self.get_speech_detection(),
            conversation=await self.get_conversation(),
            audio_processing=await self.get_audio_processing(),
            diarization=await self.get_diarization(),
            llm=await self.get_llm(),
            providers=await self.get_providers(),
            network=await self.get_network(),
            misc=await self.get_misc(),
        )

    async def update_all_settings(
        self,
        settings: AllSettings,
        updated_by: str = "user",
    ):
        """Update all settings at once."""
        await self.update_speech_detection(settings.speech_detection, updated_by)
        await self.update_conversation(settings.conversation, updated_by)
        await self.update_audio_processing(settings.audio_processing, updated_by)
        await self.update_diarization(settings.diarization, updated_by)
        await self.update_llm(settings.llm, updated_by)
        await self.update_providers(settings.providers, updated_by)
        await self.update_network(settings.network, updated_by)
        await self.update_misc(settings.misc, updated_by)

    def invalidate_cache(self, key: Optional[str] = None):
        """
        Force settings to reload from database on next access.

        Args:
            key: Specific settings category to invalidate, or None for all
        """
        if key:
            self._cache_time[key] = 0
            logger.info(f"Invalidated cache for '{key}'")
        else:
            self._cache_time.clear()
            logger.info("Invalidated all settings cache")


# Global settings manager instance (initialized in main.py)
_settings_manager: Optional[SettingsManager] = None


def init_settings_manager(db: AsyncIOMotorDatabase):
    """Initialize the global settings manager."""
    global _settings_manager
    _settings_manager = SettingsManager(db)
    return _settings_manager


def get_settings_manager() -> SettingsManager:
    """Get the global settings manager instance."""
    if _settings_manager is None:
        raise RuntimeError("Settings manager not initialized. Call init_settings_manager() first.")
    return _settings_manager
