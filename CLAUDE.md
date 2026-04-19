# 台語即時語音對話服務 (Taigi Converse)

## 專案概述

仿造 ChatGPT 介面的台語即時語音對話 Web 服務。使用者按下錄音鍵說台語，後端辨識語音、送 OpenAI 生成台語回應、再以台語 TTS 合成語音輸出並在前台播放。

---

## 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| **後端框架** | FastAPI (Python 3.11) | Web API、靜態檔案服務 |
| **台語 ASR** | Breeze-ASR (Whisper-based) | 台語語音 → 文字 |
| **LLM** | OpenAI GPT-4o | 生成台語漢字回應 |
| **台語 TTS** | BreezyVoice (CosyVoice-based) | 文字 → 台語語音合成 |
| **文字正規化** | 跳過（直接繁體中文傳 G2PW） | WeTextProcessing 會將繁→簡，破壞台語漢字 |
| **注音轉換** | G2PW (bert-base-chinese) | 多音字注音處理 |
| **前端** | 原生 HTML/CSS/JS | ChatGPT 風格深色介面 |
| **音訊錄製** | MediaRecorder API | 瀏覽器端麥克風錄音（WebM） |

---

## 專案架構

```
taigi_converse/
├── main.py                  # FastAPI 應用程式入口
├── services/
│   ├── __init__.py
│   ├── asr.py               # Breeze-ASR 語音辨識（lazy loading，librosa 解碼 WebM）
│   ├── llm.py               # OpenAI GPT-4o 台語回應（含 session 歷史）
│   └── tts.py               # BreezyVoice TTS（model + speaker prompt 快取，首次載入預計算）
├── static/
│   ├── index.html           # 前端頁面（ChatGPT 風格介面）
│   ├── app.js               # 錄音、API 呼叫、對話泡泡、自動播放
│   └── style.css            # 深色主題樣式
├── BreezyVoice-code/        # BreezyVoice GitHub 程式碼（需另行 clone）
│   ├── single_inference.py  # 已 patch：清零 prompt text token；加 speaker prompt 快取 API；移除 set_num_threads(1)
│   ├── requirements-mac.txt # macOS 相容 requirements
│   └── cosyvoice/
│       ├── cli/frontend.py  # 已 patch：跳過 WeTextProcessing，use_tn=False（繁→簡問題）
│       └── dataset/processor.py  # 已 patch：torchaudio.set_audio_backend 相容性
├── llm/
│   ├── breeze-raw/          # Breeze-ASR 模型權重
│   └── BreezyVoice/         # BreezyVoice 模型權重
├── data/
│   └── tc_speaker.wav       # TTS 參考音色（錄音者說的內容須與 SPEAKER_TEXT 一致）
├── temp/                    # 暫存音訊檔（自動清理，預設 1 小時）
├── .env                     # 環境變數
├── .env.example             # 環境變數範本
└── requirements.txt         # Python 相依套件
```

---

## 服務流程

```
[使用者] 按下錄音鍵
    ↓
[前端] MediaRecorder 錄製音訊 → WebM
    ↓
[前端] POST /api/chat (multipart form: audio)
    ↓
[後端: ASR] librosa.load() 解碼 WebM → Breeze-ASR Whisper pipeline
    → 台語語音 → 繁體中文/台語漢字文字
    ↓
[後端: LLM] OpenAI GPT-4o（含 session 對話歷史）
    → system prompt 要求全台語漢字回應
    → 文字 → 台語漢字回應
    ↓
[後端: TTS] BreezyVoice single_inference_cached（使用預快取 speaker prompt）
    → G2PW 多音字注音（直接繁體中文輸入）
    → voice cloning（參考 tc_speaker.wav 音色）
    → 台語語音 WAV
    ↓
[後端] 回傳 JSON: { session_id, user_text, reply_text, audio_url }
    ↓
[前端] 顯示對話泡泡 + 自動播放語音
```

---

## macOS 安裝步驟

### 1. 基本套件

```bash
pip install "setuptools>=68,<71"
pip install openai-whisper==20231117 --no-build-isolation
pip install -r requirements.txt
```

### 2. BreezyVoice 程式碼

```bash
git clone https://github.com/mtkresearch/BreezyVoice ./BreezyVoice-code
pip install -r ./BreezyVoice-code/requirements-mac.txt
pip install "ruamel.yaml<0.18.0"
```

### 3. torch 升級（解決 diffusers 版本衝突）

```bash
pip install "torch>=2.4" "torchaudio>=2.4"
```

### 4. 環境變數

複製 `.env.example` 為 `.env` 並填入：

```env
OPENAI_API_KEY=sk-...
ASR_MODEL_PATH=./llm/breeze-raw
TTS_MODEL_PATH=./llm/BreezyVoice
BREEZYVOICE_CODE_PATH=./BreezyVoice-code
SPEAKER_AUDIO_PATH=./data/tc_speaker.wav
SPEAKER_TEXT=<錄音者在 tc_speaker.wav 中說的文字>
HOST=0.0.0.0
PORT=8000
TEMP_DIR=./temp
MAX_TEMP_AGE_HOURS=1
```

> **重要**：`SPEAKER_TEXT` 必須與 `tc_speaker.wav` 錄音內容完全一致，建議錄音 5~15 秒，發音清晰。

### 5. 啟動服務

```bash
uvicorn main:app --host 127.0.0.1 --port 8080
```

開啟瀏覽器：http://localhost:8080

> 注意：port 8000 可能與 Laravel Valet 衝突，改用 8080。

---

## 已知 macOS 相容性問題與修法

| 問題 | 原因 | 修法 |
|------|------|------|
| `ttsfrd` 無法安裝 | Linux-only binary wheel | 已 patch：`use_tn=False`，完全跳過文字正規化 |
| WeTextProcessing 繁→簡轉換 | ZhNormalizer 將繁體轉簡體，破壞台語漢字 | 已移除 WeTextProcessing，文字直接傳 G2PW |
| `openai-whisper` build 失敗 | 舊式 setup.py 找不到 pkg_resources | 降版 setuptools + `--no-build-isolation` |
| `torchaudio.set_audio_backend` 不存在 | torchaudio 2.4+ 移除此 API | 已 patch `processor.py` |
| `ruamel.yaml` 相容性 | 新版 Loader 缺少 max_depth | `pip install "ruamel.yaml<0.18.0"` |
| torch 版本衝突 | diffusers 0.32.0 要求 torch>=2.4 | `pip install "torch>=2.4"` |
| WebM 音訊無法讀取 | soundfile 不支援 WebM | 改用 `librosa.load()` + ffmpeg |
| TTS 輸出參考文字內容 | LLM prompt_text token 傳入導致生成參考文字 | 已 patch 清零 prompt_text token |
| 瀏覽器 multiprocessing 錯誤 | macOS 用 spawn 而非 fork | 加 `if __name__ == '__main__':` guard |

---

## 模型資訊

### Breeze-ASR
- 來源：MediaTek-Research/Breeze-ASR-25（HuggingFace）
- 架構：Whisper fine-tuned，支援台灣普通話與台語
- 本地路徑：`./llm/breeze-raw/`

### BreezyVoice
- 來源：MediaTek-Research/BreezyVoice（HuggingFace）
- 架構：CosyVoice-based zero-shot voice cloning TTS
- 本地路徑：`./llm/BreezyVoice/`
- GitHub：https://github.com/mtkresearch/BreezyVoice
- 效能：Apple M2 MPS 加速，speaker prompt 快取後約 20~50 秒/回應；首次載入會預計算 speaker features

### G2PW
- 用途：多音字注音符號轉換，提升 TTS 合成品質
- 依賴：bert-base-chinese（首次執行自動從 HuggingFace 下載並快取）

---

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/` | 前端頁面 |
| POST | `/api/chat` | 送音訊，取得回應文字與語音 URL |
| GET | `/api/audio/{filename}` | 取得合成語音檔 |
| GET | `/api/health` | 服務健康檢查 |
| DELETE | `/api/session/{session_id}` | 清除對話紀錄 |

### POST /api/chat

**Request**: `multipart/form-data`
- `audio`: 音訊檔（WAV/WebM/MP4）
- `session_id`: 對話 session ID（可選，省略時自動建立）

**Response**:
```json
{
  "session_id": "abc123",
  "user_text": "今仔日天氣按怎",
  "reply_text": "今仔日天氣足好，出去踅踅咧嘛無要緊。",
  "audio_url": "/api/audio/reply_abc123.wav"
}
```
