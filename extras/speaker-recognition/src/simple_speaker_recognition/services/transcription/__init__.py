"""Transcription provider abstraction layer."""

import os
from typing import Optional

from .base import BaseTranscriptionProvider, TranscriptionResult, TranscriptionWord
from .utils import (
    extract_speaker_segments,
    find_speaker_at_time,
    format_deepgram_response,
    get_speaker_statistics,
)

# Import orchestrator at package level
from ..orchestrator import TranscriptionOrchestrator

__all__ = [
    "BaseTranscriptionProvider",
    "TranscriptionResult",
    "TranscriptionWord",
    "TranscriptionOrchestrator",
    "get_transcription_provider",
    "get_transcription_orchestrator",
    "format_deepgram_response",
    "find_speaker_at_time",
    "extract_speaker_segments",
    "get_speaker_statistics",
]


def get_transcription_provider() -> BaseTranscriptionProvider:
    """
    Factory function to get configured transcription provider.

    Supports auto-detection based on available credentials:
    - Explicit provider selection via TRANSCRIPTION_PROVIDER env var
    - Auto-detection priority: Deepgram → Parakeet
    - ElevenLabs support to be added in Phase 6

    Returns:
        BaseTranscriptionProvider: Configured provider instance

    Raises:
        ValueError: If no provider is configured or credentials missing
    """
    provider_name = os.getenv("TRANSCRIPTION_PROVIDER", "").lower()

    # Explicit provider selection
    if provider_name == "parakeet":
        parakeet_url = os.getenv("PARAKEET_ASR_URL")
        if not parakeet_url:
            raise ValueError("PARAKEET_ASR_URL required for Parakeet provider")
        from .parakeet import ParakeetProvider

        return ParakeetProvider(parakeet_url)

    elif provider_name == "deepgram":
        deepgram_key = os.getenv("DEEPGRAM_API_KEY")
        if not deepgram_key:
            raise ValueError("DEEPGRAM_API_KEY required for Deepgram provider")
        from .deepgram import DeepgramProvider

        return DeepgramProvider(deepgram_key)

    # Auto-detection fallback (prefers Deepgram)
    if os.getenv("DEEPGRAM_API_KEY"):
        from .deepgram import DeepgramProvider

        return DeepgramProvider(os.getenv("DEEPGRAM_API_KEY"))

    if os.getenv("PARAKEET_ASR_URL"):
        from .parakeet import ParakeetProvider

        return ParakeetProvider(os.getenv("PARAKEET_ASR_URL"))

    raise ValueError(
        "No transcription provider configured. "
        "Set TRANSCRIPTION_PROVIDER=deepgram or parakeet, "
        "and provide DEEPGRAM_API_KEY or PARAKEET_ASR_URL"
    )


def get_transcription_orchestrator(
    diarization_mode: Optional[str] = None, hf_token: Optional[str] = None
) -> TranscriptionOrchestrator:
    """
    Factory function to get configured transcription orchestrator.

    The orchestrator combines transcription and diarization intelligently
    based on the diarization mode:
    - "auto": Use native diarization if available, otherwise Pyannote
    - "native": Use provider's native diarization only
    - "pyannote": Use standalone Pyannote diarization
    - "none": Skip diarization

    Args:
        diarization_mode: Override DIARIZATION_MODE env var
        hf_token: Override HF_TOKEN env var

    Returns:
        TranscriptionOrchestrator: Configured orchestrator instance
    """
    # Get transcription provider
    transcription_provider = get_transcription_provider()

    # Get diarization mode from env or argument
    mode = diarization_mode or os.getenv("DIARIZATION_MODE", "auto")

    # Create orchestrator
    return TranscriptionOrchestrator(
        transcription_provider=transcription_provider,
        diarization_mode=mode,
        hf_token=hf_token,
    )
