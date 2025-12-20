"""
Configuration management module.

Provides YAML-based configuration with MongoDB caching, hot reload, and migration utilities.
Also re-exports legacy config functions for backward compatibility.
"""

from .config_parser import ConfigParser, get_config_parser, init_config_parser
from .config_schema import ChronicleConfig

# Re-export legacy config functions for backward compatibility
from advanced_omi_backend.legacy_config import (
    DATA_DIR,
    CHUNK_DIR,
    DEFAULT_DIARIZATION_SETTINGS,
    DEFAULT_SPEECH_DETECTION_SETTINGS,
    DEFAULT_CONVERSATION_STOP_SETTINGS,
    DEFAULT_AUDIO_STORAGE_SETTINGS,
    load_diarization_settings_from_file,
    save_diarization_settings_to_file,
    get_diarization_config_path,
    get_speech_detection_settings,
    get_conversation_stop_settings,
    get_audio_storage_settings,
)

__all__ = [
    # New config system
    "ConfigParser",
    "get_config_parser",
    "init_config_parser",
    "ChronicleConfig",
    # Legacy config functions
    "DATA_DIR",
    "CHUNK_DIR",
    "DEFAULT_DIARIZATION_SETTINGS",
    "DEFAULT_SPEECH_DETECTION_SETTINGS",
    "DEFAULT_CONVERSATION_STOP_SETTINGS",
    "DEFAULT_AUDIO_STORAGE_SETTINGS",
    "load_diarization_settings_from_file",
    "save_diarization_settings_to_file",
    "get_diarization_config_path",
    "get_speech_detection_settings",
    "get_conversation_stop_settings",
    "get_audio_storage_settings",
]
