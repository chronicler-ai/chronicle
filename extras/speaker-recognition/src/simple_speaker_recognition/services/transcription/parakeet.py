"""Parakeet ASR provider (transcription only)."""

import logging
import os
import tempfile
from typing import AsyncIterator, Dict, List, Optional

import httpx
import numpy as np
import soundfile as sf
from pyannote.core import Segment

from .base import BaseTranscriptionProvider, TranscriptionResult, TranscriptionWord

log = logging.getLogger("speaker_service")


class ParakeetProvider(BaseTranscriptionProvider):
    """
    Parakeet ASR provider for transcription.

    Provides word-level transcription with timestamps.
    Diarization is handled separately by the orchestrator.
    """

    def __init__(self, service_url: str):
        self.service_url = service_url.rstrip("/")
        self.transcribe_url = f"{self.service_url}/transcribe"

    @property
    def has_native_diarization(self) -> bool:
        """Parakeet does not have native diarization."""
        return False

    async def transcribe_http(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> TranscriptionResult:
        """
        Transcribe using Parakeet ASR.

        Returns word-level transcription with timestamps.
        Diarization is handled separately by the orchestrator.
        """
        # Call Parakeet transcription service
        transcription = await self._parakeet_transcribe(audio_data, sample_rate, config)

        # Convert Parakeet words to TranscriptionWord objects
        words = [
            TranscriptionWord(
                word=word_data["word"],
                segment=Segment(word_data["start"], word_data["end"]),
                confidence=word_data.get("confidence", 1.0),
            )
            for word_data in transcription.get("words", [])
        ]

        return TranscriptionResult(
            text=transcription.get("text", ""),
            words=words,
            diarization=None,  # No diarization in transcription-only mode
            exclusive_diarization=None,
            metadata={"provider": "parakeet"},
        )

    async def _parakeet_transcribe(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> Dict:
        """Call Parakeet ASR service."""
        try:
            # Convert PCM to WAV file
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
            audio_array = audio_array / np.iinfo(np.int16).max

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                sf.write(tmp_file.name, audio_array, sample_rate)
                tmp_filename = tmp_file.name

            try:
                async with httpx.AsyncClient(timeout=180.0) as client:
                    with open(tmp_filename, "rb") as f:
                        files = {"file": ("audio.wav", f, "audio/wav")}
                        response = await client.post(self.transcribe_url, files=files)

                if response.status_code == 200:
                    result = response.json()
                    log.info(
                        f"Parakeet transcription: {len(result.get('text', ''))} chars, "
                        f"{len(result.get('words', []))} words"
                    )
                    return result
                else:
                    error_msg = f"Parakeet error: {response.status_code} - {response.text}"
                    log.error(error_msg)
                    raise Exception(error_msg)

            finally:
                if os.path.exists(tmp_filename):
                    os.unlink(tmp_filename)

        except Exception as e:
            log.error(f"Error calling Parakeet service: {e}")
            raise


    async def transcribe_stream(
        self, audio_stream: AsyncIterator[bytes], sample_rate: int, config: Dict
    ) -> AsyncIterator[TranscriptionResult]:
        """
        Stream transcription via Parakeet WebSocket.

        TODO: Implement streaming with buffering for diarization
        Challenge: Real-time diarization requires buffering for pyannote
        """
        raise NotImplementedError(
            "Streaming support with diarization to be implemented in Phase 3"
        )

    def get_supported_params(self) -> List[str]:
        """Return list of supported configuration parameters."""
        return ["language"]

    async def health_check(self) -> bool:
        """Check Parakeet service availability."""
        try:
            async with httpx.AsyncClient() as client:
                # Check if service has a health endpoint
                response = await client.get(f"{self.service_url}/health", timeout=5.0)
                return response.status_code == 200
        except Exception as e:
            log.warning(f"Parakeet health check failed: {e}")
            # If no health endpoint, try the root
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(self.service_url, timeout=5.0)
                    return response.status_code in [200, 404]  # Service is running
            except Exception:
                return False
