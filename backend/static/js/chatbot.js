// frontend/js/chatbot.js
// Saral Niti — Modern Citizen Chatbot Assistant

const BACKEND_URL = "";

function initChatbot() {
  const chatHTML = `
  <div id="chatbot-widget" class="saral-chat-widget">
    <!-- TOGGLE BUTTON -->
    <button id="chat-toggle" class="chat-fab" onclick="toggleChat()" aria-label="Open Saral Niti Assistant">
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
            <div class="chat-status"><span class="status-dot"></span> Online • Scheme Assistant</div>
          </div>
        </div>
        <button class="chat-header-close" onclick="toggleChat()" aria-label="Close chat">✕</button>
      </div>

      <!-- MESSAGES -->
      <div id="chat-messages" class="chat-body">
        <div class="bot-msg">
          Namaste! 🙏 I am your <strong>Saral Niti Assistant</strong>. Ask me anything about Indian central and state welfare schemes!
        </div>
        
        <!-- QUICK PROMPTS -->
        <div class="chat-quick-tags" id="chatQuickTags">
          <button class="quick-chip" onclick="sendQuickMessage('schemes for farmers')">🌾 Farmer Support</button>
          <button class="quick-chip" onclick="sendQuickMessage('ayushman bharat')">🏥 Free Health Cover</button>
          <button class="quick-chip" onclick="sendQuickMessage('schemes for students')">📚 Scholarships</button>
          <button class="quick-chip" onclick="sendQuickMessage('schemes for women')">👩 Women Benefits</button>
        </div>
      </div>

      <!-- INPUT BAR -->
      <div class="chat-footer">
        <input 
          id="chat-input" 
          type="text" 
          placeholder="Ask a question about any scheme..."
          onkeypress="handleKey(event)"
          autocomplete="off"
        />
        <button id="chatSendBtn" onclick="sendMessage()" aria-label="Send message">
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
      width: 360px;
      height: 480px;
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(11, 19, 43, 0.2);
      border: 1px solid rgba(226, 232, 240, 0.9);
      margin-bottom: 16px;
      overflow: hidden;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .chat-header {
      background: linear-gradient(135deg, #0B132B 0%, #1C2541 100%);
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #FF6B00;
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
      gap: 12px;
      background: #F8FAFC;
    }
    
    .bot-msg {
      background: #FFFFFF;
      color: #1E293B;
      border-radius: 14px 14px 14px 2px;
      padding: 12px 16px;
      max-width: 85%;
      font-size: 13.5px;
      line-height: 1.55;
      align-self: flex-start;
      white-space: pre-line;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
      border: 1px solid #E2E8F0;
    }
    
    .user-msg {
      background: linear-gradient(135deg, #FF6B00 0%, #E65A00 100%);
      color: white;
      border-radius: 14px 14px 2px 14px;
      padding: 10px 16px;
      max-width: 82%;
      font-size: 13.5px;
      line-height: 1.5;
      align-self: flex-end;
      box-shadow: 0 3px 10px rgba(255, 107, 0, 0.25);
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
      padding: 12px 14px;
      background: #FFFFFF;
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
    
    .chat-footer button {
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
    .chat-footer button:hover {
      background: #E65A00;
      transform: scale(1.05);
    }
    .chat-footer button:active {
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

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  // Hide quick tags on first interaction
  const quickTags = document.getElementById('chatQuickTags');
  if (quickTags) quickTags.style.display = 'none';

  appendMessage(message, 'user');
  input.value = '';

  // Show typing indicator
  const typingId = showTypingIndicator();

  try {
    const response = await fetch(`${BACKEND_URL}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    removeTypingIndicator(typingId);
    appendMessage(data.reply || "I didn't catch that. Could you please rephrase?", 'bot');
  } catch (err) {
    removeTypingIndicator(typingId);
    appendMessage("Sorry, I'm currently unable to connect. Please try again shortly.", 'bot');
  }
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'bot-msg';
  div.innerHTML = `<span style="display:inline-flex;gap:4px;align-items:center;">
    <i class="fa-solid fa-circle fa-beat" style="font-size:6px;color:#FF6B00;"></i>
    <i class="fa-solid fa-circle fa-beat" style="font-size:6px;color:#FF6B00;animation-delay:0.2s;"></i>
    <i class="fa-solid fa-circle fa-beat" style="font-size:6px;color:#FF6B00;animation-delay:0.4s;"></i>
  </span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendMessage(text, sender) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = sender === 'bot' ? 'bot-msg' : 'user-msg';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Auto-init when page loads
document.addEventListener('DOMContentLoaded', initChatbot);