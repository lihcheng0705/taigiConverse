import os
import numpy as np
import soundfile as sf
from functools import lru_cache


def _load_pipeline():
    from transformers import (
        WhisperProcessor,
        WhisperForConditionalGeneration,
        AutomaticSpeechRecognitionPipeline,
    )
    model_path = os.getenv("ASR_MODEL_PATH", "./llm/breeze-raw")
    processor = WhisperProcessor.from_pretrained(model_path)
    model = WhisperForConditionalGeneration.from_pretrained(model_path).eval()
    return AutomaticSpeechRecognitionPipeline(
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
    )


_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = _load_pipeline()
    return _pipeline


def transcribe(audio_path: str) -> str:
    import librosa
    # librosa.load handles webm/mp4/ogg via ffmpeg, always resamples to target sr
    waveform, _ = librosa.load(audio_path, sr=16_000, mono=True)
    waveform = waveform.astype(np.float32)
    result = _get_pipeline()(waveform)
    return result["text"].strip()
