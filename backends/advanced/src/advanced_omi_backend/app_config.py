"""
Application configuration for Chronicle backend.

Centralizes all application-level configuration including database connections,
service configurations, and environment variables that were previously in main.py.
"""

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from advanced_omi_backend.constants import OMI_CHANNELS, OMI_SAMPLE_RATE, OMI_SAMPLE_WIDTH
from advanced_omi_backend.services.transcription import get_transcription_provider

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class AppConfig:
    """Centralized application configuration."""

    def __init__(self):
        # Graceful degradation mode
        self.allow_missing_api_keys = os.getenv("ALLOW_MISSING_API_KEYS", "false").lower() == "true"

        # MongoDB Configuration
        self.mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongo:27017")
        # default to legacy value to avoid breaking peoples .env
        self.mongodb_database = os.getenv("MONGODB_DATABASE", "friend-lite")
        self.mongo_client = AsyncIOMotorClient(self.mongodb_uri)
        self.db = self.mongo_client.get_default_database(self.mongodb_database)
        self.users_col = self.db["users"]
        self.speakers_col = self.db["speakers"]

        # Audio Configuration
        self.segment_seconds = 60  # length of each stored chunk
        self.target_samples = OMI_SAMPLE_RATE * self.segment_seconds
        self.audio_chunk_dir = Path("./audio_chunks")
        self.audio_chunk_dir.mkdir(parents=True, exist_ok=True)

        # Conversation timeout configuration
        self.new_conversation_timeout_minutes = float(
            os.getenv("NEW_CONVERSATION_TIMEOUT_MINUTES", "1.5")
        )

        # Audio cropping configuration
        self.audio_cropping_enabled = os.getenv("AUDIO_CROPPING_ENABLED", "true").lower() == "true"
        self.min_speech_segment_duration = float(os.getenv("MIN_SPEECH_SEGMENT_DURATION", "1.0"))
        self.cropping_context_padding = float(os.getenv("CROPPING_CONTEXT_PADDING", "0.1"))

        # Transcription Configuration with graceful degradation
        self.transcription_provider_name = os.getenv("TRANSCRIPTION_PROVIDER")
        self.deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        self.mistral_api_key = os.getenv("MISTRAL_API_KEY")
        self.transcription_required = os.getenv("TRANSCRIPTION_REQUIRED", "true").lower() == "true"

        # Get configured transcription provider (with graceful degradation support)
        self.transcription_provider = get_transcription_provider(
            self.transcription_provider_name,
            allow_missing_keys=self.allow_missing_api_keys
        )
        if self.transcription_provider:
            logger.info(
                f"✅ Using {self.transcription_provider.name} transcription provider ({self.transcription_provider.mode})"
            )
            self.transcription_enabled = True
        else:
            if self.transcription_required and not self.allow_missing_api_keys:
                logger.error("❌ Transcription provider required but not configured")
            else:
                logger.warning("⚠️  Transcription disabled - No transcription provider configured")
                if self.allow_missing_api_keys:
                    logger.warning("   Add Deepgram API key to enable transcription")
                    logger.warning("   Configure at: http://localhost:4000/system")
            self.transcription_enabled = False

        # External Services Configuration
        self.qdrant_base_url = os.getenv("QDRANT_BASE_URL", "qdrant")
        self.qdrant_port = os.getenv("QDRANT_PORT", "6333")
        self.memory_provider = os.getenv("MEMORY_PROVIDER", "chronicle").lower()
        # Map legacy provider names to current names
        if self.memory_provider in ("friend-lite", "friend_lite"):
            logger.debug(f"Mapping legacy provider '{self.memory_provider}' to 'chronicle'")
            self.memory_provider = "chronicle"

        # Redis Configuration
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

        # CORS Configuration
        default_origins = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3002"
        self.cors_origins = os.getenv("CORS_ORIGINS", default_origins)
        self.allowed_origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

        # Tailscale support
        self.tailscale_regex = r"http://100\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000"

        # Thread pool configuration
        self.max_workers = os.cpu_count() or 4

        # LLM Configuration with graceful degradation
        self.llm_provider = os.getenv("LLM_PROVIDER", "openai")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.llm_required = os.getenv("LLM_REQUIRED", "true").lower() == "true"

        if not self.openai_api_key:
            if self.llm_required and not self.allow_missing_api_keys:
                logger.error("❌ LLM provider required but OPENAI_API_KEY not configured")
            else:
                logger.warning("⚠️  LLM disabled - Memory extraction and chat features unavailable")
                if self.allow_missing_api_keys:
                    logger.warning("   Add OpenAI API key to enable LLM features")
                    logger.warning("   Configure at: http://localhost:4000/system")
            self.llm_enabled = False
        else:
            self.llm_enabled = True
            logger.info(f"✅ LLM enabled (provider: {self.llm_provider})")

        # Memory service configuration
        self.memory_service_supports_threshold = self.memory_provider == "chronicle"


# Global configuration instance
app_config = AppConfig()


def get_app_config() -> AppConfig:
    """Get the global application configuration instance."""
    return app_config


def get_audio_chunk_dir() -> Path:
    """Get the audio chunk directory."""
    return app_config.audio_chunk_dir


def get_mongo_collections():
    """Get MongoDB collections."""
    return {
        'users': app_config.users_col,
        'speakers': app_config.speakers_col,
    }


def get_redis_config():
    """Get Redis configuration."""
    return {
        'url': app_config.redis_url,
        'encoding': "utf-8",
        'decode_responses': False
    }