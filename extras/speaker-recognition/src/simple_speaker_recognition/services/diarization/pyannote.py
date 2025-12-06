"""Pyannote.audio diarization provider."""

import logging
import os
import tempfile
from typing import Dict, Optional

import numpy as np
import soundfile as sf

from .base import BaseDiarizationProvider, DiarizationResult

log = logging.getLogger("speaker_service")


class PyannoteDiarizationProvider(BaseDiarizationProvider):
    """
    Standalone Pyannote.audio diarization provider.

    Uses pyannote/speaker-diarization-community-1 model for speaker identification.
    Handles both pyannote.audio 3.x and 4.x API versions.
    """

    def __init__(self, hf_token: Optional[str] = None):
        self.hf_token = hf_token or os.getenv("HF_TOKEN")

        if not self.hf_token:
            raise ValueError("HF_TOKEN required for Pyannote diarization pipeline")

        # Lazy-load diarization pipeline (only when first used)
        self.diarization_pipeline = None

    def _ensure_pipeline(self):
        """Lazy-load Pyannote diarization pipeline on first use."""
        if self.diarization_pipeline is None:
            try:
                # Import here to avoid segfaults on systems without proper torch setup
                from pyannote.audio import Pipeline

                self.diarization_pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-community-1", token=self.hf_token
                )
                log.info("Loaded Pyannote diarization pipeline successfully")
            except Exception as e:
                log.error(f"Failed to load Pyannote pipeline: {e}")
                raise

    async def diarize(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> DiarizationResult:
        """
        Perform speaker diarization using Pyannote.

        Args:
            audio_data: Raw PCM16 audio bytes
            sample_rate: Audio sample rate in Hz
            config: Configuration dict (min_speakers, max_speakers)

        Returns:
            DiarizationResult with speaker segments
        """
        # Ensure pipeline is loaded
        self._ensure_pipeline()

        # Convert PCM to float array for soundfile
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        audio_array = audio_array / np.iinfo(np.int16).max

        # Save audio to temporary file for pyannote
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            sf.write(tmp_file.name, audio_array, sample_rate)
            tmp_path = tmp_file.name

        try:
            # Run diarization (returns DiarizeOutput in pyannote 4.x)
            diarization_output = self.diarization_pipeline(tmp_path)

            # Extract annotation from DiarizeOutput
            diarization = diarization_output.speaker_diarization
            exclusive_diarization = diarization_output.exclusive_speaker_diarization

            log.info(
                f"Pyannote diarization complete: {len(diarization.labels())} speakers"
            )

            return DiarizationResult(
                diarization=diarization,
                exclusive_diarization=exclusive_diarization,
                metadata={
                    "provider": "pyannote",
                    "model": "speaker-diarization-community-1",
                    "num_speakers": len(diarization.labels()),
                },
            )

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    async def health_check(self) -> bool:
        """Check if Pyannote pipeline can be loaded."""
        try:
            self._ensure_pipeline()
            return self.diarization_pipeline is not None
        except Exception as e:
            log.warning(f"Pyannote health check failed: {e}")
            return False
