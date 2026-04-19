import mlx_whisper
import os

result = mlx_whisper.transcribe(
    "audio.wav",
    path_or_hf_repo=os.path.expanduser("~/.lmstudio/models/Kenji8000/Breeze-ASR-25-mlx"),
    language="zh",
    fp16=True
)
print(result["text"])