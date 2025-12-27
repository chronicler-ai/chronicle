"""Utility functions for transcription provider abstraction."""

from typing import Any, Dict, List, Optional

from pyannote.core import Annotation, Segment

from .base import TranscriptionResult, TranscriptionWord


def find_speaker_at_time(time: float, diarization: Annotation) -> Optional[str]:
    """
    Find the speaker label at a specific time in the diarization.

    Args:
        time: Time in seconds
        diarization: Pyannote Annotation object

    Returns:
        Speaker label (e.g., "SPEAKER_0") or None if no speaker at that time
    """
    point_segment = Segment(time, time + 0.001)  # Create tiny segment at time point
    overlapping = diarization.crop(point_segment, mode="intersection")

    if len(overlapping) == 0:
        return None

    # Get the first speaker at this time
    for segment, track, label in overlapping.itertracks(yield_label=True):
        return label

    return None


def format_deepgram_response(result: TranscriptionResult) -> Dict[str, Any]:
    """
    Convert TranscriptionResult (with pyannote types) to Deepgram-compatible format.

    Ensures backward compatibility with existing clients expecting Deepgram JSON format.

    Args:
        result: TranscriptionResult with pyannote Annotation

    Returns:
        Dict in Deepgram API response format
    """
    words = []
    for w in result.words:
        word_dict = {
            "word": w.word,
            "start": w.segment.start,
            "end": w.segment.end,
            "confidence": w.confidence,
        }

        # Add punctuated_word if available
        if w.punctuated_word:
            word_dict["punctuated_word"] = w.punctuated_word

        # Add speaker info from diarization Annotation
        if result.diarization:
            speaker_label = find_speaker_at_time(w.segment.middle, result.diarization)
            if speaker_label:
                # Convert "SPEAKER_0" to integer 0 for Deepgram compatibility
                try:
                    speaker_num = int(speaker_label.split("_")[-1])
                    word_dict["speaker"] = speaker_num
                except (ValueError, IndexError):
                    # If label format is different, keep as string
                    word_dict["speaker"] = speaker_label

        words.append(word_dict)

    # Build Deepgram-compatible response structure
    response = {
        "metadata": result.metadata,
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": result.text,
                            "confidence": (
                                sum(w.confidence for w in result.words) / len(result.words)
                                if result.words
                                else 0.0
                            ),
                            "words": words,
                        }
                    ]
                }
            ]
        },
    }

    return response


def extract_speaker_segments(diarization: Annotation) -> List[Dict[str, Any]]:
    """
    Extract speaker segments from pyannote Annotation.

    Args:
        diarization: Pyannote Annotation object

    Returns:
        List of segment dicts with speaker, start, end
    """
    segments = []
    for segment, track, label in diarization.itertracks(yield_label=True):
        segments.append(
            {
                "speaker": label,
                "start": segment.start,
                "end": segment.end,
                "duration": segment.duration,
            }
        )
    return segments


def get_speaker_statistics(diarization: Annotation) -> Dict[str, Any]:
    """
    Get speaker statistics from pyannote Annotation.

    Args:
        diarization: Pyannote Annotation object

    Returns:
        Dict with speaker statistics (total duration per speaker, etc.)
    """
    if not diarization:
        return {}

    # Use pyannote's chart() method for speaker duration statistics
    chart = diarization.chart()

    # Convert to dict format
    stats = {
        "speakers": {},
        "total_duration": diarization.get_timeline().duration(),
        "num_speakers": len(diarization.labels()),
    }

    for label, duration in chart:
        stats["speakers"][label] = {
            "duration": duration,
            "percentage": (
                (duration / stats["total_duration"] * 100)
                if stats["total_duration"] > 0
                else 0
            ),
        }

    return stats
