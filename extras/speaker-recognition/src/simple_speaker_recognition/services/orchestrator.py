"""Orchestrator for combining transcription and diarization."""

import logging
import os
from typing import Dict, List, Optional

from pyannote.core import Annotation, Segment

from .diarization.base import BaseDiarizationProvider
from .diarization.pyannote import PyannoteDiarizationProvider
from .transcription.base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
    TranscriptionWord,
)

log = logging.getLogger("speaker_service")


class TranscriptionOrchestrator:
    """
    Orchestrates transcription and diarization.

    Separates concerns:
    - Transcription provider: words + timestamps
    - Diarization provider: speaker identification (optional)
    - Orchestrator: combines them intelligently
    """

    def __init__(
        self,
        transcription_provider: BaseTranscriptionProvider,
        diarization_mode: str = "auto",
        hf_token: Optional[str] = None,
    ):
        """
        Initialize orchestrator.

        Args:
            transcription_provider: Provider for transcription (Deepgram, Parakeet, etc.)
            diarization_mode: "auto", "native", "pyannote", or "none"
            hf_token: HuggingFace token for Pyannote (if using pyannote mode)
        """
        self.transcription_provider = transcription_provider
        self.diarization_mode = diarization_mode.lower()
        self.hf_token = hf_token or os.getenv("HF_TOKEN")

        # Lazy-load pyannote diarization provider
        self._pyannote_provider: Optional[BaseDiarizationProvider] = None

        # Validate diarization mode
        valid_modes = ["auto", "native", "pyannote", "none"]
        if self.diarization_mode not in valid_modes:
            log.warning(
                f"Invalid DIARIZATION_MODE '{self.diarization_mode}', "
                f"falling back to 'auto'. Valid modes: {valid_modes}"
            )
            self.diarization_mode = "auto"

        log.info(f"Orchestrator initialized with diarization_mode={self.diarization_mode}")

    def _get_pyannote_provider(self) -> BaseDiarizationProvider:
        """Lazy-load Pyannote diarization provider."""
        if self._pyannote_provider is None:
            if not self.hf_token:
                raise ValueError(
                    "HF_TOKEN required for Pyannote diarization. "
                    "Set HF_TOKEN environment variable or pass to orchestrator."
                )
            self._pyannote_provider = PyannoteDiarizationProvider(
                hf_token=self.hf_token
            )
            log.info("Initialized Pyannote diarization provider")
        return self._pyannote_provider

    async def process(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> TranscriptionResult:
        """
        Process audio: transcribe + optionally diarize + enrich words.

        Args:
            audio_data: Raw PCM16 audio bytes
            sample_rate: Audio sample rate in Hz
            config: Configuration dict (language, model, etc.)

        Returns:
            TranscriptionResult with speaker-enriched words
        """
        # Step 1: Transcribe (words + timestamps)
        log.info(f"Starting transcription with {self.transcription_provider.__class__.__name__}")
        transcription_result = await self.transcription_provider.transcribe_http(
            audio_data, sample_rate, config
        )

        # Step 2: Determine diarization strategy
        should_diarize, use_native = self._determine_diarization_strategy()

        if not should_diarize:
            log.info("Diarization disabled (mode=none)")
            return transcription_result

        # Step 3: Get diarization
        diarization: Optional[Annotation] = None

        if use_native:
            # Use native diarization from transcription provider
            if transcription_result.diarization:
                log.info("Using native diarization from transcription provider")
                diarization = transcription_result.diarization
            else:
                log.warning(
                    "Native diarization requested but not available in transcription result"
                )
        else:
            # Use standalone Pyannote diarization
            log.info("Running standalone Pyannote diarization")
            pyannote_provider = self._get_pyannote_provider()
            diarization_result = await pyannote_provider.diarize(
                audio_data, sample_rate, config
            )
            diarization = diarization_result.diarization

            # Update transcription result with Pyannote diarization
            transcription_result.diarization = diarization
            transcription_result.exclusive_diarization = (
                diarization_result.exclusive_diarization
            )
            transcription_result.metadata["diarization_provider"] = "pyannote"

        # Step 4: Enrich words with speaker labels
        if diarization:
            log.info("Enriching words with speaker labels")
            enriched_words = self._enrich_words_with_speakers(
                transcription_result.words, diarization
            )
            transcription_result.words = enriched_words
            log.info(f"Enriched {len(enriched_words)} words with speaker labels")

        return transcription_result

    def _determine_diarization_strategy(self) -> tuple[bool, bool]:
        """
        Determine diarization strategy based on mode and provider capabilities.

        Returns:
            (should_diarize, use_native)
            - should_diarize: Whether to perform diarization
            - use_native: Whether to use native diarization (vs Pyannote)
        """
        if self.diarization_mode == "none":
            return False, False

        if self.diarization_mode == "native":
            if self.transcription_provider.has_native_diarization:
                return True, True
            else:
                log.warning(
                    f"Native diarization requested but {self.transcription_provider.__class__.__name__} "
                    "does not support it. Skipping diarization."
                )
                return False, False

        if self.diarization_mode == "pyannote":
            return True, False

        if self.diarization_mode == "auto":
            if self.transcription_provider.has_native_diarization:
                log.info("Auto mode: using native diarization")
                return True, True
            else:
                log.info("Auto mode: using Pyannote diarization")
                return True, False

        # Shouldn't reach here due to validation in __init__
        return False, False

    def _enrich_words_with_speakers(
        self, words: List[TranscriptionWord], diarization: Annotation
    ) -> List[TranscriptionWord]:
        """
        Enrich words with speaker labels based on timestamp overlap.

        Args:
            words: List of words with timestamps
            diarization: Pyannote Annotation with speaker segments

        Returns:
            List of words with speaker labels assigned
        """
        for word in words:
            speaker = self._find_speaker_for_segment(word.segment, diarization)
            word.speaker = speaker

        return words

    def _find_speaker_for_segment(
        self, segment: Segment, diarization: Annotation
    ) -> Optional[str]:
        """
        Find best speaker for a segment using Annotation API.

        Uses pyannote's crop() method to find overlapping speakers.
        Selects speaker with maximum overlap.
        """
        # Crop diarization to word segment
        overlapping = diarization.crop(segment, mode="intersection")

        if len(overlapping) == 0:
            return None

        # Find speaker with maximum overlap
        max_overlap = 0.0
        best_speaker = None

        for segment_ann, track_ann, label in overlapping.itertracks(yield_label=True):
            overlap = (segment & segment_ann).duration
            if overlap > max_overlap:
                max_overlap = overlap
                best_speaker = label

        return best_speaker

    async def health_check(self) -> bool:
        """Check health of transcription provider (and diarization if needed)."""
        # Check transcription provider
        if not await self.transcription_provider.health_check():
            log.warning("Transcription provider health check failed")
            return False

        # Check diarization provider if using pyannote
        if self.diarization_mode == "pyannote" or (
            self.diarization_mode == "auto"
            and not self.transcription_provider.has_native_diarization
        ):
            try:
                pyannote_provider = self._get_pyannote_provider()
                if not await pyannote_provider.health_check():
                    log.warning("Pyannote diarization health check failed")
                    return False
            except Exception as e:
                log.warning(f"Failed to initialize Pyannote provider: {e}")
                return False

        return True
