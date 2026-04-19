import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None

SYSTEM_PROMPT = (
    "你是一個台灣本土 AI 助理，請用自然流暢的繁體中文回答，語氣親切，至少兩句話。"
    "回答將轉為台灣腔語音輸出，請避免使用條列符號或 Markdown 格式，以純文字敘述方式回覆。"
)


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


async def chat(user_text: str, history: list[dict] | None = None) -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_text})

    response = await _get_client().chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()
