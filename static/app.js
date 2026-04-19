'use strict';

const recordBtn   = document.getElementById('recordBtn');
const recordLabel = document.getElementById('recordLabel');
const timerEl     = document.getElementById('timer');
const waveform    = document.getElementById('waveform');
const messages    = document.getElementById('messages');
const statusDot   = document.getElementById('statusDot');
const statusText  = document.getElementById('statusText');
const newChatBtn  = document.getElementById('newChat');
const stopBtn     = document.getElementById('stopBtn');

let mediaRecorder    = null;
let chunks           = [];
let timerInterval    = null;
let startTime        = 0;
let sessionId        = '';
let isRecording      = false;
let isProcessing     = false;
let currentAbort     = null;
let currentThinkingId = null;

// ── Session ────────────────────────────
function newSession() {
  if (sessionId) {
    fetch(`/api/session/${sessionId}`, { method: 'DELETE' }).catch(() => {});
  }
  sessionId = '';
  messages.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">🗣️</div>
      <h2>你好，我是台語 AI 助理</h2>
      <p>按下麥克風鍵，開始用台語說話</p>
    </div>`;
  setStatus('idle', '就緒');
}

newChatBtn.addEventListener('click', newSession);

// ── Stop button ────────────────────────
stopBtn.addEventListener('click', () => {
  if (currentAbort) {
    currentAbort.abort();
  }
  resetProcessing();
  setStatus('idle', '已停止');
});

// ── Status helpers ─────────────────────
function setStatus(type, text) {
  statusDot.className = `status-dot ${type}`;
  statusText.textContent = text;
}

// ── Timer ──────────────────────────────
function startTimer() {
  startTime = Date.now();
  timerEl.classList.remove('hidden');
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerEl.classList.add('hidden');
}

// ── Processing state ───────────────────
function resetProcessing() {
  isProcessing = false;
  currentAbort = null;
  recordBtn.disabled = false;
  stopBtn.classList.add('hidden');
  if (currentThinkingId) {
    removeThinking(currentThinkingId);
    currentThinkingId = null;
  }
}

// ── Recording ─────────────────────────
recordBtn.addEventListener('click', async () => {
  if (isProcessing) return;
  if (!isRecording) {
    await startRecording();
  } else {
    stopRecording();
  }
});

async function startRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('無法存取麥克風，請確認瀏覽器權限。');
    return;
  }

  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    handleRecordingDone();
  };
  mediaRecorder.start();

  isRecording = true;
  recordBtn.classList.add('active');
  recordLabel.textContent = '停止';
  waveform.classList.remove('hidden');
  startTimer();
  setStatus('recording', '錄音中...');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  recordBtn.classList.remove('active');
  recordLabel.textContent = '錄音';
  waveform.classList.add('hidden');
  stopTimer();
}

async function handleRecordingDone() {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  if (blob.size < 1000) {
    setStatus('idle', '就緒');
    return;
  }
  await sendAudio(blob);
}

// ── API call ───────────────────────────
async function sendAudio(blob) {
  isProcessing = true;
  recordBtn.disabled = true;
  stopBtn.classList.remove('hidden');
  setStatus('loading', '辨識中...');

  currentThinkingId = addThinking();
  currentAbort = new AbortController();

  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  if (sessionId) form.append('session_id', sessionId);

  let data;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: form,
      signal: currentAbort.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    data = await res.json();
  } catch (e) {
    if (e.name === 'AbortError') return; // stop button already called resetProcessing
    removeThinking(currentThinkingId);
    currentThinkingId = null;
    showToast(`錯誤：${e.message}`);
    setStatus('error', '發生錯誤');
    resetProcessing();
    return;
  }

  sessionId = data.session_id;
  removeThinking(currentThinkingId);
  currentThinkingId = null;

  addUserMessage(data.user_text);
  addAiMessage(data.reply_text, data.audio_url);

  setStatus('ok', '完成');
  resetProcessing();
}

// ── Message rendering ──────────────────
function removeWelcome() {
  const w = messages.querySelector('.welcome');
  if (w) w.remove();
}

function addUserMessage(text) {
  removeWelcome();
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="avatar">你</div>
    <div class="bubble">
      <div class="label">你說</div>
      ${escHtml(text)}
    </div>`;
  messages.appendChild(row);
  scrollBottom();
}

function addAiMessage(text, audioUrl) {
  removeWelcome();
  const id = 'ai-' + Date.now();
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.id = id;
  row.innerHTML = `
    <div class="avatar">AI</div>
    <div class="bubble">
      <div class="label">AI 回應</div>
      ${escHtml(text)}
      <div class="audio-player">
        <button class="play-btn" title="播放語音">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <audio src="${audioUrl}" preload="auto"></audio>
        <span style="font-size:0.75rem;color:var(--text-muted)">點擊播放台語語音</span>
      </div>
    </div>`;
  messages.appendChild(row);
  scrollBottom();

  const audioEl = row.querySelector('audio');
  const playBtn = row.querySelector('.play-btn');

  // Auto-play
  audioEl.play().catch(() => {});

  playBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl.play();
    } else {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  });
  audioEl.addEventListener('ended', () => {
    setStatus('idle', '就緒');
  });
}

let thinkingCounter = 0;
function addThinking() {
  removeWelcome();
  const id = 'thinking-' + (++thinkingCounter);
  const row = document.createElement('div');
  row.className = 'msg-row ai thinking';
  row.id = id;
  row.innerHTML = `
    <div class="avatar">AI</div>
    <div class="bubble">
      <div class="dot-bounce"><span></span><span></span><span></span></div>
      思考中...
    </div>`;
  messages.appendChild(row);
  scrollBottom();
  return id;
}

function removeThinking(id) {
  document.getElementById(id)?.remove();
}

// ── Utilities ──────────────────────────
function scrollBottom() {
  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimeout;
function showToast(msg) {
  clearTimeout(toastTimeout);
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimeout = setTimeout(() => el.remove(), 4000);
}
