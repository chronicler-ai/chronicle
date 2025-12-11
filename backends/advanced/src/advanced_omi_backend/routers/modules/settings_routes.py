"""
Application settings management routes.

Provides endpoints for reading and updating dynamic application settings.
Settings changes take effect within the cache TTL (default: 5 seconds).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from advanced_omi_backend.auth import current_active_user, current_superuser
from advanced_omi_backend.settings_manager import get_settings_manager, SettingsManager
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
from advanced_omi_backend.users import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


# All Settings (Combined)


@router.get("", response_model=AllSettings)
async def get_all_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Get all application settings.

    Available to all authenticated users for read access.
    """
    return await settings_mgr.get_all_settings()


@router.put("", response_model=AllSettings)
async def update_all_settings(
    settings: AllSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update all application settings at once.

    Admin only. Changes take effect within the cache TTL.
    """
    await settings_mgr.update_all_settings(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_all_settings()


# Speech Detection Settings


@router.get("/speech-detection", response_model=SpeechDetectionSettings)
async def get_speech_detection_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get speech detection settings."""
    return await settings_mgr.get_speech_detection()


@router.put("/speech-detection", response_model=SpeechDetectionSettings)
async def update_speech_detection_settings(
    settings: SpeechDetectionSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update speech detection settings. Admin only.

    These settings control when audio sessions are converted to conversations.
    """
    await settings_mgr.update_speech_detection(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_speech_detection()


# Conversation Settings


@router.get("/conversation", response_model=ConversationSettings)
async def get_conversation_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get conversation management settings."""
    return await settings_mgr.get_conversation()


@router.put("/conversation", response_model=ConversationSettings)
async def update_conversation_settings(
    settings: ConversationSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update conversation management settings. Admin only.

    Controls conversation timeouts, transcription buffering, and speaker enrollment.
    """
    await settings_mgr.update_conversation(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_conversation()


# Audio Processing Settings


@router.get("/audio-processing", response_model=AudioProcessingSettings)
async def get_audio_processing_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get audio processing settings."""
    return await settings_mgr.get_audio_processing()


@router.put("/audio-processing", response_model=AudioProcessingSettings)
async def update_audio_processing_settings(
    settings: AudioProcessingSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update audio processing settings. Admin only.

    Controls audio cropping, silence removal, and segment duration.
    """
    await settings_mgr.update_audio_processing(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_audio_processing()


# Diarization Settings


@router.get("/diarization", response_model=DiarizationSettings)
async def get_diarization_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get speaker diarization settings."""
    return await settings_mgr.get_diarization()


@router.put("/diarization", response_model=DiarizationSettings)
async def update_diarization_settings(
    settings: DiarizationSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update speaker diarization settings. Admin only.

    Controls how speakers are identified and segments are separated.
    """
    await settings_mgr.update_diarization(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_diarization()


# LLM Settings


@router.get("/llm", response_model=LLMSettings)
async def get_llm_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get LLM provider and model settings."""
    return await settings_mgr.get_llm()


@router.put("/llm", response_model=LLMSettings)
async def update_llm_settings(
    settings: LLMSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update LLM settings. Admin only.

    Controls which LLM provider and models to use for processing and chat.
    """
    await settings_mgr.update_llm(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_llm()


# Provider Settings


@router.get("/providers", response_model=ProviderSettings)
async def get_provider_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get service provider settings."""
    return await settings_mgr.get_providers()


@router.put("/providers", response_model=ProviderSettings)
async def update_provider_settings(
    settings: ProviderSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update service provider settings. Admin only.

    Controls which memory and transcription providers to use.
    """
    await settings_mgr.update_providers(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_providers()


# Network Settings


@router.get("/network", response_model=NetworkSettings)
async def get_network_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get network and public access settings."""
    return await settings_mgr.get_network()


@router.put("/network", response_model=NetworkSettings)
async def update_network_settings(
    settings: NetworkSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update network settings. Admin only.

    Controls public endpoints, CORS, and network access configuration.
    """
    await settings_mgr.update_network(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_network()


# Infrastructure Settings


@router.get("/infrastructure", response_model=InfrastructureSettings)
async def get_infrastructure_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get infrastructure settings."""
    return await settings_mgr.get_infrastructure()


@router.put("/infrastructure", response_model=InfrastructureSettings)
async def update_infrastructure_settings(
    settings: InfrastructureSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update infrastructure settings. Admin only.

    Controls MongoDB, Redis, Qdrant, and Neo4j connection settings.
    """
    await settings_mgr.update_infrastructure(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_infrastructure()


# Miscellaneous Settings


@router.get("/misc", response_model=MiscSettings)
async def get_misc_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get miscellaneous settings."""
    return await settings_mgr.get_misc()


@router.put("/misc", response_model=MiscSettings)
async def update_misc_settings(
    settings: MiscSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update miscellaneous settings. Admin only.

    Controls debug options and telemetry.
    """
    await settings_mgr.update_misc(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_misc()


# API Keys Settings


@router.get("/api-keys", response_model=ApiKeysSettings)
async def get_api_keys_settings(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """Get API keys settings."""
    return await settings_mgr.get_api_keys()


@router.put("/api-keys", response_model=ApiKeysSettings)
async def update_api_keys_settings(
    settings: ApiKeysSettings,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Update API keys settings. Admin only.

    Controls external service API keys.
    """
    await settings_mgr.update_api_keys(settings, updated_by=str(current_user.id))
    return await settings_mgr.get_api_keys()


@router.get("/api-keys/load-from-file", response_model=ApiKeysSettings)
async def load_api_keys_from_file(
    file_path: str = ".env.api-keys",
    current_user: User = Depends(current_superuser),
):
    """
    Load API keys from a file. Admin only.

    Args:
        file_path: Path to the API keys file (default: .env.api-keys)

    Returns:
        API keys loaded from the file
    """
    from advanced_omi_backend.utils.api_keys_manager import read_api_keys_from_file

    try:
        keys_dict = read_api_keys_from_file(file_path)
        return ApiKeysSettings(**keys_dict)
    except Exception as e:
        logger.error(f"Error loading API keys from file {file_path}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load API keys from {file_path}: {str(e)}"
        )


@router.post("/api-keys/save")
async def save_api_keys(
    settings: ApiKeysSettings,
    save_to_file: bool = True,
    save_to_database: bool = True,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Save API keys to file and/or database. Admin only.

    Args:
        settings: API keys to save
        save_to_file: Save to .env.api-keys file (default: True)
        save_to_database: Save to MongoDB (default: True)
    """
    from advanced_omi_backend.utils.api_keys_manager import write_api_keys_to_file

    results = {"file": False, "database": False, "errors": []}

    # Save to file
    if save_to_file:
        try:
            keys_dict = {
                "openai_api_key": settings.openai_api_key,
                "deepgram_api_key": settings.deepgram_api_key,
                "mistral_api_key": settings.mistral_api_key,
                "hf_token": settings.hf_token,
                "langfuse_public_key": settings.langfuse_public_key,
                "langfuse_secret_key": settings.langfuse_secret_key,
                "ngrok_authtoken": settings.ngrok_authtoken,
            }
            success = write_api_keys_to_file(keys_dict, ".env.api-keys")
            results["file"] = success
            if not success:
                results["errors"].append("Failed to write to .env.api-keys file")
        except Exception as e:
            logger.error(f"Error writing API keys to file: {e}")
            results["errors"].append(f"File write error: {str(e)}")

    # Save to database
    if save_to_database:
        try:
            await settings_mgr.update_api_keys(settings, updated_by=str(current_user.id))
            results["database"] = True
        except Exception as e:
            logger.error(f"Error saving API keys to database: {e}")
            results["errors"].append(f"Database save error: {str(e)}")

    return {
        "success": results["file"] or results["database"],
        "saved_to": {
            "file": results["file"],
            "database": results["database"],
        },
        "errors": results["errors"],
        "settings": await settings_mgr.get_api_keys(),
    }


# Cache Management


@router.post("/cache/invalidate")
async def invalidate_settings_cache(
    category: str = None,
    current_user: User = Depends(current_superuser),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Invalidate settings cache. Admin only.

    Forces settings to reload from database on next access.
    If category is provided, only invalidates that category.
    """
    settings_mgr.invalidate_cache(category)
    return {
        "status": "success",
        "message": f"Cache invalidated for {category if category else 'all settings'}",
    }


# Infrastructure Status


@router.get("/infrastructure/status")
async def get_infrastructure_status(
    current_user: User = Depends(current_active_user),
    settings_mgr: SettingsManager = Depends(get_settings_manager),
):
    """
    Get infrastructure service connection status.

    Returns URLs and connection status for MongoDB, Redis, Qdrant, Neo4j.
    Uses editable settings from database.
    """
    from advanced_omi_backend.app_config import get_app_config

    # Get infrastructure settings from database
    infra_settings = await settings_mgr.get_infrastructure()
    config = get_app_config()

    status = {
        "mongodb": {
            "url": infra_settings.mongodb_uri,
            "database": infra_settings.mongodb_database,
            "connected": False,
        },
        "redis": {
            "url": infra_settings.redis_url,
            "connected": False,
        },
        "qdrant": {
            "url": f"http://{infra_settings.qdrant_base_url}:{infra_settings.qdrant_port}",
            "connected": False,
        },
        "neo4j": {
            "host": infra_settings.neo4j_host,
            "user": infra_settings.neo4j_user,
            "connected": False,
        },
    }

    # Check MongoDB
    try:
        await config.mongo_client.admin.command('ping')
        status["mongodb"]["connected"] = True
    except Exception as e:
        logger.debug(f"MongoDB connection check failed: {e}")

    # Check Redis
    try:
        from advanced_omi_backend.controllers.queue_controller import redis_conn
        redis_conn.ping()
        status["redis"]["connected"] = True
    except Exception as e:
        logger.debug(f"Redis connection check failed: {e}")

    # Check Qdrant
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{status['qdrant']['url']}/", timeout=2.0)
            status["qdrant"]["connected"] = response.status_code == 200
    except Exception as e:
        logger.debug(f"Qdrant connection check failed: {e}")

    # Neo4j check (optional service)
    # We don't check Neo4j connection as it's optional and may not be configured

    return status


@router.get("/api-keys/status")
async def get_api_keys_status(
    current_user: User = Depends(current_superuser),
):
    """
    Get API keys configuration status. Admin only.

    Returns which API keys are configured (but not the actual keys).
    """
    import os

    keys_status = {
        "openai": {
            "name": "OpenAI API Key",
            "configured": bool(os.getenv("OPENAI_API_KEY")),
            "env_var": "OPENAI_API_KEY",
        },
        "deepgram": {
            "name": "Deepgram API Key",
            "configured": bool(os.getenv("DEEPGRAM_API_KEY")),
            "env_var": "DEEPGRAM_API_KEY",
        },
        "mistral": {
            "name": "Mistral API Key",
            "configured": bool(os.getenv("MISTRAL_API_KEY")),
            "env_var": "MISTRAL_API_KEY",
        },
        "hf_token": {
            "name": "HuggingFace Token",
            "configured": bool(os.getenv("HF_TOKEN")),
            "env_var": "HF_TOKEN",
        },
        "langfuse_public": {
            "name": "Langfuse Public Key",
            "configured": bool(os.getenv("LANGFUSE_PUBLIC_KEY")),
            "env_var": "LANGFUSE_PUBLIC_KEY",
        },
        "langfuse_secret": {
            "name": "Langfuse Secret Key",
            "configured": bool(os.getenv("LANGFUSE_SECRET_KEY")),
            "env_var": "LANGFUSE_SECRET_KEY",
        },
        "ngrok": {
            "name": "Ngrok Auth Token",
            "configured": bool(os.getenv("NGROK_AUTHTOKEN")),
            "env_var": "NGROK_AUTHTOKEN",
        },
    }

    return keys_status
