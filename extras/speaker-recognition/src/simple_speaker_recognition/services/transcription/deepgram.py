"""Deepgram transcription provider with native diarization."""

import logging
from typing import Any, AsyncIterator, Dict, List, Optional

import aiohttp
from pyannote.core import Annotation, Segment

from .base import BaseTranscriptionProvider, TranscriptionResult, TranscriptionWord

log = logging.getLogger("speaker_service")


class DeepgramProvider(BaseTranscriptionProvider):
    """Deepgram transcription provider with native diarization."""

    def __init__(
        self, api_key: str, base_url: str = "https://api.deepgram.com"
    ):
        self.api_key = api_key
        self.base_url = base_url

    @property
    def has_native_diarization(self) -> bool:
        """Deepgram has built-in speaker diarization."""
        return True

    async def transcribe_http(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> TranscriptionResult:
        """
        Transcribe via Deepgram HTTP API.

        Args:
            audio_data: Raw audio bytes
            sample_rate: Sample rate of audio
            config: Configuration parameters (model, language, diarize, etc.)

        Returns:
            TranscriptionResult with pyannote-based diarization
        """
        url = f"{self.base_url}/v1/listen"
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": config.get("content_type", "audio/wav"),
        }

        params = self._build_params(config)

        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, headers=headers, data=audio_data, params=params
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    log.error(f"Deepgram API error: {response.status} - {error_text}")
                    raise Exception(f"Deepgram API error: {error_text}")

                dg_response = await response.json()
                log.info("Successfully received Deepgram response")

        # Convert Deepgram response to pyannote-based format
        return self._parse_deepgram_response(dg_response)

    def _parse_deepgram_response(self, dg_response: Dict) -> TranscriptionResult:
        """
        Parse Deepgram JSON response into pyannote-based TranscriptionResult.

        Deepgram format:
        {
          "results": {
            "channels": [{
              "alternatives": [{
                "transcript": "full text",
                "words": [
                  {"word": "hello", "start": 0.0, "end": 0.5, "confidence": 0.99, "speaker": 0}
                ]
              }]
            }]
          }
        }
        """
        results = dg_response.get("results", {})
        channels = results.get("channels", [])

        if not channels:
            # Empty response
            return TranscriptionResult(
                text="",
                words=[],
                diarization=None,
                metadata={"provider": "deepgram"},
            )

        channel = channels[0]
        alternatives = channel.get("alternatives", [])

        if not alternatives:
            return TranscriptionResult(
                text="",
                words=[],
                diarization=None,
                metadata={"provider": "deepgram"},
            )

        alternative = alternatives[0]

        # Create TranscriptionWord objects with pyannote Segments
        words = []
        for w in alternative.get("words", []):
            words.append(
                TranscriptionWord(
                    word=w["word"],
                    segment=Segment(w["start"], w["end"]),
                    confidence=w.get("confidence", 1.0),
                    punctuated_word=w.get("punctuated_word"),
                )
            )

        # Create pyannote Annotation from Deepgram speaker info
        diarization = Annotation()
        if words and alternative.get("words"):
            # Check if speaker info is available
            first_word = alternative["words"][0]
            if "speaker" in first_word:
                # Group consecutive words by speaker into segments
                for w_data in alternative["words"]:
                    speaker_label = f"SPEAKER_{w_data['speaker']}"
                    segment = Segment(w_data["start"], w_data["end"])
                    diarization[segment] = speaker_label

        return TranscriptionResult(
            text=alternative.get("transcript", ""),
            words=words,
            diarization=diarization if len(diarization) > 0 else None,
            metadata={
                "provider": "deepgram",
                "model": dg_response.get("metadata", {}).get("model_info"),
            },
        )

    def _build_params(self, config: Dict) -> Dict[str, str]:
        """
        Build Deepgram API parameters.

        Converts config dict to string format expected by Deepgram API.
        """
        params = {
            "model": config.get("model", "nova-3"),
            "language": config.get("language", "multi"),
            "punctuate": str(config.get("punctuate", True)).lower(),
            "diarize": str(config.get("diarize", True)).lower(),
            "smart_format": str(config.get("smart_format", True)).lower(),
            "utterances": str(config.get("utterances", True)).lower(),
        }

        # Add optional parameters if provided
        optional_params = [
            "diarize_version",
            "multichannel",
            "alternatives",
            "numerals",
            "profanity_filter",
            "redact",
            "search",
            "replace",
            "keywords",
            "keyword_boost",
            "dates",
            "times",
            "currencies",
            "phone_numbers",
            "addresses",
            "paragraphs",
            "utt_split",
            "dictation",
            "measurements",
            "detect_language",
            "detect_topics",
            "summarize",
            "sentiment",
            "intents",
        ]

        for param in optional_params:
            if param in config:
                value = config[param]
                if isinstance(value, bool):
                    params[param] = str(value).lower()
                elif isinstance(value, list):
                    params[param] = ",".join(str(item) for item in value)
                elif value is not None:
                    params[param] = str(value)

        return params

    async def transcribe_stream(
        self, audio_stream: AsyncIterator[bytes], sample_rate: int, config: Dict
    ) -> AsyncIterator[TranscriptionResult]:
        """
        Stream transcription via Deepgram WebSocket.

        TODO: Implement WebSocket streaming (Phase 3)
        """
        raise NotImplementedError("Streaming support to be implemented in Phase 3")

    def get_supported_params(self) -> List[str]:
        """Return list of supported Deepgram configuration parameters."""
        return [
            "model",
            "language",
            "punctuate",
            "diarize",
            "smart_format",
            "utterances",
            "diarize_version",
            "multichannel",
            "alternatives",
            "numerals",
            "profanity_filter",
            "redact",
            "search",
            "replace",
            "keywords",
            "keyword_boost",
            "dates",
            "times",
            "currencies",
            "phone_numbers",
            "addresses",
            "paragraphs",
            "utt_split",
            "dictation",
            "measurements",
            "detect_language",
            "detect_topics",
            "summarize",
            "sentiment",
            "intents",
        ]

    async def health_check(self) -> bool:
        """Check Deepgram API accessibility."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/v1/projects",
                    headers={"Authorization": f"Token {self.api_key}"},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    return response.status == 200
        except Exception as e:
            log.warning(f"Deepgram health check failed: {e}")
            return False
