"""Base classes for diarization provider abstraction."""

from abc import ABC, abstractmethod
from typing import Dict, Optional

from pydantic import BaseModel, Field
from pyannote.core import Annotation


class DiarizationResult(BaseModel):
    """Result from speaker diarization."""

    diarization: Annotation
    exclusive_diarization: Optional[Annotation] = None  # Pyannote 4.0 feature
    metadata: Dict = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True


class BaseDiarizationProvider(ABC):
    """Abstract base class for diarization providers."""

    @abstractmethod
    async def diarize(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> DiarizationResult:
        """
        Perform speaker diarization on audio.

        Args:
            audio_data: Raw audio bytes (PCM16)
            sample_rate: Audio sample rate in Hz
            config: Diarization configuration (min_speakers, max_speakers, etc.)

        Returns:
            DiarizationResult with speaker segments
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if diarization service is available."""
        pass
