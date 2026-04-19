import os
import sys
import logging

log = logging.getLogger(__name__)

_cosyvoice = None
_bopomofo_converter = None
_cached_prompt = None


def _ensure_path():
    code_path = os.path.abspath(os.getenv("BREEZYVOICE_CODE_PATH", "./BreezyVoice-code"))
    matcha_path = os.path.join(code_path, "third_party", "Matcha-TTS")
    for p in (code_path, matcha_path):
        if p not in sys.path:
            sys.path.insert(0, p)


def _get_models():
    global _cosyvoice, _bopomofo_converter, _cached_prompt
    if _cosyvoice is None:
        _ensure_path()
        from single_inference import CustomCosyVoice, G2PWConverter, precompute_single_inference
        model_path = os.path.abspath(os.getenv("TTS_MODEL_PATH", "./llm/BreezyVoice"))
        _cosyvoice = CustomCosyVoice(model_path)
        _bopomofo_converter = G2PWConverter()

        speaker_audio = os.path.abspath(os.getenv("SPEAKER_AUDIO_PATH", "./data/tc_speaker.wav"))
        speaker_text = os.getenv("SPEAKER_TEXT", "")
        if not speaker_text:
            raise RuntimeError("SPEAKER_TEXT env var is required")

        log.info("Pre-computing speaker prompt features...")
        _cached_prompt = precompute_single_inference(
            speaker_audio, speaker_text, _cosyvoice, _bopomofo_converter
        )
        log.info("Speaker prompt features cached.")

    return _cosyvoice, _bopomofo_converter, _cached_prompt


def synthesize(text: str, output_path: str) -> str:
    _ensure_path()
    from single_inference import single_inference_cached
    cosyvoice, bopomofo_converter, cached_prompt = _get_models()
    single_inference_cached(
        content_to_synthesize=text,
        output_path=output_path,
        cosyvoice=cosyvoice,
        bopomofo_converter=bopomofo_converter,
        cached_prompt=cached_prompt,
    )
    return output_path
