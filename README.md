# 台語 AI 即時語音對話 🎙️

仿 ChatGPT 介面的台語即時語音對話服務。說台語、AI 用台語回答、用台語語音播放。

![介面示意](https://via.placeholder.com/800x400?text=Taigi+AI+Chat+Interface)

---

## 功能特色

- **台語語音辨識**：Breeze-ASR（MediaTek Research）
- **台語 AI 回應**：OpenAI GPT-4o，system prompt 強制台語漢字輸出
- **台語語音合成**：BreezyVoice voice cloning TTS，複製指定音色說台語
- **即時對話介面**：ChatGPT 風格深色 UI，支援對話歷史、停止按鈕

---

## 系統需求

- macOS（Apple Silicon 或 Intel）
- Python 3.11
- ffmpeg（`brew install ffmpeg`）
- OpenAI API Key

---

## 安裝

### 1. Clone 專案與模型

```bash
git clone <this-repo> taigi_converse
cd taigi_converse

# BreezyVoice 推論程式碼
git clone https://github.com/mtkresearch/BreezyVoice ./BreezyVoice-code

# 下載模型權重（HuggingFace）
# Breeze-ASR → ./llm/breeze-raw/
# BreezyVoice → ./llm/BreezyVoice/
```

### 2. 安裝 Python 套件

```bash
# 修正 setuptools 版本
pip install "setuptools>=68,<71"

# openai-whisper 需特殊安裝方式
pip install openai-whisper==20231117 --no-build-isolation

# 主要套件
pip install -r requirements.txt

# BreezyVoice 套件（macOS 版）
pip install -r ./BreezyVoice-code/requirements-mac.txt
pip install "ruamel.yaml<0.18.0"

# 升級 torch（解決 diffusers 版本衝突）
pip install "torch>=2.4" "torchaudio>=2.4"
```

### 3. 準備參考音色

錄製一段 5~15 秒的清晰台語或中文語音，儲存為 `./data/tc_speaker.wav`。

### 4. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`：

```env
OPENAI_API_KEY=sk-...
SPEAKER_TEXT=<你在 tc_speaker.wav 中說的文字>
```

其餘欄位保持預設即可。

### 5. 啟動服務

```bash
uvicorn main:app --host 127.0.0.1 --port 8080
```

開啟瀏覽器：**http://localhost:8080**

---

## 使用方式

1. 開啟 http://localhost:8080
2. 按下麥克風按鈕開始錄音
3. 說台語（或中文）
4. 再按一次停止錄音
5. 等待 AI 回應（ASR → LLM → TTS，CPU 上約需 30~120 秒）
6. 自動播放台語語音回應

---

## 架構

```
使用者語音（WebM）
    ↓ POST /api/chat
Breeze-ASR → 文字
    ↓
GPT-4o → 台語漢字回應
    ↓
BreezyVoice TTS → WAV
    ↓
瀏覽器播放
```

---

## 效能說明

Apple M2 MPS 加速已啟用，首次請求會預先快取 speaker prompt 特徵，後續推論更快：

| 步驟 | 時間（Apple M2） |
|------|------|
| ASR（語音辨識） | 5~15 秒 |
| LLM（GPT-4o） | 2~5 秒 |
| TTS 首次（含 speaker 快取） | 30~60 秒 |
| TTS 後續請求 | 20~50 秒（依文字長度） |

---

## 相關模型

| 模型 | 來源 |
|------|------|
| Breeze-ASR | [MediaTek-Research/Breeze-ASR-25](https://huggingface.co/MediaTek-Research/Breeze-ASR-25) |
| BreezyVoice | [MediaTek-Research/BreezyVoice](https://huggingface.co/MediaTek-Research/BreezyVoice) |

---

## License

本專案整合多個開源模型，使用前請確認各模型授權條款。
