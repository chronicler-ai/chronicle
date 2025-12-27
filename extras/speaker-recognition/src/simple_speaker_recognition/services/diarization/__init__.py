"""Diarization provider abstraction."""

from .base import BaseDiarizationProvider, DiarizationResult
from .pyannote import PyannoteDiarizationProvider

__all__ = ["BaseDiarizationProvider", "DiarizationResult", "PyannoteDiarizationProvider"]
