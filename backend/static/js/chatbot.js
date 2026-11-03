// backend/static/js/chatbot.js
// Saral Niti — Production-Grade Vernacular Voice & RAG Chatbot
// Features: Code-Mixed NLU, Web Speech Recognition & Synthesis, Inline Scheme Cards & Follow-ups

const CHAT_BACKEND_URL = (typeof window !== 'undefined' && (
  window.SARAL_API_BASE ||
  document.querySelector('meta[name="backend-api"]')?.getAttribute('content') ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
    ? 'http://127.0.0.1:5000'
    : '')
)) || '';

let recognition = null;
let isRecording = false;

function escapeChatHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeChatUrl(url) {
  if (!url) return '#';
  const clean = String(url).trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  return '#';
}

function initChatbot() {
  if (document.getElementById('chatbot-widget')) return;

  const chatHTML = `
  <div id="chatbot-widget" class="saral-chat-widget">
    <!-- TOGGLE BUTTON -->
    <button id="chat-toggle" class="chat-fab" onclick="toggleChat()" aria-label="Open Saral Niti Sahayak">
      <div class="fab-pulse"></div>
      <i class="fa-solid fa-comments chat-open-icon"></i>
      <i class="fa-solid fa-xmark chat-close-icon" style="display:none;"></i>
      <span class="chat-badge-dot"></span>
    </button>

    <!-- CHAT BOX -->
    <div id="chat-box" class="chat-card">
      <!-- HEADER -->
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-avatar">
            <span>🇮🇳</span>
          </div>
          <div>
            <div class="chat-title">Saral Niti Sahayak</div>
            <div class="chat-status">
              <span class="status-dot"></span>
              <span>Online • Voice & Scheme RAG</span>
            </div>
          </div>
        </div>
        <div class="chat-header-actions">
          <span class="chat-lang-tag" title="Voice & Text supports Hindi, English & Hinglish"><i class="fa-solid fa-language"></i> Hi/En</span>
          <button class="chat-header-close" onclick="toggleChat()" aria-label="Close chat">✕</button>
        </div>
      </div>

      <!-- MESSAGES CONTAINER -->
      <div id="chat-messages" class="chat-body">
        <div class="bot-msg-wrap">
          <div class="bot-msg-header">
            <span class="bot-label">Saral Niti Sahayak</span>
            <button class="speech-btn" onclick="speakFromElement(this)" title="Listen to response" aria-label="Listen">
              <i class="fa-solid fa-volume-high"></i>
            </button>
          </div>
          <div class="bot-msg">
            Namaste! 🙏 I am your <strong>Saral Niti Sahayak</strong>. 
            You can type or speak in <strong>Hindi, Hinglish, or English</strong>.
            Ask me about any central or state government scheme, eligibility, or benefits!
          </div>
        </div>
        
        <!-- INITIAL QUICK PROMPTS -->
        <div class="chat-quick-tags" id="chatQuickTags">
          <button class="quick-chip" onclick="sendQuickMessage('PM-KISAN eligibility for farmers')">🌾 PM-KISAN Farmer Support</button>
          <button class="quick-chip" onclick="sendQuickMessage('Ayushman Bharat free health card')">🏥 Ayushman ₹5 Lakh Health Cover</button>
          <button class="quick-chip" onclick="sendQuickMessage('Post-matric scholarships for SC ST OBC students')">📚 Scholarships for Students</button>
          <button class="quick-chip" onclick="sendQuickMessage('Kutcha makan ke liye PM Awas Yojana')">🏠 PM Awas Housing Scheme</button>
        </div>
      </div>

      <!-- INPUT BAR WITH VOICE MIC -->
      <div class="chat-footer">
        <button id="chatMicBtn" class="chat-mic-btn" type="button" onclick="toggleVoiceInput()" aria-label="Speak in Hindi or English" title="Speak in Hindi/English">
          <i class="fa-solid fa-microphone"></i>
        </button>
        <input 
          id="chat-input" 
          type="text" 
          placeholder="Type or tap mic to speak in Hindi/English..."
          onkeypress="handleKey(event)"
          autocomplete="off"
        />
        <button id="chatSendBtn" class="chat-send-btn" onclick="sendMessage()" aria-label="Send message">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', chatHTML);
  injectChatStyles();
}

function injectChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .saral-chat-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: var(--font-sans, 'Sora', sans-serif);
    }
    
    .chat-fab {
      position: relative;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #FF6B00 0%, #FF8C3A 100%);
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(255, 107, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
    }
    .chat-fab:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 28px rgba(255, 107, 0, 0.5);
    }
    .chat-fab:active {
      transform: scale(0.95);
    }
    
    .fab-pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid rgba(255, 107, 0, 0.4);
      animation: pulseGlow 2s infinite;
      pointer-events: none;
    }
    
    .chat-badge-dot {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      background: #10B981;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
    }
    
    .chat-card {
      display: none;
      flex-direction: column;
      width: 380px;
      height: 520px;
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(11, 19, 43, 0.22);
      border: 1px solid rgba(226, 232, 240, 0.9);
      margin-bottom: 16px;
      overflow: hidden;
      animation: chatSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes chatSlideUp {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    .chat-header {
      background: linear-gradient(135deg, #0B132B 0%, #1C2541 100%);
      color: white;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #FF6B00;
    }
    
    .chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .chat-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border: 1.5px solid rgba(255, 255, 255, 0.25);
    }
    
    .chat-title {
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    
    .chat-status {
      font-size: 11px;
      color: #94A3B8;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }
    
    .status-dot {
      width: 6px;
      height: 6px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 0 0 6px #10B981;
    }
    
    .chat-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chat-lang-tag {
      background: rgba(255, 255, 255, 0.12);
      color: #F8FAFC;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    
    .chat-header-close {
      background: rgba(255, 255, 255, 0.12);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background 0.2s;
    }
    .chat-header-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    
    .chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: #F8FAFC;
    }

    .bot-msg-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-self: flex-start;
      max-width: 90%;
    }

    .bot-msg-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
    }

    .bot-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .speech-btn {
      background: transparent;
      border: none;
      color: #64748B;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.2s;
    }
    .speech-btn:hover {
      color: #FF6B00;
    }
    .speech-btn.speaking {
      color: #DC2626;
      animation: pulseSpeaking 1s infinite alternate;
    }

    @keyframes pulseSpeaking {
      from { transform: scale(1); }
      to { transform: scale(1.15); }
    }
    
    .bot-msg {
      background: #FFFFFF;
      color: #1E293B;
      border-radius: 14px 14px 14px 2px;
      padding: 12px 16px;
      font-size: 13.5px;
      line-height: 1.55;
      white-space: pre-line;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
      border: 1px solid #E2E8F0;
    }
    
    .user-msg {
      background: linear-gradient(135deg, #FF6B00 0%, #E65A00 100%);
      color: white;
      border-radius: 14px 14px 2px 14px;
      padding: 10px 16px;
      max-width: 84%;
      font-size: 13.5px;
      line-height: 1.5;
      align-self: flex-end;
      box-shadow: 0 3px 10px rgba(255, 107, 0, 0.25);
      word-break: break-word;
    }
    
    /* Inline Scheme Cards in Chat */
    .chat-scheme-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-left: 3.5px solid #FF6B00;
      border-radius: 10px;
      padding: 10px 12px;
      margin-top: 6px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    }
    .chat-scheme-badge {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 700;
      color: #047857;
      background: #ECFDF5;
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: capitalize;
      margin-bottom: 4px;
    }
    .chat-scheme-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #0B132B;
      line-height: 1.35;
      margin-bottom: 4px;
    }
    .chat-scheme-benefit {
      font-size: 11.5px;
      color: #475569;
      line-height: 1.4;
      margin-bottom: 8px;
    }
    .chat-scheme-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 700;
      color: #FF6B00;
      text-decoration: none;
      background: #FFF7ED;
      border: 1px solid #FFEDD5;
      padding: 4px 10px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .chat-scheme-btn:hover {
      background: #FF6B00;
      color: #FFFFFF;
      border-color: #FF6B00;
    }

    .chat-quick-tags {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }
    
    .quick-chip {
      background: white;
      border: 1px solid #E2E8F0;
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 12px;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .quick-chip:hover {
      background: #FFF4ED;
      border-color: #FED7AA;
      color: #C2410C;
      transform: translateX(3px);
    }
    
    .chat-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid #E2E8F0;
      padding: 10px 14px;
      background: #FFFFFF;
    }

    .chat-mic-btn {
      background: #F1F5F9;
      color: #475569;
      border: 1px solid #CBD5E1;
      border-radius: 10px;
      width: 38px;
      height: 38px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      transition: all 0.2s;
    }
    .chat-mic-btn:hover {
      background: #E2E8F0;
      color: #0B132B;
    }
    .chat-mic-btn.recording {
      background: #FEF2F2;
      color: #DC2626;
      border-color: #F87171;
      animation: pulseMic 1.2s infinite;
    }

    @keyframes pulseMic {
      0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
    }
    
    .chat-footer input {
      flex: 1;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      outline: none;
      padding: 10px 14px;
      font-size: 13px;
      font-family: inherit;
      color: #0F172A;
      background: #F8FAFC;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .chat-footer input:focus {
      border-color: #FF6B00;
      background: white;
      box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.15);
    }
    
    .chat-send-btn {
      background: #FF6B00;
      color: white;
      border: none;
      border-radius: 10px;
      width: 38px;
      height: 38px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: background 0.2s, transform 0.15s;
      box-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
    }
    .chat-send-btn:hover {
      background: #E65A00;
      transform: scale(1.05);
    }
    .chat-send-btn:active {
      transform: scale(0.95);
    }

    @media (max-width: 480px) {
      .chat-card {
        width: calc(100vw - 32px);
        height: 75vh;
        right: 16px;
        bottom: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

function toggleChat() {
  const box = document.getElementById('chat-box');
  const openIcon = document.querySelector('.chat-open-icon');
  const closeIcon = document.querySelector('.chat-close-icon');
  if (!box) return;
  const isHidden = box.style.display === 'none' || !box.style.display;

  box.style.display = isHidden ? 'flex' : 'none';
  if (openIcon && closeIcon) {
    openIcon.style.display = isHidden ? 'none' : 'block';
    closeIcon.style.display = isHidden ? 'block' : 'none';
  }

  if (isHidden) {
    const input = document.getElementById('chat-input');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

function handleKey(event) {
  if (event.key === 'Enter') sendMessage();
}

function sendQuickMessage(query) {
  const input = document.getElementById('chat-input');
  if (input) input.value = query;
  sendMessage();
}

// ══════════════════════════════════════════════════
//  WEB NATIVE SPEECH RECOGNITION (Speech-to-Text)
// ══════════════════════════════════════════════════
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'hi-IN'; // Recognizes Hindi and Indian English seamlessly

  rec.onstart = () => {
    isRecording = true;
    const micBtn = document.getElementById('chatMicBtn');
    const input = document.getElementById('chat-input');
    if (micBtn) micBtn.classList.add('recording');
    if (input) input.placeholder = '🎙️ Listening... (Aap bol sakte hain)';
  };

  rec.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    const input = document.getElementById('chat-input');
    if (input) input.value = transcript;
  };

  rec.onerror = (event) => {
    console.warn('Speech recognition status:', event.error);
    stopVoiceInput();
  };

  rec.onend = () => {
    stopVoiceInput();
    const input = document.getElementById('chat-input');
    if (input && input.value.trim().length > 0) {
      sendMessage();
    }
  };

  return rec;
}

function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    return;
  }

  if (!recognition) {
    recognition = initSpeechRecognition();
  }

  if (isRecording) {
    try { recognition.stop(); } catch (e) {}
    stopVoiceInput();
  } else {
    try {
      recognition.start();
    } catch (e) {
      recognition = initSpeechRecognition();
      if (recognition) recognition.start();
    }
  }
}

function stopVoiceInput() {
  isRecording = false;
  const micBtn = document.getElementById('chatMicBtn');
  const input = document.getElementById('chat-input');
  if (micBtn) micBtn.classList.remove('recording');
  if (input) input.placeholder = 'Type or tap mic to speak in Hindi/English...';
}

// ══════════════════════════════════════════════════
//  WEB NATIVE SPEECH SYNTHESIS (Text-to-Speech)
// ══════════════════════════════════════════════════
function speakFromElement(btn) {
  const wrap = btn.closest('.bot-msg-wrap');
  if (!wrap) return;
  const msgEl = wrap.querySelector('.bot-msg');
  if (!msgEl) return;
  speakMessage(btn, msgEl.textContent);
}

function speakMessage(btn, rawText) {
  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech audio is not supported by your browser.');
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.speech-btn').forEach(b => {
      b.classList.remove('speaking');
      b.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    });
    if (btn.getAttribute('data-speaking') === 'true') {
      btn.setAttribute('data-speaking', 'false');
      return;
    }
  }

  // Clean markdown syntax, links, and emojis for smooth voice synthesis
  const cleanText = rawText
    .replace(/[#*_~`]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  // Detect if text contains Hindi Devanagari script
  const isHindi = /[\u0900-\u097F]/.test(cleanText);
  utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
  utterance.rate = 0.95;

  btn.setAttribute('data-speaking', 'true');
  btn.classList.add('speaking');
  btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';

  utterance.onend = () => {
    btn.setAttribute('data-speaking', 'false');
    btn.classList.remove('speaking');
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  };

  utterance.onerror = () => {
    btn.setAttribute('data-speaking', 'false');
    btn.classList.remove('speaking');
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  };

  window.speechSynthesis.speak(utterance);
}

// ══════════════════════════════════════════════════
//  MESSAGE SENDING & CARD RENDERING
// ══════════════════════════════════════════════════
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const quickTags = document.getElementById('chatQuickTags');
  if (quickTags) quickTags.style.display = 'none';

  appendUserMessage(message);
  input.value = '';

  const typingId = showTypingIndicator();

  try {
    const response = await fetch(`${CHAT_BACKEND_URL}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    removeTypingIndicator(typingId);

    if (data.status === 'ok' || data.reply) {
      appendBotResponse(data);
    } else {
      appendBotSimpleMessage(data.error || "I didn't catch that. Could you please rephrase?");
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    appendBotSimpleMessage("Sorry, I'm currently unable to connect to the scheme knowledge base. Please try again shortly.");
  }
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'bot-msg-wrap';
  div.innerHTML = `
    <div class="bot-msg" style="padding: 10px 14px;">
      <span style="display:inline-flex;gap:4px;align-items:center;">
        <i class="fa-solid fa-circle fa-beat" style="font-size:6px;color:#FF6B00;"></i>
        <i class="fa-solid fa-circle fa-beat" style="font-size:6px;color:#FF6B00;animation-delay:0.2s;"></i>
        <i class="fa-solid fa-circle fa-beat" style="font-size:6px;color:#FF6B00;animation-delay:0.4s;"></i>
      </span>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'user-msg';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendBotSimpleMessage(text) {
  const container = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = 'bot-msg-wrap';
  wrap.innerHTML = `
    <div class="bot-msg-header">
      <span class="bot-label">Saral Niti Sahayak</span>
      <button class="speech-btn" onclick="speakFromElement(this)" title="Listen" aria-label="Listen">
        <i class="fa-solid fa-volume-high"></i>
      </button>
    </div>
    <div class="bot-msg">${escapeChatHtml(text)}</div>
  `;
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function appendBotResponse(data) {
  const container = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = 'bot-msg-wrap';

  const replyText = data.reply || '';
  const schemes = Array.isArray(data.matched_schemes) ? data.matched_schemes : [];
  const followups = Array.isArray(data.suggested_followups) ? data.suggested_followups : [];

  // Build scheme cards HTML
  let cardsHtml = '';
  if (schemes.length > 0) {
    cardsHtml = schemes.map(s => {
      const safeTitle = escapeChatHtml(s.title || '');
      const safeCat = escapeChatHtml(s.category || 'general');
      const safeBenefit = escapeChatHtml(s.benefits || 'Government welfare support');
      const safeUrl = sanitizeChatUrl(s.application_url);

      return `
        <div class="chat-scheme-card">
          <span class="chat-scheme-badge">${safeCat}</span>
          <div class="chat-scheme-title">${safeTitle}</div>
          <div class="chat-scheme-benefit"><i class="fa-solid fa-gift"></i> ${safeBenefit}</div>
          <div class="chat-scheme-actions">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="chat-scheme-btn">
              <span>Apply Official Portal</span>
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // Build follow-up chips HTML
  let followupsHtml = '';
  if (followups.length > 0) {
    followupsHtml = `
      <div class="chat-quick-tags" style="margin-top: 8px;">
        ${followups.map(f => `<button class="quick-chip" onclick="sendQuickMessage('${escapeChatHtml(f)}')">${escapeChatHtml(f)}</button>`).join('')}
      </div>
    `;
  }

  wrap.innerHTML = `
    <div class="bot-msg-header">
      <span class="bot-label">${escapeChatHtml(data.bot || 'Saral Niti Sahayak')}</span>
      <button class="speech-btn" onclick="speakFromElement(this)" title="Listen" aria-label="Listen">
        <i class="fa-solid fa-volume-high"></i>
      </button>
    </div>
    <div class="bot-msg">${escapeChatHtml(replyText)}</div>
    ${cardsHtml}
    ${followupsHtml}
  `;

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

// Auto-init chatbot when page loads
document.addEventListener('DOMContentLoaded', initChatbot);
