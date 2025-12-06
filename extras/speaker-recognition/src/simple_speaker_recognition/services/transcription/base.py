"""Base classes for transcription provider abstraction."""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, List, Optional

from pydantic import BaseModel, Field
from pyannote.core import Annotation, Segment, Timeline


class TranscriptionWord(BaseModel):
    """Word-level transcription with timing using pyannote Segment."""

    word: str
    segment: Segment
    confidence: float
    punctuated_word: Optional[str] = None
    speaker: Optional[str] = None  # Populated by orchestrator after diarization

    class Config:
        arbitrary_types_allowed = True

    @property
    def start(self) -> float:
        """Convenience property for backward compatibility."""
        return self.segment.start

    @property
    def end(self) -> float:
        """Convenience property for backward compatibility."""
        return self.segment.end


class TranscriptionResult(BaseModel):
    """Complete transcription result with pyannote-based diarization."""

    text: str
    words: List[TranscriptionWord]
    diarization: Optional[Annotation] = None
    exclusive_diarization: Optional[Annotation] = None  # Pyannote 4.0 feature
    timeline: Optional[Timeline] = None
    metadata: Dict = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True

    def get_speaker_timeline(self, speaker_label: str) -> Timeline:
        """Get timeline for specific speaker."""
        if self.diarization:
            return self.diarization.label_timeline(speaker_label)
        return Timeline()

    def get_speaker_chart(self) -> List[tuple]:
        """Get speaker duration statistics."""
        if self.diarization:
            return self.diarization.chart()
        return []


class BaseTranscriptionProvider(ABC):
    """Abstract base class for transcription providers."""

    @property
    def supports_streaming(self) -> bool:
        """Whether this provider supports streaming mode."""
        return True

    @property
    def has_native_diarization(self) -> bool:
        """Whether this provider has built-in diarization capabilities."""
        return False

    @abstractmethod
    async def transcribe_http(
        self, audio_data: bytes, sample_rate: int, config: Dict
    ) -> TranscriptionResult:
        """Transcribe audio file via HTTP/REST API."""
        pass

    @abstractmethod
    async def transcribe_stream(
        self, audio_stream: AsyncIterator[bytes], sample_rate: int, config: Dict
    ) -> AsyncIterator[TranscriptionResult]:
        """Transcribe streaming audio via WebSocket."""
        pass

    @abstractmethod
    def get_supported_params(self) -> List[str]:
        """Return list of supported configuration parameters."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider service is available."""
        pass
