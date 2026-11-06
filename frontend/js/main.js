// ══════════════════════════════════════════════════
//  CONFIG
//  Automatically handles monolithic, local dev, and separate deployments
// ══════════════════════════════════════════════════
const BACKEND_URL = (typeof window !== 'undefined' && (
  window.SARAL_API_BASE ||
  document.querySelector('meta[name="backend-api"]')?.getAttribute('content') ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
    ? 'http://127.0.0.1:5000'
    : '')
)) || '';
const SCHEMES_API = BACKEND_URL;
const ML_API      = BACKEND_URL;

let allSchemes = [];
let currentSchemesList = [];

// Helper: Escape HTML entities to prevent XSS injection
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper: Sanitize URL to only allow valid http/https schemes
function sanitizeUrl(url) {
  if (!url) return '#';
  const clean = String(url).trim();
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  return '#';
}

// Debounce helper to prevent excessive API requests on keystroke
function debounce(func, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// ══════════════════════════════════════════════════
//  SARAL OFFLINE ENGINE (Gram Panchayat PWA Cache)
// ══════════════════════════════════════════════════
const OFFLINE_SCHEMES_STORAGE_KEY = 'saral_panchayat_schemes_cache';
const MAX_OFFLINE_CACHED_SCHEMES = 350;

function getOfflineCachedSchemes() {
  try {
    const raw = localStorage.getItem(OFFLINE_SCHEMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveSchemesToOfflineCache(schemes) {
  if (!Array.isArray(schemes) || schemes.length === 0) return;
  try {
    const existing = getOfflineCachedSchemes();
    const map = new Map();
    // Keep newer schemes first
    schemes.forEach(s => {
      if (s && (s.id || s._id)) {
        map.set(String(s.id || s._id), s);
      }
    });
    existing.forEach(s => {
      const key = String(s.id || s._id);
      if (!map.has(key)) map.set(key, s);
    });
    const combined = Array.from(map.values()).slice(0, MAX_OFFLINE_CACHED_SCHEMES);
    localStorage.setItem(OFFLINE_SCHEMES_STORAGE_KEY, JSON.stringify(combined));
  } catch (e) {
    console.warn('[OfflineCache] Storage notice:', e);
  }
}

function searchOfflineSchemes(q) {
  const store = getOfflineCachedSchemes();
  if (!q || !q.trim()) return store.slice(0, 24);
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  
  const scored = [];
  store.forEach(s => {
    let score = 0;
    const title = (s.title || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    const cat = (s.category || '').toLowerCase();
    const min = (s.ministry || '').toLowerCase();
    const ben = (s.benefits || '').toLowerCase();
    const tags = Array.isArray(s.tags) ? s.tags.join(' ').toLowerCase() : '';

    terms.forEach(term => {
      if (title.includes(term)) score += 10;
      if (cat.includes(term)) score += 6;
      if (tags.includes(term)) score += 5;
      if (min.includes(term)) score += 4;
      if (desc.includes(term)) score += 2;
      if (ben.includes(term)) score += 2;
    });

    if (score > 0) scored.push({ scheme: s, score });
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(item => item.scheme);
}

function filterOfflineSchemes(payload) {
  const store = getOfflineCachedSchemes();
  return store.filter(s => {
    if (payload.category && payload.category !== 'all' && payload.category !== '') {
      if ((s.category || '').toLowerCase() !== payload.category.toLowerCase()) return false;
    }
    if (payload.state && payload.state !== 'all' && payload.state !== '') {
      const lvl = (s.level || '').toLowerCase();
      const stateMatch = lvl.includes(payload.state.toLowerCase()) || (s.title || '').toLowerCase().includes(payload.state.toLowerCase());
      if (!stateMatch && lvl !== 'central' && lvl !== 'national') return false;
    }
    return true;
  });
}

function updateOnlineStatus(isOnline) {
  const banner = document.getElementById('offlineBanner');
  const bannerText = document.getElementById('offlineBannerText');
  if (!banner) return;

  if (!isOnline) {
    banner.classList.remove('online-sync');
    if (bannerText) {
      bannerText.innerHTML = '<strong>📡 Offline Mode Active (Gram Panchayat Cache)</strong> — Browsing cached schemes & Welfare Passbook.';
    }
    banner.style.display = 'block';
  } else {
    banner.classList.add('online-sync');
    if (bannerText) {
      bannerText.innerHTML = '<strong>🟢 Reconnected to Saral Niti Network</strong> — Live scheme sync enabled.';
    }
    banner.style.display = 'block';
    setTimeout(() => {
      banner.style.display = 'none';
      banner.classList.remove('online-sync');
    }, 3500);
  }
}

function retryConnection() {
  const bannerText = document.getElementById('offlineBannerText');
  if (bannerText) bannerText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking network connection...';
  fetch(`${SCHEMES_API}/api/health`, { cache: 'no-cache', method: 'GET' })
    .then((res) => {
      if (res.ok) {
        updateOnlineStatus(true);
        loadSchemes(1, false);
      } else {
        updateOnlineStatus(false);
      }
    })
    .catch(() => {
      updateOnlineStatus(false);
    });
}

// ══════════════════════════════════════════════════
//  LOAD SCHEMES
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
//  SCHEME LOADING & SEAMLESS 24-BATCH INFINITE BROWSING
// ══════════════════════════════════════════════════
const PAGE_SIZE = 24;
let currentPage = 1;
let totalAvailableSchemes = 0;
let hasMoreServerSchemes = true;
let isLoadingNextBatch = false;
let autoScrollObserver = null;
let isServerBrowsing = true; // True when browsing master DB; False when browsing client-side filter/search array

const CATEGORY_ICONS = {
  agriculture: '🌾',
  health: '🏥',
  education: '📚',
  housing: '🏠',
  employment: '💼',
  women: '👩',
  financial: '💰',
  elderly: '👴',
  youth: '🧑',
  disability: '♿'
};

function renderSkeletons() {
  const grid = document.getElementById('schemesGrid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="scheme-skeleton-card">
      <div class="skeleton" style="height:22px; width:90px; border-radius:12px; margin-bottom:16px;"></div>
      <div class="skeleton" style="height:24px; width:80%; margin-bottom:12px;"></div>
      <div class="skeleton" style="height:14px; width:100%; margin-bottom:8px;"></div>
      <div class="skeleton" style="height:14px; width:70%; margin-bottom:20px;"></div>
      <div class="skeleton" style="height:44px; width:100%; border-radius:10px; margin-bottom:20px;"></div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="skeleton" style="height:14px; width:45%;"></div>
        <div class="skeleton" style="height:32px; width:80px; border-radius:8px;"></div>
      </div>
    </div>
  `).join('');
}

/**
 * Formats a clean, readable short description snippet for scheme cards.
 * Prevents awkward mid-word breaks and excessive text overflow.
 */
function formatCardSnippet(text, maxLen = 110) {
  if (!text) return 'Explore scheme guidelines, eligibility criteria, and benefits.';
  let clean = String(text).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  clean = clean.replace(/^[-*•|\s]+/, '');
  if (clean.length <= maxLen) return clean;

  const sub = clean.slice(0, maxLen);
  const lastSpace = sub.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.5 ? sub.slice(0, lastSpace) : sub;
  return cut.replace(/[,;:.!?\-–\s]+$/, '') + '...';
}

/**
 * Extracts and formats the primary benefit highlight for scheme cards.
 * If multiple benefits are separated by pipes '|' or newlines, takes the first substantive point.
 * Truncates gracefully to fit within 2 card lines (~95 chars).
 */
function formatCardBenefit(benefits, maxLen = 95) {
  if (!benefits) return 'Financial assistance & citizen welfare support';
  let str = String(benefits).trim();

  // If piped or multiline, isolate the first meaningful bullet point
  if (str.includes('|')) {
    const parts = str.split('|').map(p => p.trim()).filter(Boolean);
    str = parts[0] || str;
  } else if (str.includes('\n')) {
    const parts = str.split('\n').map(p => p.trim()).filter(Boolean);
    str = parts[0] || str;
  }

  // Strip leading bullet dashes, asterisks, pipes, or numbers (e.g. "- The applicant", "1. Financial")
  str = str.replace(/^[-*•|\d.)\s]+/, '').trim();
  str = str.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

  if (!str) return 'Financial assistance & citizen welfare support';
  if (str.length <= maxLen) return str;

  const sub = str.slice(0, maxLen);
  const lastSpace = sub.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.5 ? sub.slice(0, lastSpace) : sub;
  return cut.replace(/[,;:.!?\-–\s]+$/, '') + '...';
}

function formatSchemeCardHTML(s, idx) {
  const icon = CATEGORY_ICONS[s.category] || '🏛';
  const safeCat = escapeHtml(s.category || 'general');
  const safeTitle = escapeHtml(s.title || '');
  const shortDesc = formatCardSnippet(s.description, 110);
  const safeDesc = escapeHtml(shortDesc);
  const shortBenefit = formatCardBenefit(s.benefits, 95);
  const safeBenefits = escapeHtml(shortBenefit);
  const safeMinistry = escapeHtml(s.ministry || '');
  const safeUrl = sanitizeUrl(s.application_url);
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  const applyLabel = isHi ? 'आवेदन करें' : 'Apply';
  const activeDotTitle = isHi ? 'सक्रिय योजना' : 'Active Scheme';

  return `
    <div class="scheme-card fade-in-card" data-index="${idx}" tabindex="0" role="button" aria-label="View details for ${safeTitle}">
      <div>
        <div class="card-top">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="category-badge cat-${safeCat}">${icon} ${safeCat}</span>
            <span class="card-saral-badge" title="3 Golden Questions in Simple Words"><i class="fa-solid fa-wand-magic-sparkles"></i> ${isHi ? 'सरल सारांश' : 'Simple Summary'}</span>
          </div>
          <div class="active-dot" title="${activeDotTitle}"></div>
        </div>
        <div class="card-title">${safeTitle}</div>
        <div class="card-desc" title="${escapeHtml(s.description || '')}">${safeDesc}</div>
        <div class="card-benefit" title="${escapeHtml(s.benefits || '')}">
          <i class="fa-solid fa-gift" style="margin-right:4px;"></i> ${safeBenefits}
        </div>
      </div>
      <div class="card-footer">
        <span class="ministry-name" title="${safeMinistry}"><i class="fa-solid fa-building-columns"></i> ${safeMinistry}</span>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="apply-btn" onclick="event.stopPropagation()">
          <span>${applyLabel}</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>
  `;
}

async function loadSchemes(page = 1, append = false) {
  if (isLoadingNextBatch) return;
  isLoadingNextBatch = true;
  isServerBrowsing = true;

  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');
  const paginationWrap = document.getElementById('paginationWrap');
  const scrollLoader = document.getElementById('infiniteScrollLoader');

  if (!append) {
    currentPage = 1;
    currentSchemesList = [];
    if (autoScrollObserver) autoScrollObserver.disconnect();
    renderSkeletons();
  } else {
    if (scrollLoader) scrollLoader.style.display = 'inline-flex';
  }

  try {
    const res = await fetch(`${SCHEMES_API}/api/schemes?page=${page}&limit=${PAGE_SIZE}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      if (!append && grid) {
        grid.innerHTML = `
          <div class="no-results">
            <h3>Could not load schemes</h3>
            <p>${escapeHtml(data.error || 'Database connection error')}</p>
          </div>`;
        if (count) count.textContent = 'Server error';
      }
      return;
    }

    const fetchedSchemes = data.schemes || [];
    saveSchemesToOfflineCache(fetchedSchemes);
    totalAvailableSchemes = data.total || 0;
    hasMoreServerSchemes = Boolean(data.has_more);
    currentPage = data.page || page;

    const totalEl = document.getElementById('totalCount');
    if (totalEl) totalEl.textContent = totalAvailableSchemes.toLocaleString('en-IN') + '+';

    if (append) {
      const startIndex = currentSchemesList.length;
      currentSchemesList = currentSchemesList.concat(fetchedSchemes);
      if (grid) {
        const newHtml = fetchedSchemes.map((s, idx) => formatSchemeCardHTML(s, startIndex + idx)).join('');
        grid.insertAdjacentHTML('beforeend', newHtml);
      }
    } else {
      currentSchemesList = fetchedSchemes;
      allSchemes = fetchedSchemes;
      if (grid) {
        grid.innerHTML = currentSchemesList.map((s, idx) => formatSchemeCardHTML(s, idx)).join('');
      }
    }

    updateScrollStatus();
  } catch (err) {
    const cached = getOfflineCachedSchemes();
    if (cached && cached.length > 0 && !append) {
      currentSchemesList = cached;
      allSchemes = cached;
      isServerBrowsing = false;
      if (grid) {
        grid.innerHTML = currentSchemesList.map((s, idx) => formatSchemeCardHTML(s, idx)).join('');
      }
      if (count) count.innerHTML = `Showing <strong>${cached.length}</strong> schemes from Gram Panchayat Offline Cache 📡`;
      updateOnlineStatus(false);
    } else if (!append && grid) {
      grid.innerHTML = `
        <div class="no-results">
          <h3>Could not connect to server</h3>
          <p>You appear to be offline with no cached schemes yet. Please connect to internet.</p>
        </div>`;
      if (count) count.textContent = 'Connection error';
      updateOnlineStatus(false);
    }
  } finally {
    isLoadingNextBatch = false;
    if (scrollLoader) scrollLoader.style.display = 'none';
  }
}

function renderSchemes(schemes, resetPage = true) {
  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');
  const resetBtn = document.getElementById('resetBtn');
  const paginationWrap = document.getElementById('paginationWrap');

  if (resetPage) {
    currentPage = 1;
    currentSchemesList = Array.isArray(schemes) ? schemes : [];
    isServerBrowsing = false; // Filter or search result array
    if (autoScrollObserver) autoScrollObserver.disconnect();
  }

  if (resetBtn) {
    const isFiltered = !isServerBrowsing;
    resetBtn.style.display = isFiltered ? 'inline-flex' : 'none';
  }

  if (!currentSchemesList.length) {
    if (grid) {
      grid.innerHTML = `
        <div class="no-results">
          <h3>No schemes found matching your search</h3>
          <p>Try searching for different keywords or select "All Categories".</p>
        </div>`;
    }
    if (count) count.innerHTML = 'Showing <strong>0</strong> schemes';
    if (paginationWrap) paginationWrap.style.display = 'none';
    return;
  }

  const total = currentSchemesList.length;
  const initialCount = Math.min(PAGE_SIZE, total);
  const visible = currentSchemesList.slice(0, initialCount);

  if (grid) {
    grid.innerHTML = visible.map((s, idx) => formatSchemeCardHTML(s, idx)).join('');
  }

  updateScrollStatus();
}

function loadNextBatch() {
  if (isLoadingNextBatch) return;

  if (isServerBrowsing) {
    if (hasMoreServerSchemes) {
      loadSchemes(currentPage + 1, true);
    }
  } else {
    // Client-side array pagination (e.g. search or filter results)
    const total = currentSchemesList.length;
    const currentRendered = document.querySelectorAll('#schemesGrid .scheme-card').length;
    if (currentRendered < total) {
      isLoadingNextBatch = true;
      const scrollLoader = document.getElementById('infiniteScrollLoader');
      if (scrollLoader) scrollLoader.style.display = 'inline-flex';

      setTimeout(() => {
        currentPage++;
        const nextBatch = currentSchemesList.slice(currentRendered, currentRendered + PAGE_SIZE);
        const grid = document.getElementById('schemesGrid');
        if (grid) {
          const newHtml = nextBatch.map((s, idx) => formatSchemeCardHTML(s, currentRendered + idx)).join('');
          grid.insertAdjacentHTML('beforeend', newHtml);
        }
        isLoadingNextBatch = false;
        if (scrollLoader) scrollLoader.style.display = 'none';
        updateScrollStatus();
      }, 80);
    }
  }
}

function setupAutoScrollObserver() { return; // Disabled infinite auto-scroll trap
  if (autoScrollObserver) {
    autoScrollObserver.disconnect();
  }

  const cards = document.querySelectorAll('#schemesGrid .scheme-card');
  if (!cards || cards.length === 0) return;

  const total = isServerBrowsing ? totalAvailableSchemes : currentSchemesList.length;
  const hasMore = isServerBrowsing ? hasMoreServerSchemes : (cards.length < total);

  if (!hasMore) return;

  // Seamless trigger on the 20th scheme of the currently rendered batch
  // When 24 cards are rendered, card at index 19 is the 20th scheme (cards.length - 5 = 19).
  // When 48 cards are rendered, card at index 43 is the 20th scheme of the second batch (cards.length - 5 = 43).
  const targetIndex = Math.max(0, cards.length - 5);
  const targetCard = cards[targetIndex];

  if (!targetCard) return;

  autoScrollObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && !isLoadingNextBatch) {
      autoScrollObserver.disconnect();
      loadNextBatch();
    }
  }, {
    root: null,
    rootMargin: '250px', // Pre-fetch before citizen reaches the bottom for 100% seamless experience
    threshold: 0.1
  });

  autoScrollObserver.observe(targetCard);
}

function updateScrollStatus() {
  const count = document.getElementById('resultsCount');
  const paginationWrap = document.getElementById('paginationWrap');
  const paginationInfo = document.getElementById('paginationInfo');
  const loadMoreBtn = document.getElementById('btnLoadMoreSchemes');
  const cards = document.querySelectorAll('#schemesGrid .scheme-card');
  const displayedCount = cards.length;
  const total = isServerBrowsing ? totalAvailableSchemes : currentSchemesList.length;
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');

  if (count) {
    if (isHi) {
      count.innerHTML = `प्रदर्शित: <strong>${displayedCount}</strong> / कुल <strong>${total.toLocaleString('en-IN')}</strong> प्रमाणित योजनाएं`;
    } else {
      count.innerHTML = `Showing <strong>${displayedCount}</strong> of <strong>${total.toLocaleString('en-IN')}</strong> verified schemes`;
    }
  }

  if (paginationWrap) {
    paginationWrap.style.display = total > 0 ? 'flex' : 'none';
  }

  const hasMore = isServerBrowsing ? hasMoreServerSchemes : (displayedCount < total);

  if (paginationInfo) {
    if (hasMore) {
      paginationInfo.innerHTML = isHi
        ? `प्रदर्शित: <strong>${displayedCount}</strong> / कुल <strong>${total.toLocaleString('en-IN')}</strong> योजनाएं`
        : `Showing <strong>${displayedCount}</strong> of <strong>${total.toLocaleString('en-IN')}</strong> schemes`;
    } else {
      paginationInfo.innerHTML = isHi
        ? `<i class="fa-solid fa-check-circle" style="color:#10B981; margin-right:5px;"></i> सभी <strong>${total.toLocaleString('en-IN')}</strong> योजनाएं लोड हो चुकी हैं`
        : `<i class="fa-solid fa-check-circle" style="color:#10B981; margin-right:5px;"></i> All <strong>${total.toLocaleString('en-IN')}</strong> verified schemes loaded`;
    }
  }

  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    const btnSpan = loadMoreBtn.querySelector('span');
    if (btnSpan) {
      btnSpan.textContent = isHi ? 'और योजनाएं देखें' : 'Load More Schemes';
    }
  }
}

function loadMoreSchemes() {
  loadNextBatch();
}

// Scheme card delegated click and keyboard handlers
const schemesGridEl = document.getElementById('schemesGrid');
if (schemesGridEl) {
  schemesGridEl.addEventListener('click', (e) => {
    const card = e.target.closest('.scheme-card');
    if (!card) return;
    if (e.target.closest('.apply-btn')) return;
    const idx = parseInt(card.getAttribute('data-index'), 10);
    if (!isNaN(idx) && currentSchemesList[idx]) {
      openModal(currentSchemesList[idx]);
    }
  });

  schemesGridEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.scheme-card');
      if (!card || e.target.closest('.apply-btn')) return;
      e.preventDefault();
      const idx = parseInt(card.getAttribute('data-index'), 10);
      if (!isNaN(idx) && currentSchemesList[idx]) {
        openModal(currentSchemesList[idx]);
      }
    }
  });
}

// ══════════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════════
async function handleSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) { loadSchemes(1, false); return; }
  renderSkeletons();
  try {
    const res = await fetch(`${SCHEMES_API}/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      fallbackOfflineSearch(q);
      return;
    }
    const schemes = data.schemes || [];
    renderSchemes(schemes);
    saveSchemesToOfflineCache(schemes);
  } catch {
    fallbackOfflineSearch(q);
  }
}

function fallbackOfflineSearch(q) {
  const offlineMatches = searchOfflineSchemes(q);
  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');
  if (offlineMatches.length > 0) {
    renderSchemes(offlineMatches);
    if (count) count.innerHTML = `Showing <strong>${offlineMatches.length}</strong> offline cached schemes for "${escapeHtml(q)}" 📡`;
  } else {
    if (grid) {
      grid.innerHTML = `
        <div class="no-results">
          <h3>No matching schemes in offline cache</h3>
          <p>You are currently offline. Try general keywords like "kisan", "women", "student", or reconnect to search all 4,800+ online schemes.</p>
        </div>`;
    }
    if (count) count.innerHTML = 'Offline Search (0 results)';
  }
  updateOnlineStatus(false);
}

function quickSearch(term) {
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = term;
    handleSearch();
    const target = document.getElementById('schemes');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }
}

// ══════════════════════════════════════════════════
//  VOICE-FIRST VERNACULAR SEARCH & QUERY NORMALIZER
//  Tier 1: whisper-large-v3-turbo -> Tier 2: whisper-large-v3 -> Tier 3: Native Web Speech
// ══════════════════════════════════════════════════
let voiceMediaRecorder = null;
let voiceAudioChunks = [];
let voiceRecordingTimer = null;
let voiceRecordingStartTime = 0;
let isVoiceRecording = false;
let voiceNativeRecognition = null;

async function toggleVoiceSearch() {
  if (isVoiceRecording) {
    stopVoiceSearch(true);
  } else {
    startVoiceSearch();
  }
}

async function startVoiceSearch() {
  const statusEl = document.getElementById('voiceSearchStatus');
  const statusText = document.getElementById('voiceStatusText');
  const micBtn = document.getElementById('btnVoiceSearch');
  const input = document.getElementById('searchInput');

  // Try MediaRecorder with Groq Tier 1 / Tier 2 (Guarded by 18 RPM ceiling)
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceAudioChunks = [];
      voiceRecordingStartTime = Date.now();

      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      }

      voiceMediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      voiceMediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          voiceAudioChunks.push(e.data);
        }
      };

      voiceMediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const durationMs = Date.now() - voiceRecordingStartTime;

        // Anti-accidental tap guard: ignore recordings < 600ms
        if (durationMs < 600 || voiceAudioChunks.length === 0) {
          if (statusText) statusText.textContent = 'Recording too short. Please speak for at least 1-2 seconds.';
          setTimeout(() => resetVoiceUI(), 1200);
          return;
        }

        const audioBlob = new Blob(voiceAudioChunks, { type: voiceMediaRecorder.mimeType || 'audio/webm' });
        if (audioBlob.size < 300) {
          resetVoiceUI();
          return;
        }
        await submitVoiceRecording(audioBlob);
      };

      voiceMediaRecorder.start();
      isVoiceRecording = true;

      if (micBtn) {
        micBtn.classList.add('recording');
        micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
      }
      if (statusEl) statusEl.style.display = 'flex';
      if (statusText) statusText.textContent = 'सुन रहे हैं... (Listening... Tap stop or mic when done)';
      if (input) input.placeholder = '🎙️ Listening to your voice... (बोलते रहिए)';

      clearTimeout(voiceRecordingTimer);
      voiceRecordingTimer = setTimeout(() => {
        if (isVoiceRecording) stopVoiceSearch(true);
      }, 12000);

      return;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone access was denied. Please allow microphone permissions in your browser address bar to use voice search.');
        resetVoiceUI();
        return;
      }
      console.warn('MediaRecorder not allowed or failed, falling back to Native Web Speech:', err);
    }
  }

  // Tier 3 Fallback: Native Browser Speech Recognition
  startNativeWebSpeechFallback();
}

function stopVoiceSearch(processAudio = true) {
  isVoiceRecording = false;
  clearTimeout(voiceRecordingTimer);

  const micBtn = document.getElementById('btnVoiceSearch');
  if (micBtn) {
    micBtn.classList.remove('recording');
    micBtn.classList.add('processing');
    micBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  const statusText = document.getElementById('voiceStatusText');
  if (statusText) statusText.textContent = 'आवाज़ प्रोसेस हो रही है... (Transcribing & Extracting Schema...)';

  if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
    if (processAudio) {
      voiceMediaRecorder.stop();
    } else {
      voiceAudioChunks = [];
      voiceMediaRecorder.stop();
      resetVoiceUI();
    }
  } else if (voiceNativeRecognition) {
    try { voiceNativeRecognition.stop(); } catch (e) {}
  }
}

function cancelVoiceSearch() {
  stopVoiceSearch(false);
  resetVoiceUI();
}

function resetVoiceUI() {
  isVoiceRecording = false;
  const statusEl = document.getElementById('voiceSearchStatus');
  const micBtn = document.getElementById('btnVoiceSearch');
  const input = document.getElementById('searchInput');

  if (statusEl) statusEl.style.display = 'none';
  if (micBtn) {
    micBtn.classList.remove('recording', 'processing');
    micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
  }
  if (input) input.placeholder = 'Search by scheme name, ministry, or keyword (e.g. farmer, student, health)...';
}

async function submitVoiceRecording(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice_query.webm');

  try {
    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.status === 'fallback' && data.fallback_to_browser_stt) {
      console.warn('Groq STT fallback triggered:', data.message);
      resetVoiceUI();
      startNativeWebSpeechFallback();
      return;
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to process voice query');
    }

    applyVoiceSearchResult(data);

  } catch (err) {
    console.error('Voice transcription error:', err);
    resetVoiceUI();
    if (!navigator.onLine) {
      updateOnlineStatus(false);
      alert('📡 You are currently offline. Multilingual AI voice input requires an internet connection. Please type keywords into the search bar while offline.');
    } else {
      alert('Voice input error: ' + (err.message || 'Please try again or use the search bar.'));
    }
  }
}

function applyVoiceSearchResult(data) {
  resetVoiceUI();

  const input = document.getElementById('searchInput');
  const insightBadge = document.getElementById('voiceInsightBadge');
  const insightText = document.getElementById('voiceInsightText');

  const raw = data.raw_transcript || '';
  const clean = data.clean_search_query || '';
  const schema = data.schema || {};

  if (input && clean) {
    input.value = clean;
  }

  if (insightBadge && insightText) {
    let details = `🎙️ <em>"${escapeHtml(raw)}"</em> → <strong>Cleaned Query:</strong> "${escapeHtml(clean)}"`;
    if (schema.beneficiary) {
      details += ` • <strong>Target:</strong> ${escapeHtml(schema.beneficiary)}`;
    }
    if (schema.category) {
      details += ` • <strong>Sector:</strong> ${escapeHtml(schema.category.toUpperCase())}`;
    }
    insightText.innerHTML = details;
    insightBadge.style.display = 'flex';
  }

  if (data.schemes && data.schemes.length > 0) {
    renderSchemes(data.schemes);
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
      resultsCount.innerHTML = `Showing <strong>${data.schemes.length}</strong> verified schemes matching your voice request`;
    }
    const schemesSection = document.getElementById('schemes');
    if (schemesSection) schemesSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    handleSearch();
  }
}

function clearVoiceInsight() {
  const insightBadge = document.getElementById('voiceInsightBadge');
  if (insightBadge) insightBadge.style.display = 'none';
}

function startNativeWebSpeechFallback() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice recording requires microphone permission or Chrome/Edge/Safari browser.');
    resetVoiceUI();
    return;
  }

  const rec = new SpeechRecognition();
  voiceNativeRecognition = rec;
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = 'hi-IN';

  const micBtn = document.getElementById('btnVoiceSearch');
  const statusEl = document.getElementById('voiceSearchStatus');
  const statusText = document.getElementById('voiceStatusText');
  const input = document.getElementById('searchInput');

  rec.onstart = () => {
    isVoiceRecording = true;
    if (micBtn) {
      micBtn.classList.add('recording');
      micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    }
    if (statusEl) statusEl.style.display = 'flex';
    if (statusText) statusText.textContent = 'Browser Voice Engine: बोलिए (Listening in Hindi/English)...';
    if (input) input.placeholder = '🎙️ Listening via browser speech...';
  };

  rec.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript) {
      if (statusText) statusText.textContent = 'Transcribing & Extracting Schema...';
      try {
        const res = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript })
        });
        const data = await res.json();
        applyVoiceSearchResult(data);
      } catch (e) {
        if (input) input.value = transcript;
        handleSearch();
        resetVoiceUI();
      }
    }
  };

  rec.onerror = (e) => {
    console.warn('Native speech error:', e.error);
    resetVoiceUI();
  };

  rec.onend = () => {
    resetVoiceUI();
  };

  try {
    rec.start();
  } catch (e) {
    resetVoiceUI();
  }
}

// ══════════════════════════════════════════════════
//  MULTI-DIMENSIONAL & CATEGORY FILTERING ENGINE
// ══════════════════════════════════════════════════
function toggleAdvancedFilterDrawer() {
  const drawer = document.getElementById('advFilterDrawer');
  const btn = document.getElementById('advFilterToggleBtn');
  if (!drawer) return;
  const isHidden = drawer.style.display === 'none' || drawer.style.display === '';
  drawer.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', isHidden);
}

function setQuickBenefit(type, btn) {
  document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const sel = document.getElementById('filterBenefitType');
  if (sel) sel.value = type;
  applyAdvancedFilters();
}

function handleAdvancedFilterSubmit(e) {
  if (e) e.preventDefault();
  applyAdvancedFilters();
}

function getFilterPayload() {
  const form = document.getElementById('advFilterForm');
  const activeCatBtn = document.querySelector('.filter-btn.active');
  const category = activeCatBtn ? (activeCatBtn.getAttribute('data-category') || 'all') : 'all';

  if (!form) return { category: category !== 'all' ? category : '' };

  const formData = new FormData(form);
  const vulnerabilities = [];
  form.querySelectorAll('input[name="vulnerabilities"]:checked').forEach(cb => {
    vulnerabilities.push(cb.value);
  });

  const ageVal = formData.get('age');
  const age = ageVal && String(ageVal).trim() !== '' ? Number(ageVal) : null;

  return {
    category: category !== 'all' ? category : '',
    age: age,
    age_group: (formData.get('age_group') || '').trim(),
    gender: (formData.get('gender') || '').trim(),
    social_category: (formData.get('social_category') || '').trim(),
    vulnerabilities: vulnerabilities,
    state: (formData.get('state') || '').trim(),
    location_type: (formData.get('location_type') || '').trim(),
    domicile_status: (formData.get('domicile_status') || '').trim(),
    district: (formData.get('district') || '').trim(),
    income_range: (formData.get('income_range') || '').trim(),
    ration_card: (formData.get('ration_card') || '').trim(),
    housing_status: (formData.get('housing_status') || '').trim(),
    land_ownership: (formData.get('land_ownership') || '').trim(),
    education_level: (formData.get('education_level') || '').trim(),
    occupation: (formData.get('occupation') || '').trim(),
    targeted_profession: (formData.get('targeted_profession') || '').trim(),
    benefit_type: (formData.get('benefit_type') || '').trim(),
    applicant_type: (formData.get('applicant_type') || '').trim(),
    business_stage: (formData.get('business_stage') || '').trim(),
    business_sector: (formData.get('business_sector') || '').trim(),
    page: 1,
    page_size: 0
  };
}

function updateActiveFilterChips(payload) {
  const chipsContainer = document.getElementById('activeFilterChips');
  const activeBar = document.getElementById('activeFiltersBar');
  const countBadge = document.getElementById('advFilterCountBadge');
  const resetBtn = document.getElementById('resetBtn');

  if (!chipsContainer || !activeBar) return;

  const chips = [];

  if (payload.category && payload.category !== 'all') {
    chips.push({ key: 'category', label: `Sector: ${payload.category}` });
  }
  if (payload.age) {
    chips.push({ key: 'age', label: `Age: ${payload.age} yrs` });
  }
  if (payload.age_group) {
    chips.push({ key: 'age_group', label: `Stage: ${payload.age_group}` });
  }
  if (payload.gender) {
    chips.push({ key: 'gender', label: `Gender: ${payload.gender}` });
  }
  if (payload.social_category) {
    chips.push({ key: 'social_category', label: `Category: ${payload.social_category.toUpperCase()}` });
  }
  (payload.vulnerabilities || []).forEach(v => {
    chips.push({ key: 'vulnerability', val: v, label: `Priority: ${v}` });
  });
  if (payload.state) {
    chips.push({ key: 'state', label: `State: ${payload.state}` });
  }
  if (payload.location_type) {
    chips.push({ key: 'location_type', label: `Location: ${payload.location_type}` });
  }
  if (payload.domicile_status) {
    chips.push({ key: 'domicile_status', label: `Domicile: ${payload.domicile_status}` });
  }
  if (payload.district) {
    chips.push({ key: 'district', label: `District: ${payload.district}` });
  }
  if (payload.income_range) {
    chips.push({ key: 'income_range', label: `Income: ${payload.income_range.replace(/_/g, ' ')}` });
  }
  if (payload.ration_card) {
    chips.push({ key: 'ration_card', label: `Ration: ${payload.ration_card.toUpperCase()}` });
  }
  if (payload.housing_status) {
    chips.push({ key: 'housing_status', label: `Housing: ${payload.housing_status}` });
  }
  if (payload.land_ownership) {
    chips.push({ key: 'land_ownership', label: `Land: ${payload.land_ownership}` });
  }
  if (payload.education_level) {
    chips.push({ key: 'education_level', label: `Edu: ${payload.education_level}` });
  }
  if (payload.occupation) {
    chips.push({ key: 'occupation', label: `Occupation: ${payload.occupation}` });
  }
  if (payload.targeted_profession) {
    chips.push({ key: 'targeted_profession', label: `Profession: ${payload.targeted_profession}` });
  }
  if (payload.benefit_type) {
    chips.push({ key: 'benefit_type', label: `Benefit: ${payload.benefit_type.toUpperCase()}` });
  }
  if (payload.applicant_type) {
    chips.push({ key: 'applicant_type', label: `Applicant: ${payload.applicant_type.toUpperCase()}` });
  }
  if (payload.business_stage) {
    chips.push({ key: 'business_stage', label: `Stage: ${payload.business_stage}` });
  }
  if (payload.business_sector) {
    chips.push({ key: 'business_sector', label: `Sector: ${payload.business_sector}` });
  }

  if (chips.length > 0) {
    activeBar.style.display = 'flex';
    if (resetBtn) resetBtn.style.display = 'inline-flex';
    if (countBadge) {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = chips.length;
    }
    chipsContainer.innerHTML = chips.map(c => `
      <span class="active-chip">
        ${escapeHtml(c.label)}
        <button type="button" class="active-chip-remove" onclick="removeActiveFilter('${escapeHtml(c.key)}', '${escapeHtml(c.val || '')}')" aria-label="Remove filter">✕</button>
      </span>
    `).join('');
  } else {
    activeBar.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
    chipsContainer.innerHTML = '';
  }
}

function removeActiveFilter(key, val) {
  if (key === 'category') {
    const allBtn = document.querySelector('.filter-btn[data-category="all"]') || document.querySelector('.filter-btn');
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (allBtn) allBtn.classList.add('active');
  } else if (key === 'vulnerability') {
    const cb = document.querySelector(`input[name="vulnerabilities"][value="${val}"]`);
    if (cb) cb.checked = false;
  } else if (key === 'age') {
    const inp = document.getElementById('filterAge');
    if (inp) inp.value = '';
  } else if (key === 'benefit_type') {
    const sel = document.getElementById('filterBenefitType');
    if (sel) sel.value = '';
    document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
    const allPill = document.querySelector('.quick-pill');
    if (allPill) allPill.classList.add('active');
  } else {
    const el = document.getElementById('filter' + key.charAt(0).toUpperCase() + key.slice(1)) ||
               document.querySelector(`[name="${key}"]`);
    if (el) el.value = '';
  }
  applyAdvancedFilters();
}

async function applyAdvancedFilters() {
  const payload = getFilterPayload();
  updateActiveFilterChips(payload);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  const hasActiveFilters = Object.entries(payload).some(([k, v]) => {
    if (k === 'page' || k === 'page_size') return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== '' && v !== 'all';
  });

  if (!hasActiveFilters) {
    loadSchemes(1, false);
    return;
  }

  renderSkeletons();
  try {
    const res = await fetch(`${SCHEMES_API}/api/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      fallbackOfflineFilter(payload);
      return;
    }
    const schemes = data.schemes || [];
    renderSchemes(schemes);
    saveSchemesToOfflineCache(schemes);
  } catch (err) {
    fallbackOfflineFilter(payload);
  }
}

function fallbackOfflineFilter(payload) {
  const filtered = filterOfflineSchemes(payload);
  renderSchemes(filtered);
  const count = document.getElementById('resultsCount');
  if (count) count.innerHTML = `Showing <strong>${filtered.length}</strong> offline filtered schemes 📡`;
  updateOnlineStatus(false);
}

async function filterByCategory(category, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyAdvancedFilters();
}

function resetAllFilters() {
  const form = document.getElementById('advFilterForm');
  if (form) form.reset();

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const allCatBtn = document.querySelector('.filter-btn[data-category="all"]') || document.querySelector('.filter-btn');
  if (allCatBtn) allCatBtn.classList.add('active');

  document.querySelectorAll('.quick-pill').forEach(p => p.classList.remove('active'));
  const allQuickPill = document.querySelector('.quick-pill');
  if (allQuickPill) allQuickPill.classList.add('active');

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  updateActiveFilterChips({ category: 'all' });
  loadSchemes(1, false);
}

function resetFilters() {
  resetAllFilters();
}


// ══════════════════════════════════════════════════
//  SCHEME DETAIL MODAL & SHARE (XSS-safe)
// ══════════════════════════════════════════════════
let currentModalScheme = null;
let currentModalViewMode = 'saral';

function switchModalViewMode(mode) {
  currentModalViewMode = mode;
  const tabSaral = document.getElementById('tabModeSaral');
  const tabOfficial = document.getElementById('tabModeOfficial');
  const panelSaral = document.getElementById('panelSaralView');
  const panelOfficial = document.getElementById('panelOfficialView');

  if (tabSaral && tabOfficial && panelSaral && panelOfficial) {
    if (mode === 'official') {
      tabSaral.classList.remove('active');
      tabSaral.setAttribute('aria-selected', 'false');
      tabOfficial.classList.add('active');
      tabOfficial.setAttribute('aria-selected', 'true');
      panelSaral.style.display = 'none';
      panelOfficial.style.display = 'block';
    } else {
      tabOfficial.classList.remove('active');
      tabOfficial.setAttribute('aria-selected', 'false');
      tabSaral.classList.add('active');
      tabSaral.setAttribute('aria-selected', 'true');
      panelOfficial.style.display = 'none';
      panelSaral.style.display = 'block';
    }
  }
}

function generateSaralPlainExplainer(s, isHi) {
  if (!s) return '';
  const title = s.title || '';
  const ministry = s.ministry || (isHi ? 'केंद्र/राज्य सरकार' : 'Central/State Government');

  // Major Schemes with Citizen-Tuned Explanations
  const lower = title.toLowerCase();
  if (lower.includes('pm kisan') || lower.includes('kisan samman')) {
    return isHi
      ? 'यह केंद्र सरकार की योजना है, जिसके तहत देश के किसान परिवारों को खेती और खाद-बीज के खर्चे हेतु हर साल <strong>₹6,000 की नकद सहायता</strong> तीन किश्तों (₹2,000-₹2,000) में सीधे बैंक खाते में दी जाती है।'
      : 'A direct welfare initiative by the central government providing <strong>₹6,000 annual income support</strong> in three equal ₹2,000 cash installments directly into farmers’ bank accounts.';
  }
  if (lower.includes('ayushman') || lower.includes('pm-jay')) {
    return isHi
      ? 'यह देश की सबसे बड़ी मुफ़्त स्वास्थ्य योजना है, जिसमें पात्र परिवारों को किसी भी सरकारी या प्राइवेट सूचीबद्ध अस्पताल में <strong>हर साल ₹5 लाख तक का कैशलेस इलाज</strong> मिलता है।'
      : 'India\'s flagship health security program providing <strong>₹5 Lakh free cashless hospital treatment</strong> per year for eligible families in empanelled hospitals.';
  }
  if (lower.includes('awas yojana') || lower.includes('pmay')) {
    return isHi
      ? 'यह बेघर और कच्चे मकान में रहने वाले परिवारों को पक्का मकान बनाने या खरीदने के लिए <strong>सब्सिडी और वित्तीय सहायता</strong> प्रदान करने वाली योजना है।'
      : 'A national housing mission enabling low-income and homeless families to construct or acquire a pucca house with government subsidies.';
  }
  if (lower.includes('mgnrega') || lower.includes('employment guarantee') || lower.includes('मनरेगा')) {
    return isHi
      ? 'यह ग्रामीण परिवारों के वयस्क सदस्यों को साल में कम से कम <strong>100 दिनों के अकुशल काम की कानूनी गारंटी</strong> देती है, जिसमें न्यूनतम मज़दूरी सीधे बैंक खाते में मिलती है।'
      : 'Guarantees <strong>100 days of wage employment</strong> in every financial year to rural households willing to do unskilled manual work with direct bank payouts.';
  }
  if (lower.includes('mudra')) {
    return isHi
      ? 'यह छोटे दुकानदारों, रेहड़ी-पटरी वालों और अपना व्यापार शुरू करने वालों को <strong>बिना किसी गारंटी के ₹50,000 से लेकर ₹10 लाख तक का सस्ता लोन</strong> देती है।'
      : 'Provides <strong>collateral-free business loans up to ₹10 Lakh</strong> to micro-enterprises and small entrepreneurs across Shishu, Kishor, and Tarun tiers.';
  }

  // Dynamic Plain Language Simplifier for general schemes
  if (isHi) {
    return `यह <strong>${escapeHtml(ministry)}</strong> द्वारा चलाई जा रही योजना है। इसका मुख्य उद्देश्य पात्र नागरिकों को बिना किसी बिचौलिए के सीधा सरकारी लाभ पहुँचाना है। आप ऑनलाइन या नज़दीकी जन सेवा केंद्र (CSC) से इसके लिए आवेदन कर सकते हैं।`;
  } else {
    return `An active welfare initiative under the <strong>${escapeHtml(ministry)}</strong> designed to provide direct financial and social support to eligible citizens with streamlined online application.`;
  }
}

function generateSaralQ1Benefits(s, isHi) {
  const rawBen = (s.benefits || '').trim();
  let points = [];
  if (rawBen.includes('|')) {
    points = rawBen.split('|').map(p => p.trim()).filter(Boolean);
  } else if (rawBen.includes('\n')) {
    points = rawBen.split('\n').map(p => p.trim()).filter(Boolean);
  } else if (rawBen) {
    points = [rawBen];
  }

  const cleanPoints = points.slice(0, 5).map(pt => {
    let p = pt.replace(/^[-*•|\d.)\s]+/, '').trim();
    if (isHi) {
      p = p.replace(/Rs\.?\s*(\d+)/gi, '₹$1')
           .replace(/\bper year\b/gi, 'प्रति वर्ष')
           .replace(/\bper month\b/gi, 'प्रति माह')
           .replace(/\binstallments?\b/gi, 'किश्तों')
           .replace(/\bhospitalization\b/gi, 'अस्पताल में भर्ती व इलाज')
           .replace(/\bcollateral-free\b/gi, 'बिना गारंटी')
           .replace(/\bsubsidy\b/gi, 'सरकारी सब्सिडी (छूट)');
    }
    return p;
  });

  const isDbt = (s.tags || []).some(t => /dbt|cash|pension|stipend|financial/i.test(t)) || /Rs\.?|₹|subsidy|loan|pension/i.test(rawBen);
  const dbtBadge = isDbt ? `
    <div class="saral-benefit-hero">
      <i class="fa-solid fa-money-bill-transfer"></i>
      <span>${isHi ? 'सीधे बैंक खाते में सहायता (DBT)' : 'Direct Bank Benefit (DBT Transfer)'}</span>
    </div>
  ` : '';

  const listItems = cleanPoints.map(p => `
    <li>
      <i class="fa-solid fa-circle-check"></i>
      <span>${escapeHtml(p)}</span>
    </li>
  `).join('');

  return `
    ${dbtBadge}
    <ul class="saral-benefit-points">
      ${listItems || `<li><i class="fa-solid fa-circle-check"></i> <span>${isHi ? 'विभागीय दिशा-निर्देशों के अनुसार सरकारी सहायता व लाभ' : 'Government welfare aid as per departmental guidelines'}</span></li>`}
    </ul>
  `;
}

function generateSaralQ2Eligibility(s, isHi) {
  const e = s.eligibility || {};

  let ageText = isHi ? 'कोई आयु सीमा नहीं (सभी उम्र)' : 'No age limit (All ages)';
  if (e.min_age && e.max_age) {
    ageText = isHi ? `${e.min_age} से ${e.max_age} वर्ष के बीच` : `Between ${e.min_age} and ${e.max_age} years`;
  } else if (e.min_age) {
    ageText = isHi ? `${e.min_age} वर्ष या उससे अधिक` : `${e.min_age} years and above`;
  } else if (e.max_age) {
    ageText = isHi ? `अधिकतम ${e.max_age} वर्ष तक` : `Up to ${e.max_age} years`;
  }

  let genderText = isHi ? 'सभी नागरिक (महिला व पुरुष)' : 'All Citizens (Men & Women)';
  if (e.gender === 'female') {
    genderText = isHi ? 'केवल महिलाएं व बेटियां' : 'Exclusively for Women & Girls';
  } else if (e.gender === 'male') {
    genderText = isHi ? 'केवल पुरुष' : 'Men only';
  } else if (e.gender === 'transgender') {
    genderText = isHi ? 'ट्रांसजेंडर नागरिक' : 'Transgender Citizens';
  }

  let incomeText = isHi ? 'आय की कोई सीमा नहीं' : 'No income ceiling';
  if (e.income_limit) {
    incomeText = isHi ? `सालाना आय ₹${Number(e.income_limit).toLocaleString('en-IN')} से कम` : `Household income under ₹${Number(e.income_limit).toLocaleString('en-IN')} / yr`;
  }

  let stateText = isHi ? 'पूरे भारत के नागरिक पात्र' : 'Pan-India (All States & UTs)';
  if (e.state && e.state !== 'all') {
    stateText = isHi ? `${e.state} के स्थायी निवासी` : `Resident of ${e.state}`;
  }

  let occText = isHi ? 'सभी कामगार व परिवार' : 'All Vocations & General Public';
  if (Array.isArray(e.occupation) && e.occupation.length > 0) {
    const mapOccHi = {
      farmer: 'किसान व खेतिहर मजदूर',
      student: 'विद्यार्थी (स्कूल/कॉलेज)',
      business: 'छोटे दुकानदार व व्यापारी',
      'self-employed': 'स्वरोजगार',
      unemployed: 'बेरोज़गार युवा',
      daily_wage: 'दैनिक मजदूर / श्रमिक'
    };
    occText = isHi
      ? e.occupation.map(o => mapOccHi[o] || o).join(', ')
      : e.occupation.map(o => o.charAt(0).toUpperCase() + o.slice(1)).join(', ');
  }

  return `
    <div class="saral-elig-grid">
      <div class="saral-elig-chip">
        <i class="fa-solid fa-cake-candles saral-elig-chip-icon"></i>
        <div>
          <div class="saral-elig-chip-label">${isHi ? 'उम्र सीमा' : 'Age Limit'}</div>
          <div class="saral-elig-chip-val">${escapeHtml(ageText)}</div>
        </div>
      </div>

      <div class="saral-elig-chip">
        <i class="fa-solid fa-indian-rupee-sign saral-elig-chip-icon"></i>
        <div>
          <div class="saral-elig-chip-label">${isHi ? 'पारिवारिक आय' : 'Annual Income'}</div>
          <div class="saral-elig-chip-val">${escapeHtml(incomeText)}</div>
        </div>
      </div>

      <div class="saral-elig-chip">
        <i class="fa-solid fa-venus-mars saral-elig-chip-icon"></i>
        <div>
          <div class="saral-elig-chip-label">${isHi ? 'लिंग' : 'Gender'}</div>
          <div class="saral-elig-chip-val">${escapeHtml(genderText)}</div>
        </div>
      </div>

      <div class="saral-elig-chip">
        <i class="fa-solid fa-location-dot saral-elig-chip-icon"></i>
        <div>
          <div class="saral-elig-chip-label">${isHi ? 'राज्य / निवासी' : 'State / Domicile'}</div>
          <div class="saral-elig-chip-val">${escapeHtml(stateText)}</div>
        </div>
      </div>

      <div class="saral-elig-chip" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-briefcase saral-elig-chip-icon"></i>
        <div>
          <div class="saral-elig-chip-label">${isHi ? 'पेशा व लक्षित वर्ग' : 'Target Profession / Group'}</div>
          <div class="saral-elig-chip-val">${escapeHtml(occText)}</div>
        </div>
      </div>
    </div>
  `;
}

function generateSaralQ3Documents(s, isHi) {
  const rawDocs = Array.isArray(s.documents_required) && s.documents_required.length > 0
    ? s.documents_required
    : ['Aadhaar Card', 'Bank Account Passbook'];

  const docMapHi = {
    'aadhaar card': 'आधार कार्ड (सक्रिय मोबाइल नंबर लिंक)',
    'bank account details': 'बैंक पासबुक (खाते में आधार / NPCI लिंक)',
    'bank account passbook': 'बैंक खाता पासबुक (NPCI DBT लिंक)',
    'income certificate': 'आय प्रमाण पत्र (ताज़ा / 1 वर्ष के भीतर जारी)',
    'caste certificate': 'जाति प्रमाण पत्र (आरक्षित वर्ग हेतु)',
    'land ownership records (khasra/khatauni)': 'ज़मीन के कागज़ात (खसरा/खतौनी की नकल)',
    'ration card / bpl card': 'राशन कार्ड (राशन कार्ड या बीपीएल सूची)',
    'ration card': 'राशन कार्ड',
    'domicile certificate': 'मूल निवास प्रमाण पत्र',
    'passport size photograph': 'पासपोर्ट साइज़ फ़ोटो (2 प्रति)'
  };

  const tagLabel = isHi ? 'मूल + 1 कॉपी' : 'Original + 1 Copy';

  const itemsHtml = rawDocs.map(d => {
    const key = d.toLowerCase().trim();
    const displayName = isHi ? (docMapHi[key] || d) : d;
    return `
      <div class="saral-doc-item">
        <div class="saral-doc-left">
          <i class="fa-solid fa-circle-check"></i>
          <span>${escapeHtml(displayName)}</span>
        </div>
        <span class="saral-doc-tag">${tagLabel}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="saral-doc-checklist">
      ${itemsHtml}
    </div>
  `;
}

function renderSaralBhashaGoldenQuestions(s) {
  if (!s) return;
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');

  const expEl = document.getElementById('modalSaralExplainer');
  if (expEl) expEl.innerHTML = generateSaralPlainExplainer(s, isHi);

  const q1El = document.getElementById('modalSaralQ1');
  if (q1El) q1El.innerHTML = generateSaralQ1Benefits(s, isHi);

  const q2El = document.getElementById('modalSaralQ2');
  if (q2El) q2El.innerHTML = generateSaralQ2Eligibility(s, isHi);

  const q3El = document.getElementById('modalSaralQ3');
  if (q3El) q3El.innerHTML = generateSaralQ3Documents(s, isHi);
}

function openModal(s) {
  if (!s) return;
  currentModalScheme = s;
  const icon = CATEGORY_ICONS[s.category] || '🏛';
  const catEl = document.getElementById('modalCategory');
  const titleEl = document.getElementById('modalTitle');
  const minEl = document.getElementById('modalMinistry');
  const descEl = document.getElementById('modalDesc');
  const benEl = document.getElementById('modalBenefits');
  const applyEl = document.getElementById('modalApplyBtn');
  const eligEl = document.getElementById('modalEligibility');
  const tagsEl = document.getElementById('modalTags');

  if (catEl) catEl.textContent = icon + ' ' + (s.category || '').toUpperCase();
  if (titleEl) titleEl.textContent = s.title || '';
  if (minEl) minEl.textContent = (s.ministry || '') + (s.launched_year ? ' • Launched ' + s.launched_year : '');

  // Render 3 Golden Questions (Saral Bhasha Citizen View)
  renderSaralBhashaGoldenQuestions(s);
  switchModalViewMode('saral');
  if (descEl) {
    const fullDesc = (s.description || 'No detailed description provided.').trim();
    const paras = fullDesc.split(/\n{2,}|\r\n\r\n/);
    if (paras.length > 1) {
      descEl.innerHTML = paras.map(p => `<p style="margin-bottom:10px;line-height:1.65;">${escapeHtml(p.trim())}</p>`).join('');
    } else {
      descEl.textContent = fullDesc;
    }
  }

  if (benEl) {
    const rawBenefits = (s.benefits || '').trim();
    if (!rawBenefits) {
      benEl.innerHTML = '<em>General welfare scheme support and departmental assistance.</em>';
    } else {
      let points = [];
      if (rawBenefits.includes('|')) {
        points = rawBenefits.split('|').map(p => p.trim()).filter(Boolean);
      } else if (rawBenefits.includes('\n')) {
        points = rawBenefits.split('\n').map(p => p.trim()).filter(Boolean);
      }

      if (points.length > 1) {
        benEl.innerHTML = `
          <ul class="benefit-list">
            ${points.map(pt => {
              const cleanPt = pt.replace(/^[-*•|\d.)\s]+/, '').trim();
              return cleanPt ? `<li><i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(cleanPt)}</span></li>` : '';
            }).filter(Boolean).join('')}
          </ul>
        `;
      } else {
        const cleanPt = rawBenefits.replace(/^[-*•|\s]+/, '').trim();
        benEl.innerHTML = `
          <div style="display:flex; align-items:flex-start; gap:10px; line-height:1.6;">
            <i class="fa-solid fa-circle-check" style="color:var(--saffron);margin-top:4px;flex-shrink:0;"></i>
            <span>${escapeHtml(cleanPt)}</span>
          </div>
        `;
      }
    }
  }
  if (applyEl) applyEl.href = sanitizeUrl(s.application_url);

  const e = s.eligibility || {};
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  const noIncomeText = (typeof t === 'function') ? t('elig_no_income_cap', 'No income cap') : 'No income cap';
  const incomeStr = e.income_limit ? '₹' + Number(e.income_limit).toLocaleString('en-IN') + (isHi ? ' / वर्ष' : ' / year') : noIncomeText;
  const ageMax = e.max_age ?? ((typeof t === 'function') ? t('elig_no_limit', 'No limit') : 'No limit');
  const ageUnit = (typeof t === 'function') ? t('elig_years', 'years') : 'years';
  const genderVal = e.gender ?? ((typeof t === 'function') ? t('elig_all_citizens', 'All Citizens') : 'All Citizens');
  const stateVal = e.state ?? ((typeof t === 'function') ? t('elig_all_india', 'All India') : 'All India');

  if (eligEl) {
    const ageLabel = (typeof t === 'function') ? t('modal_elig_age', 'Age Range') : 'Age Range';
    const genderLabel = (typeof t === 'function') ? t('modal_elig_gender', 'Gender') : 'Gender';
    const incomeLabel = (typeof t === 'function') ? t('modal_elig_income', 'Income Limit') : 'Income Limit';
    const stateLabel = (typeof t === 'function') ? t('modal_elig_state', 'Coverage State') : 'Coverage State';
    eligEl.innerHTML = `
      <div class="elig-item"><div class="elig-label">${escapeHtml(ageLabel)}</div><div class="elig-value">${escapeHtml(e.min_age ?? 0)} – ${escapeHtml(ageMax)} ${escapeHtml(ageUnit)}</div></div>
      <div class="elig-item"><div class="elig-label">${escapeHtml(genderLabel)}</div><div class="elig-value">${escapeHtml(genderVal)}</div></div>
      <div class="elig-item"><div class="elig-label">${escapeHtml(incomeLabel)}</div><div class="elig-value">${escapeHtml(incomeStr)}</div></div>
      <div class="elig-item"><div class="elig-label">${escapeHtml(stateLabel)}</div><div class="elig-value">${escapeHtml(stateVal)}</div></div>
    `;
  }

  if (tagsEl) {
    tagsEl.innerHTML = (s.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  }

  const levelEl = document.getElementById('modalLevel');
  const verEl = document.getElementById('modalVerified');
  const docsEl = document.getElementById('modalDocs');

  if (levelEl) {
    const stateText = (typeof t === 'function') ? t('modal_level_state', 'State Government') : 'State Government';
    const centralText = (typeof t === 'function') ? t('modal_level_central', 'Central Government') : 'Central Government';
    levelEl.textContent = (s.level === 'state' ? stateText : centralText);
  }
  if (verEl) {
    const verPrefix = (typeof t === 'function') ? t('modal_verified_prefix', 'Verified Data') : 'Verified Data';
    verEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(verPrefix)} • ${escapeHtml(s.last_verified_at || '2026')}`;
  }

  if (docsEl) {
    const defaultDocs = isHi ? ['आधार कार्ड', 'बैंक खाता विवरण'] : ['Aadhaar Card', 'Bank Account Details'];
    const docs = Array.isArray(s.documents_required) && s.documents_required.length > 0
      ? s.documents_required
      : defaultDocs;
    docsEl.innerHTML = docs.map(d => `<span class="doc-pill"><i class="fa-solid fa-file-check"></i> ${escapeHtml(d)}</span>`).join('');
  }

  // Load Last-Mile Pre-Flight Verification Checkpoints
  loadSchemeLastMileAudit(s);

  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ══════════════════════════════════════════════════
//  LAST-MILE PRE-FLIGHT AUDIT CLIENT LOGIC
// ══════════════════════════════════════════════════
let currentSchemeAuditSpec = null;
let lastAuditDiagnosticResult = null;

async function loadSchemeLastMileAudit(s) {
  const badgeEl = document.getElementById('modalAuditRiskBadge');
  const checkpointsEl = document.getElementById('modalAuditCheckpoints');
  const resultsEl = document.getElementById('modalAuditResults');
  const widgetPill = document.getElementById('widgetPillStatus');
  if (resultsEl) resultsEl.style.display = 'none';
  if (widgetPill) {
    widgetPill.textContent = 'Pre-Verification Engine';
    widgetPill.className = 'widget-pill';
  }

  if (!checkpointsEl) return;
  checkpointsEl.innerHTML = '<div style="font-size:12px; color:#64748B; padding:8px 0;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading departmental validation checkpoints...</div>';

  try {
    const schemeId = s._id || s.id;
    const res = await fetch(`${SCHEMES_API}/api/schemes/${encodeURIComponent(schemeId)}/last-mile-audit`);
    if (!res.ok) throw new Error('Failed to load audit spec');
    const data = await res.json();
    const spec = data.audit_spec;
    currentSchemeAuditSpec = spec;

    if (badgeEl) {
      badgeEl.textContent = spec.is_dbt ? 'DBT APBS Check' : 'Standard Audit';
      badgeEl.style.background = spec.is_dbt ? '#E0E7FF' : '#F1F5F9';
      badgeEl.style.color = spec.is_dbt ? '#3730A3' : '#475569';
    }

    if (!spec.checkpoints || spec.checkpoints.length === 0) {
      checkpointsEl.innerHTML = '<div style="font-size:12px; color:#64748B;">No specific high-risk failure traps flagged for this scheme. Standard documentation applies.</div>';
      return;
    }

    checkpointsEl.innerHTML = spec.checkpoints.map(cp => `
      <div class="audit-checkpoint-card risk-${escapeHtml(cp.risk_type || 'MEDIUM')}">
        <div class="audit-cp-header">
          <span class="audit-cp-title">${escapeHtml(cp.title)}</span>
          <span class="audit-cp-dimension">${escapeHtml(cp.dimension)}</span>
        </div>
        <div class="audit-cp-trap"><i class="fa-solid fa-triangle-exclamation" style="color: #EA580C; margin-right: 4px;"></i> <strong>Audit Trap:</strong> ${escapeHtml(cp.departmental_trap)}</div>
        <div class="audit-cp-action"><i class="fa-solid fa-circle-check" style="margin-top: 2px;"></i> <div><strong>Pre-Submission Fix:</strong> ${escapeHtml(cp.prevention_step)} <span style="display:block; font-size:11px; opacity:0.85; margin-top:2px;">🔍 <em>${escapeHtml(cp.verification_instruction)}</em></span></div></div>
      </div>
    `).join('');
  } catch (err) {
    checkpointsEl.innerHTML = `
      <div class="audit-checkpoint-card risk-HIGH">
        <div class="audit-cp-header">
          <span class="audit-cp-title">Aadhaar-NPCI Bank Seeding Mandate (आधार-बैंक एनपीसीआई सीडिंग)</span>
          <span class="audit-cp-dimension">APBS Banking</span>
        </div>
        <div class="audit-cp-trap">Direct Benefit Transfer funds are routed via the NPCI Aadhaar Payment Bridge. Unmapped accounts cause DBT transactions to fail.</div>
        <div class="audit-cp-action"><i class="fa-solid fa-circle-check"></i> <div><strong>Pre-Submission Fix:</strong> Dial *99*99*1# from your registered SIM to check status, or submit DBT Annexure-I at your bank branch.</div></div>
      </div>
    `;
  }
}

async function runPreFlightAuditForModal() {
  const aadhaarName = document.getElementById('auditAadhaarName')?.value.trim() || '';
  const bankName = document.getElementById('auditBankName')?.value.trim() || '';
  const npciSeeded = document.getElementById('auditNpciSeeded')?.value || 'unknown';
  const incomeStatus = document.getElementById('auditIncomeStatus')?.value || 'valid_current_fy';
  const taxFiler = document.getElementById('auditTaxFiler')?.checked || false;
  const mobileActive = document.getElementById('auditMobileActive')?.checked ?? true;
  const resultsEl = document.getElementById('modalAuditResults');
  const widgetPill = document.getElementById('widgetPillStatus');

  if (!resultsEl) return;

  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div style="text-align:center; padding:16px; color:#2563EB;"><i class="fa-solid fa-circle-notch fa-spin"></i> Running last-mile pre-verification diagnostics...</div>';

  const payload = {
    scheme_id: currentModalScheme ? (currentModalScheme._id || currentModalScheme.id) : null,
    aadhaar_name: aadhaarName,
    bank_name: bankName,
    npci_seeded: npciSeeded,
    income_cert_status: incomeStatus,
    family_tax_filer: taxFiler,
    aadhaar_mobile_active: mobileActive,
    channel_aware: true
  };

  try {
    const res = await fetch(`${SCHEMES_API}/api/pre-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    lastAuditDiagnosticResult = data;

    if (widgetPill) {
      widgetPill.textContent = `${data.readiness_score}% Readiness`;
      widgetPill.className = `widget-pill ${data.badge_class}`;
    }

    let breakdownHtml = '';

    if (data.critical_failures && data.critical_failures.length > 0) {
      breakdownHtml += data.critical_failures.map(f => `
        <div class="diag-item diag-item-fail">
          <div class="diag-item-title"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(f.title)}</div>
          <div>${escapeHtml(f.reason)}</div>
          <div class="diag-item-remedy"><i class="fa-solid fa-wrench"></i> ${escapeHtml(f.remedy)}</div>
        </div>
      `).join('');
    }

    if (data.warnings && data.warnings.length > 0) {
      breakdownHtml += data.warnings.map(w => `
        <div class="diag-item diag-item-warn">
          <div class="diag-item-title"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(w.title)}</div>
          <div>${escapeHtml(w.reason)}</div>
          <div class="diag-item-remedy"><i class="fa-solid fa-arrow-right"></i> ${escapeHtml(w.remedy)}</div>
        </div>
      `).join('');
    }

    if (data.passed_checks && data.passed_checks.length > 0) {
      breakdownHtml += data.passed_checks.map(p => `
        <div class="diag-item diag-item-pass">
          <div class="diag-item-title"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(p.title)}</div>
          <div>${escapeHtml(p.message)}</div>
        </div>
      `).join('');
    }

    resultsEl.innerHTML = `
      <div class="results-meter-box">
        <div class="meter-left">
          <div class="meter-score-num">${data.readiness_score}<span style="font-size:14px; font-weight:600; color:#64748B;">/100</span></div>
          <span class="meter-status-badge ${data.badge_class}">${escapeHtml(data.badge_text)}</span>
        </div>
        <p class="meter-summary-text">${escapeHtml(data.summary)}</p>
      </div>

      <div class="results-breakdown-list">
        ${breakdownHtml}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; gap:8px;">
        <span style="font-size:11px; color:#64748B;"><i class="fa-solid fa-shield-halved"></i> Pre-Audit Slip ID: ${escapeHtml(data.printable_slip?.audit_id || 'SN-AUDIT')}</span>
        <button type="button" class="btn-checklist-print" onclick="printModalAuditChecklist()">
          <i class="fa-solid fa-print"></i> <span>Print Verification Slip</span>
        </button>
      </div>
    `;

    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    resultsEl.innerHTML = '<div style="color:#DC2626; font-size:12px;">Failed to complete pre-flight diagnostic. Please try again.</div>';
  }
}

function printModalAuditChecklist() {
  if (!lastAuditDiagnosticResult) {
    runPreFlightAuditForModal().then(() => {
      window.print();
    });
    return;
  }
  window.print();
}

function openEligSchemeWithAudit(idx) {
  if (currentEligRecommendations[idx]) {
    const rec = currentEligRecommendations[idx];
    closeEligibilityModal();
    openModal(rec.scheme);
    setTimeout(() => {
      const auditSec = document.getElementById('modalPreAuditSection');
      if (auditSec) {
        auditSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (typeof window !== 'undefined' && window.SaralFamilyVault) {
        const active = window.SaralFamilyVault.getActiveMember();
        if (active && active.label) {
          const nameInput = document.getElementById('auditAadhaarName');
          if (nameInput) {
            const cleanName = active.label.replace(/\s*\([^)]*\)/g, '').trim();
            if (cleanName && cleanName !== 'Myself') {
              nameInput.value = cleanName;
            }
          }
        }
      }
    }, 300);
  }
}

function shareOnWhatsApp() {
  if (!currentModalScheme) return;
  const personaSuffix = currentModalScheme._target_persona ? ` *(Recommended for ${currentModalScheme._target_persona})*` : '';
  const text = `🇮🇳 *${currentModalScheme.title}*${personaSuffix}\n\n${currentModalScheme.description}\n\n*Key Benefits:* ${currentModalScheme.benefits}\n\nApply on official portal: ${currentModalScheme.application_url}\n\n_Discovered via Saral Niti Portal_`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function askSahayakAboutCurrentScheme() {
  if (!currentModalScheme) return;
  const title = currentModalScheme.title;
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  closeModal();

  // Make sure chat box is open
  const box = document.getElementById('chat-box');
  if (!box || box.style.display === 'none' || !box.style.display) {
    if (typeof toggleChat === 'function') toggleChat();
  }

  const input = document.getElementById('chat-input');
  if (input) {
    input.value = isHi
      ? `${title} योजना के बारे में आसान भाषा में समझाएं: मुझे क्या मिलेगा और कैसे आवेदन करें?`
      : `Explain ${title} scheme in simple words: what do I get and how to apply?`;
    if (typeof sendMessage === 'function') {
      setTimeout(() => sendMessage(), 150);
    }
  }
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  currentModalScheme = null;
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ══════════════════════════════════════════════════
//  URL DETECTOR — OPEN / CLOSE
// ══════════════════════════════════════════════════
function openDetector() {
  const overlay = document.getElementById('detOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetector() {
  const overlay = document.getElementById('detOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';

  const urlInput = document.getElementById('urlInput');
  const fileInput = document.getElementById('fileInput');
  const fileName = document.getElementById('fileName');
  if (urlInput) urlInput.value = '';
  if (fileInput) fileInput.value = '';
  if (fileName) {
    fileName.style.display = 'none';
    fileName.textContent = '';
  }

  ['url', 'file'].forEach(t => {
    const sp = document.getElementById(t + 'Spinner');
    const res = document.getElementById(t + 'Result');
    const box = document.getElementById(t + 'ResultBox');
    const btn = document.getElementById(t + 'Btn');
    if (sp) sp.classList.remove('show');
    if (res) res.classList.remove('show');
    if (box) {
      box.textContent = '';
      box.className = 'det-result-box';
    }
    if (btn) btn.disabled = false;
  });
}

function closeDetectorOnOverlay(e) {
  if (e.target === document.getElementById('detOverlay')) closeDetector();
}

// ══════════════════════════════════════════════════
//  URL DETECTOR — TABS
// ══════════════════════════════════════════════════
function switchDetectorTab(tab) {
  ['url', 'file'].forEach(t => {
    const tabEl = document.getElementById('tab-' + t);
    const panelEl = document.getElementById('panel-' + t);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (panelEl) panelEl.classList.toggle('active', t === tab);
  });
}

// ══════════════════════════════════════════════════
//  FILE SELECTED
// ══════════════════════════════════════════════════
function onFileSelected(input) {
  const nameEl = document.getElementById('fileName');
  if (input.files.length) {
    nameEl.textContent = '📎 ' + input.files[0].name;
    nameEl.style.display = 'block';
  } else {
    nameEl.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════
//  ANALYZE URL
// ══════════════════════════════════════════════════
async function analyzeURL() {
  const urlEl = document.getElementById('urlInput');
  const url = urlEl ? urlEl.value.trim() : '';
  if (!url) { alert('Please enter a URL first.'); return; }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    alert('URL must start with http:// or https://');
    return;
  }

  setDetectorLoading('url', true);

  try {
    const res = await fetch(`${ML_API}/api/detect-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok || data.error || data.verdict === 'error') {
      showDetectorResult('url', '❌ ' + (data.error || data.result || 'Analysis failed'), 'suspicious');
    } else {
      showDetectorResult('url', data.result, classifyResult(data.result, data.verdict));
    }
  } catch (err) {
    showDetectorResult('url',
      '❌ Could not connect to backend server.\n\nError: ' + err.message,
      'suspicious'
    );
  } finally {
    setDetectorLoading('url', false);
  }
}

// ══════════════════════════════════════════════════
//  ANALYZE FILE
// ══════════════════════════════════════════════════
async function analyzeFile() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput || !fileInput.files.length) { alert('Please select a file first.'); return; }

  const file = fileInput.files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'txt'].includes(ext)) { alert('Only PDF and TXT files are supported.'); return; }

  setDetectorLoading('file', true);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${ML_API}/api/detect-file`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok || data.error || data.verdict === 'error') {
      showDetectorResult('file', '❌ ' + (data.error || data.result || 'Analysis failed'), 'suspicious');
    } else {
      showDetectorResult('file', data.result, classifyResult(data.result, data.verdict));
    }
  } catch (err) {
    showDetectorResult('file',
      '❌ Could not connect to backend server.\n\nError: ' + err.message,
      'suspicious'
    );
  } finally {
    setDetectorLoading('file', false);
  }
}

// ══════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════
function setDetectorLoading(type, loading) {
  const btn = document.getElementById(type + 'Btn');
  const spinner = document.getElementById(type + 'Spinner');
  const result = document.getElementById(type + 'Result');
  if (btn) btn.disabled = loading;
  if (spinner) spinner.classList.toggle('show', loading);
  if (loading && result) result.classList.remove('show');
}

function showDetectorResult(type, text, cssClass) {
  const box = document.getElementById(type + 'ResultBox');
  const result = document.getElementById(type + 'Result');
  if (box) {
    box.textContent = text;
    box.className = 'det-result-box ' + (cssClass || 'suspicious');
  }
  if (result) result.classList.add('show');
}

function classifyResult(text, verdict) {
  if (verdict) {
    const v = String(verdict).toLowerCase();
    if (v === 'error') return 'suspicious';
    return v;
  }
  if (!text) return 'suspicious';
  
  // Look for explicit Result: REAL/FAKE/SUSPICIOUS line (supports markdown bold)
  const resultMatch = text.match(/Result[^\w\n]*\s*[*_#`]*\s*(REAL|FAKE|SUSPICIOUS)/i);
  if (resultMatch) {
    return resultMatch[1].toLowerCase();
  }
  
  // Look for Risk Level: LOW/MEDIUM/HIGH line
  const riskMatch = text.match(/Risk\s*Level[^\w\n]*\s*[*_#`]*\s*(LOW|MEDIUM|HIGH)/i);
  if (riskMatch) {
    const r = riskMatch[1].toUpperCase();
    if (r === 'LOW') return 'real';
    if (r === 'HIGH') return 'fake';
    return 'suspicious';
  }

  const t = text.toUpperCase();
  if (t.includes('FAKE') || t.includes('SCAM')) return 'fake';
  if (t.includes('SUSPICIOUS')) return 'suspicious';
  if (t.includes('REAL')) return 'real';
  return 'suspicious';
}

// ══════════════════════════════════════════════════
//  PERSONALIZATION / ELIGIBILITY CHECKER
// ══════════════════════════════════════════════════
let currentEligRecommendations = [];

function openEligibilityModal() {
  const overlay = document.getElementById('eligibilityOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  if (typeof window !== 'undefined' && window.SaralFamilyVault) {
    renderEligibilityPersonas();
    const active = window.SaralFamilyVault.getActiveMember();
    populateEligibilityFormFromPersona(active);
  }
}

// ══════════════════════════════════════════════════
//  HOUSEHOLD PERSONA VAULT (SARAL PARIVAR) UI
// ══════════════════════════════════════════════════

function renderEligibilityPersonas() {
  if (typeof window === 'undefined' || !window.SaralFamilyVault) return;
  const container = document.getElementById('eligibilityPersonaChips');
  const badgeName = document.getElementById('eligibilityActiveName');
  if (!container) return;

  const members = window.SaralFamilyVault.getMembers();
  const active = window.SaralFamilyVault.getActiveMember();

  if (badgeName && active) {
    badgeName.textContent = active.label || 'Myself';
  }

  container.innerHTML = '';

  members.forEach(m => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'persona-chip' + (m.id === active.id ? ' active' : '');
    const meta = window.SaralFamilyVault.RELATION_METADATA[m.relationship] || window.SaralFamilyVault.RELATION_METADATA.other;
    chip.innerHTML = `<span>${meta.avatar || '👤'}</span> <span>${escapeHtml(m.label)}</span>`;
    chip.onclick = () => {
      window.SaralFamilyVault.setActiveMember(m.id);
    };
    container.appendChild(chip);
  });

  // + Add Member chip
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'persona-chip-add';
  addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add Member`;
  addBtn.onclick = () => openAddFamilyMemberModal();
  container.appendChild(addBtn);
}

function populateEligibilityFormFromPersona(member) {
  if (!member) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };

  setVal('eligAge', member.age || '');
  setVal('eligGender', member.gender || 'all');
  setVal('eligState', member.state || 'all');
  setVal('eligIncome', member.income || '');
  setVal('eligCaste', member.caste || 'general');
  setVal('eligOccupation', member.occupation || '');

  const disabledBox = document.getElementById('eligIsDisabled');
  if (disabledBox) disabledBox.checked = Boolean(member.disability);

  const studentBox = document.getElementById('eligIsStudent');
  if (studentBox) studentBox.checked = member.occupation === 'student';

  const widowBox = document.getElementById('eligIsWidow');
  if (widowBox) widowBox.checked = member.marital_status === 'widowed';
}

function openAddFamilyMemberModal(memberToEdit) {
  const overlay = document.getElementById('familyMemberOverlay');
  if (!overlay) return;

  const form = document.getElementById('familyMemberForm');
  if (form) form.reset();

  const idInput = document.getElementById('famMemberId');
  const title = document.getElementById('familyModalTitle');

  if (memberToEdit) {
    if (idInput) idInput.value = memberToEdit.id;
    if (title) title.textContent = 'Edit Family Member';
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };
    setVal('famRelation', memberToEdit.relationship);
    setVal('famLabel', memberToEdit.label);
    setVal('famAge', memberToEdit.age);
    setVal('famGender', memberToEdit.gender);
    setVal('famState', memberToEdit.state);
    setVal('famOccupation', memberToEdit.occupation);
    setVal('famCaste', memberToEdit.caste);
    setVal('famIncome', memberToEdit.income);
    const dis = document.getElementById('famDisability');
    if (dis) dis.checked = Boolean(memberToEdit.disability);
  } else {
    if (idInput) idInput.value = '';
    if (title) title.textContent = 'Add Family Member';
    handleRelationPresetChange('father');
  }

  overlay.classList.add('open');
}

function closeFamilyMemberModal() {
  const overlay = document.getElementById('familyMemberOverlay');
  if (overlay) overlay.classList.remove('open');
}

function closeFamilyMemberOnOverlay(e) {
  if (e.target === document.getElementById('familyMemberOverlay')) {
    closeFamilyMemberModal();
  }
}

function handleRelationPresetChange(relKey) {
  const meta = (window.SaralFamilyVault && window.SaralFamilyVault.RELATION_METADATA[relKey]) || {};
  const labelInput = document.getElementById('famLabel');
  const genderSelect = document.getElementById('famGender');
  const ageInput = document.getElementById('famAge');
  const occSelect = document.getElementById('famOccupation');

  if (labelInput && !labelInput.value) {
    labelInput.placeholder = `e.g. ${meta.labelEn || 'Relative'}`;
  }

  if (relKey === 'father' || relKey === 'grandfather') {
    if (genderSelect) genderSelect.value = 'male';
    if (ageInput && !ageInput.value) ageInput.value = relKey === 'father' ? 56 : 74;
    if (occSelect && relKey === 'father') occSelect.value = 'farmer';
    if (occSelect && relKey === 'grandfather') occSelect.value = 'senior_citizen';
  } else if (relKey === 'mother' || relKey === 'grandmother') {
    if (genderSelect) genderSelect.value = 'female';
    if (ageInput && !ageInput.value) ageInput.value = relKey === 'mother' ? 52 : 70;
    if (occSelect && relKey === 'mother') occSelect.value = 'homemaker';
    if (occSelect && relKey === 'grandmother') occSelect.value = 'senior_citizen';
  } else if (relKey === 'son' || relKey === 'daughter' || relKey === 'brother' || relKey === 'sister') {
    if (genderSelect) genderSelect.value = (relKey === 'son' || relKey === 'brother') ? 'male' : 'female';
    if (occSelect) occSelect.value = 'student';
    if (ageInput && !ageInput.value) ageInput.value = 18;
  }
}

function handleFamilyMemberSubmit(e) {
  e.preventDefault();
  if (!window.SaralFamilyVault) return;

  const id = document.getElementById('famMemberId')?.value;
  const data = {
    relationship: document.getElementById('famRelation').value,
    label: document.getElementById('famLabel').value.trim(),
    age: parseInt(document.getElementById('famAge').value, 10),
    gender: document.getElementById('famGender').value,
    state: document.getElementById('famState').value,
    occupation: document.getElementById('famOccupation').value,
    caste: document.getElementById('famCaste').value,
    income: parseInt(document.getElementById('famIncome').value, 10) || 0,
    disability: Boolean(document.getElementById('famDisability')?.checked)
  };

  if (id) {
    window.SaralFamilyVault.updateMember(id, data);
  } else {
    const newMember = window.SaralFamilyVault.addMember(data);
    window.SaralFamilyVault.setActiveMember(newMember.id);
  }

  closeFamilyMemberModal();
}

// Global listeners for reactive persona switching
if (typeof window !== 'undefined') {
  window.addEventListener('saral:active_persona_changed', function(e) {
    const member = e.detail && e.detail.member;
    renderEligibilityPersonas();
    if (document.getElementById('eligibilityOverlay')?.classList.contains('open')) {
      populateEligibilityFormFromPersona(member);
      // Reset stale results for previously selected persona
      const resultsWrap = document.getElementById('eligResultsWrap');
      if (resultsWrap) resultsWrap.style.display = 'none';
      currentEligRecommendations = [];
    }
  });

  window.addEventListener('saral:family_vault_updated', function() {
    renderEligibilityPersonas();
  });
}

function closeEligibilityModal() {
  const overlay = document.getElementById('eligibilityOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function closeEligibilityOnOverlay(e) {
  if (e.target === document.getElementById('eligibilityOverlay')) closeEligibilityModal();
}

async function handleEligibilitySubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('eligSubmitBtn');
  const resultsWrap = document.getElementById('eligResultsWrap');
  const resultsList = document.getElementById('eligResultsList');
  const resultsTitle = document.getElementById('eligResultsTitle');
  const resultsSub = document.getElementById('eligResultsSub');

  const ageVal = document.getElementById('eligAge').value;
  const incomeVal = document.getElementById('eligIncome').value;

  const activePersona = (typeof window !== 'undefined' && window.SaralFamilyVault)
    ? window.SaralFamilyVault.toChatbotContext()
    : null;

  const payload = {
    age: ageVal ? Number(ageVal) : null,
    gender: document.getElementById('eligGender').value,
    state: document.getElementById('eligState').value,
    income: incomeVal ? Number(incomeVal) : null,
    caste: document.getElementById('eligCaste').value,
    occupation: document.getElementById('eligOccupation').value,
    education_level: document.getElementById('eligEducation')?.value || '',
    ration_card: document.getElementById('eligRation')?.value || '',
    housing_status: document.getElementById('eligHousing')?.value || '',
    land_ownership: document.getElementById('eligLand')?.value || '',
    is_student: Boolean(document.getElementById('eligIsStudent')?.checked),
    is_differently_abled: Boolean(document.getElementById('eligIsDisabled')?.checked),
    vulnerabilities: [
      ...(document.getElementById('eligIsDisabled')?.checked ? ['disability'] : []),
      ...(document.getElementById('eligIsWidow')?.checked ? ['widow'] : []),
      ...(document.getElementById('eligIsSingleWomen')?.checked ? ['single_women'] : [])
    ],
    active_persona: activePersona
  };

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Matching Schemes...</span>`;

  try {
    const res = await fetch(`${SCHEMES_API}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to match schemes. Please check your inputs.');
      return;
    }

    currentEligRecommendations = data.recommendations || [];
    resultsWrap.style.display = 'block';
    const personaPrefix = data.persona_label ? ` for ${escapeHtml(data.persona_label)}` : (data.target_subject && data.target_subject !== 'Myself' ? ` for ${escapeHtml(data.target_subject)}` : '');
    resultsTitle.textContent = `Found ${currentEligRecommendations.length} Matching Schemes${personaPrefix}`;
    resultsSub.textContent = `Evaluated against ${data.total_evaluated} official welfare initiatives.`;

    if (currentEligRecommendations.length === 0) {
      resultsList.innerHTML = `
        <div class="no-results" style="padding: 24px; text-align: center;">
          <i class="fa-solid fa-folder-open" style="font-size: 32px; color: var(--slate-400); margin-bottom: 8px;"></i>
          <h4>No direct matches found</h4>
          <p>Try broadening your criteria (e.g. state 'All India' or leaving income blank).</p>
        </div>`;
      return;
    }

    const targetTag = data.persona_label || (data.target_subject && data.target_subject !== 'Myself' ? data.target_subject : null);
    const targetTagHtml = targetTag ? `<span class="persona-target-tag"><i class="fa-solid fa-user-check"></i> ${escapeHtml(targetTag)}</span>` : '';

    lastSubmittedProfile = {
      ...payload,
      target_subject: data.target_subject || activePersona?.relationship || 'Myself',
      persona_label: data.persona_label || activePersona?.label || 'Myself'
    };

    resultsList.innerHTML = currentEligRecommendations.map((rec, idx) => {
      const s = rec.scheme;
      s._target_persona = targetTag;
      const isEligible = rec.status === 'eligible';
      const scoreBadgeClass = isEligible ? 'eligible' : 'partial';
      const scoreBadgeText = isEligible ? `${rec.match_score}% Match • Eligible` : `${rec.match_score}% • Partial Match`;

      const reasonsHtml = (rec.reasons || []).map(r => `<li><i class="fa-solid fa-check"></i> ${escapeHtml(r)}</li>`).join('');
      const unmetHtml = (rec.unmet_criteria || []).map(u => `<li><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(u)}</li>`).join('');

      const docs = s.documents_required || s.documents || [];
      const docCount = docs.length;
      let docsSectionHtml = '';
      if (docCount > 0) {
        const docsItemsHtml = docs.map(d => {
          const meta = getDocumentMetadata(d, lastSubmittedProfile);
          const safeDoc = escapeHtml(d);
          return `
            <li class="scheme-doc-item">
              <input type="checkbox" class="scheme-doc-checkbox" onchange="toggleSchemeDocCheck(this)" aria-label="Mark ${safeDoc} as ready">
              <div class="doc-info-wrap">
                <div class="doc-header-row">
                  <span class="doc-name-text">${safeDoc}</span>
                  <span class="doc-tag-pill">${escapeHtml(meta.tag)}</span>
                </div>
                <div class="doc-authority-tag">
                  <i class="fa-solid fa-landmark"></i> <span>Issuing Authority: <strong>${escapeHtml(meta.authority)}</strong></span>
                </div>
                <div class="doc-hint-box">
                  <i class="fa-solid fa-circle-info"></i> ${escapeHtml(meta.hint)}
                </div>
              </div>
            </li>
          `;
        }).join('');

        docsSectionHtml = `
          <div class="elig-docs-section">
            <button type="button" class="elig-docs-toggle-btn" onclick="toggleSchemeDocChecklist(${idx}, this)" aria-expanded="false">
              <i class="fa-solid fa-file-shield"></i>
              <span>Required Documents (${docCount})</span>
              <i class="fa-solid fa-chevron-down doc-toggle-arrow"></i>
            </button>
            <div class="elig-docs-drawer" id="schemeDocsDrawer_${idx}" style="display:none;">
              <ul class="scheme-doc-checklist">
                ${docsItemsHtml}
              </ul>
              <div class="docs-readiness-hint">
                <i class="fa-solid fa-lightbulb"></i>
                <span>Carry original documents + 2 self-attested photocopies to your CSC (Jan Seva Kendra) or block office.</span>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="elig-result-card">
          <div class="elig-card-top">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="category-badge cat-${escapeHtml(s.category || 'general')}">${escapeHtml(s.category || 'Welfare')}</span>
              ${targetTagHtml}
            </div>
            <span class="match-score-badge ${scoreBadgeClass}">${scoreBadgeText}</span>
          </div>
          <div class="elig-card-title">${escapeHtml(s.title)}</div>
          <div class="elig-card-ministry"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(s.ministry || 'Government of India')}</div>
          
          ${reasonsHtml ? `<ul class="elig-reasons-list">${reasonsHtml}</ul>` : ''}
          ${unmetHtml ? `<ul class="elig-unmet-list">${unmetHtml}</ul>` : ''}

          ${docsSectionHtml}

          <div class="elig-card-action">
            <button type="button" class="elig-audit-btn" onclick="openEligSchemeWithAudit(${idx})" title="Check Last-Mile Rejection Traps">
              <i class="fa-solid fa-shield-halved"></i>
              <span>Pre-Flight Audit</span>
            </button>
            <button type="button" class="elig-view-btn" onclick="openEligScheme(${idx})">
              <span>View Scheme Details</span>
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    resultsWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    alert('Network error while connecting to recommendation engine.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> <span>Find Eligible Schemes</span>`;
  }
}

function openEligScheme(idx) {
  if (currentEligRecommendations[idx]) {
    closeEligibilityModal();
    openModal(currentEligRecommendations[idx].scheme);
  }
}

let lastSubmittedProfile = {};

function getDocumentMetadata(docName, profile = {}) {
  const nameLower = (docName || '').toLowerCase();
  
  if (nameLower.includes('aadhaar')) {
    return {
      icon: 'fa-id-card',
      tag: 'Mandatory ID (पहचान)',
      authority: 'UIDAI',
      hint: 'Ensure mobile number is linked for OTP verification; name must match Bank passbook.'
    };
  }
  if (nameLower.includes('land') || nameLower.includes('khasra') || nameLower.includes('khatauni') || nameLower.includes('ror')) {
    return {
      icon: 'fa-wheat-awn',
      tag: 'Land Record (राजस्व रिकॉर्ड)',
      authority: 'Tehsil / State Bhulekh Portal',
      hint: 'Fresh digital certified copy of Khatauni/Khasra showing applicant as title holder.'
    };
  }
  if (nameLower.includes('bank') || nameLower.includes('passbook')) {
    return {
      icon: 'fa-building-columns',
      tag: 'DBT Bank Account (डीबीटी खाता)',
      authority: 'Commercial / Grameen / Post Office Bank',
      hint: 'Must be actively seeded on NPCI Aadhaar mapper (dial *99*99*1# to verify).'
    };
  }
  if (nameLower.includes('income')) {
    return {
      icon: 'fa-file-invoice-dollar',
      tag: 'Income Verification (आय प्रमाण)',
      authority: 'Tehsildar / SDO / CSC e-District',
      hint: 'Issued within the last 6 months stating total annual household income.'
    };
  }
  if (nameLower.includes('caste') || nameLower.includes('category')) {
    return {
      icon: 'fa-users-line',
      tag: 'Category Certificate (जाति प्रमाण)',
      authority: 'Revenue Department / CSC e-District',
      hint: 'Permanent digital certificate with verification QR code / barcode.'
    };
  }
  if (nameLower.includes('marksheet') || nameLower.includes('student') || nameLower.includes('bonafide') || nameLower.includes('college')) {
    return {
      icon: 'fa-graduation-cap',
      tag: 'Academic Record (शैक्षणिक प्रमाण)',
      authority: 'School / College / University',
      hint: 'Self-attested marksheets + bonafide enrollment certificate for current session.'
    };
  }
  if (nameLower.includes('disability') || nameLower.includes('udid')) {
    return {
      icon: 'fa-wheelchair',
      tag: 'Disability Certificate (दिव्यांग प्रमाण)',
      authority: 'District Medical Board / Swavlamban Portal',
      hint: 'Valid UDID card or Civil Surgeon certificate certifying ≥40% benchmark disability.'
    };
  }
  if (nameLower.includes('ration') || nameLower.includes('bpl')) {
    return {
      icon: 'fa-utensils',
      tag: 'Food Security / Ration Card',
      authority: 'Food & Civil Supplies Department',
      hint: 'Digitized NFSA Ration Card (PHH / AAY / BPL) with family members listed.'
    };
  }
  if (nameLower.includes('age') || nameLower.includes('birth')) {
    return {
      icon: 'fa-cake-candles',
      tag: 'Age Proof (आयु प्रमाण)',
      authority: 'Municipal Body / Aadhaar / Voter ID',
      hint: 'Birth certificate, 10th marksheet, or Aadhaar showing verified Date of Birth.'
    };
  }
  if (nameLower.includes('address') || nameLower.includes('domicile') || nameLower.includes('residence')) {
    return {
      icon: 'fa-house-chimney',
      tag: 'Domicile Certificate (निवास प्रमाण)',
      authority: 'Tehsildar / CSC e-District',
      hint: 'State domicile / niwas praman patra confirming residential address.'
    };
  }
  
  return {
    icon: 'fa-file-lines',
    tag: 'Supporting Document (दस्तावेज़)',
    authority: 'Issuing Department / CSC',
    hint: 'Original document + 2 self-attested photocopies required for departmental verification.'
  };
}

function toggleSchemeDocChecklist(idx, btn) {
  const drawer = document.getElementById(`schemeDocsDrawer_${idx}`);
  if (!drawer) return;
  const isHidden = drawer.style.display === 'none';
  drawer.style.display = isHidden ? 'block' : 'none';
  btn.classList.toggle('open', isHidden);
  btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
}

function toggleSchemeDocCheck(checkbox) {
  const item = checkbox.closest('.scheme-doc-item');
  if (item) {
    if (checkbox.checked) {
      item.classList.add('checked');
    } else {
      item.classList.remove('checked');
    }
  }
}

function generateCitizenPassbookHTML(persona, profile, recommendations) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const stateCode = profile.state && profile.state !== 'all' ? profile.state.substring(0, 2).toUpperCase() : 'IN';
  const passbookId = 'SN-' + stateCode + '-' + Math.floor(100000 + Math.random() * 900000);
  const beneficiaryName = persona.label || (profile.target_subject && profile.target_subject !== 'Myself' ? profile.target_subject : 'Beneficiary Citizen');

  // Master documents aggregation
  const masterDocs = new Map();
  recommendations.forEach(rec => {
    const docs = rec.scheme.documents_required || rec.scheme.documents || [];
    docs.forEach(d => {
      if (!masterDocs.has(d)) {
        masterDocs.set(d, {
          name: d,
          meta: getDocumentMetadata(d, profile),
          schemes: [rec.scheme.title]
        });
      } else {
        masterDocs.get(d).schemes.push(rec.scheme.title);
      }
    });
  });

  const schemesRows = recommendations.map((rec, i) => {
    const s = rec.scheme;
    return `
      <tr>
        <td style="text-align: center; font-weight: 700;">${i + 1}</td>
        <td>
          <div class="pb-scheme-title">${escapeHtml(s.title)}</div>
          <div class="pb-scheme-dept">${escapeHtml(s.ministry || 'Government of India')}</div>
        </td>
        <td>
          <div class="pb-scheme-benefit">${escapeHtml(s.benefits || 'Welfare / Direct Benefit Transfer')}</div>
        </td>
        <td style="text-align: center;">
          <span class="pb-match-badge">${rec.match_score}% Fit</span>
        </td>
        <td>
          <div class="pb-portal-url">${escapeHtml(s.application_url || 'https://myscheme.gov.in')}</div>
        </td>
      </tr>
    `;
  }).join('');

  let docsListHtml = '';
  let docIdx = 1;
  masterDocs.forEach((val, key) => {
    docsListHtml += `
      <div class="pb-doc-box">
        <div class="pb-doc-check">[ ]</div>
        <div class="pb-doc-details">
          <div class="pb-doc-name"><strong>${docIdx++}. ${escapeHtml(key)}</strong> <span class="pb-doc-type">(${escapeHtml(val.meta.tag)})</span></div>
          <div class="pb-doc-source"><strong>Authority:</strong> ${escapeHtml(val.meta.authority)} • <em>${escapeHtml(val.meta.hint)}</em></div>
          <div class="pb-doc-applies">For: ${val.schemes.slice(0, 3).map(escapeHtml).join(', ')}${val.schemes.length > 3 ? ' +' + (val.schemes.length - 3) + ' more' : ''}</div>
        </div>
      </div>
    `;
  });

  return `
    <div class="passbook-page">
      <!-- HEADER -->
      <div class="pb-header">
        <div class="pb-emblem-wrap">
          <div class="pb-ashoka-flag">🇮🇳</div>
          <div class="pb-header-titles">
            <h1 class="pb-title">सरल नीति — नागरिक कल्याण पासबुक</h1>
            <h2 class="pb-subtitle">SARAL NITI • CITIZEN WELFARE ENTITLEMENT DOSSIER</h2>
            <div class="pb-desc">Accredited Eligibility Record & Verified Document Checklist for CSC & Jan Seva Kendra Submission</div>
          </div>
        </div>
        <div class="pb-meta-card">
          <div class="pb-ref-no">Dossier ID: <strong>${passbookId}</strong></div>
          <div class="pb-issue-date">Issued: ${dateStr} • ${timeStr}</div>
          <div class="pb-secure-code">UIDAI/PFMS Verified • CSC Format</div>
        </div>
      </div>

      <!-- BENEFICIARY DEMOGRAPHIC SUMMARY -->
      <div class="pb-section-title">१. लाभार्थी एवं परिवार विवरण (BENEFICIARY & HOUSEHOLD DOSSIER)</div>
      <table class="pb-profile-table">
        <tr>
          <th>Beneficiary Name:</th>
          <td><strong>${escapeHtml(beneficiaryName)}</strong></td>
          <th>Age / Gender:</th>
          <td>${profile.age ? profile.age + ' Years' : 'Not specified'} • ${escapeHtml(profile.gender ? profile.gender.toUpperCase() : 'ANY')}</td>
        </tr>
        <tr>
          <th>Domicile State:</th>
          <td>${escapeHtml(profile.state && profile.state !== 'all' ? profile.state : 'All India')}</td>
          <th>Social Category:</th>
          <td>${escapeHtml(profile.caste ? profile.caste.toUpperCase() : 'GENERAL')}</td>
        </tr>
        <tr>
          <th>Occupation:</th>
          <td>${escapeHtml(profile.occupation ? profile.occupation.toUpperCase() : 'NOT SPECIFIED')}</td>
          <th>Annual Household Income:</th>
          <td>${profile.income ? '₹' + Number(profile.income).toLocaleString('en-IN') : 'Self-declared / Below Cap'}</td>
        </tr>
        <tr>
          <th>Household Roster Role:</th>
          <td>${escapeHtml(profile.target_subject || 'Self')} (Saral Parivar Vault)</td>
          <th>Total Schemes Qualified:</th>
          <td><strong style="color: #15803D;">${recommendations.length} Verified Initiatives</strong></td>
        </tr>
      </table>

      <!-- SCHEMES SUMMARY TABLE -->
      <div class="pb-section-title" style="margin-top: 10px;">२. पात्र सरकारी योजनाएं (QUALIFIED WELFARE SCHEMES & ENTITLEMENTS)</div>
      <table class="pb-schemes-table">
        <thead>
          <tr>
            <th style="width: 24px;">#</th>
            <th>Scheme Title & Nodal Ministry</th>
            <th>Direct Benefit / Entitlement</th>
            <th style="width: 80px; text-align: center;">Match Fit</th>
            <th>Official Application Portal</th>
          </tr>
        </thead>
        <tbody>
          ${schemesRows}
        </tbody>
      </table>

      <!-- MASTER REQUIRED DOCUMENTS CHECKLIST -->
      <div class="pb-section-title" style="margin-top: 10px;">३. अनिवार्य दस्तावेज़ चेकलिस्ट (MASTER DOCUMENT READINESS CHECKLIST)</div>
      <p class="pb-section-note">Carry 1 original + 2 self-attested photocopies of each checked document to your Block Development Office, Bank, or nearest CSC (Jan Seva Kendra).</p>
      <div class="pb-docs-grid">
        ${docsListHtml}
      </div>

      <!-- LAST-MILE PRE-VERIFICATION ADVISORY -->
      <div class="pb-section-title" style="margin-top: 10px;">४. अस्वीकृति निवारण परामर्श (LAST-MILE ADVISORY TO PREVENT REJECTIONS)</div>
      <div class="pb-advisory-grid">
        <div class="pb-adv-card">
          <div class="pb-adv-title">⚠️ NPCI Bank Account Seeding</div>
          <div class="pb-adv-desc">Ensure your bank account is active on the NPCI Aadhaar mapper. Dial *99*99*1# from your registered mobile to confirm DBT readiness before applying.</div>
        </div>
        <div class="pb-adv-card">
          <div class="pb-adv-title">⚠️ Name Spelling Alignment</div>
          <div class="pb-adv-desc">Your name on the Aadhaar Card, Bank Passbook, and Revenue / Marksheet records must match phonetically. Discrepancies cause PFMS payment halts.</div>
        </div>
        <div class="pb-adv-card">
          <div class="pb-adv-title">🛡️ Anti-Bribery / Zero Fee Advisory</div>
          <div class="pb-adv-desc">Official government scheme enrollment is 100% free. Never pay bribes or processing fees to middle-men. National Consumer Helpline: 1915.</div>
        </div>
      </div>

      <!-- FOOTER STAMP & SIGNATURE -->
      <div class="pb-footer-row">
        <div class="pb-stamp-box">
          <div class="pb-stamp-title">Jan Seva Kendra / CSC VLE Seal & Date</div>
          <div class="pb-stamp-space"></div>
        </div>
        <div class="pb-signature-box">
          <div class="pb-stamp-title">Beneficiary Signature / Thumb Impression</div>
          <div class="pb-stamp-space"></div>
        </div>
        <div class="pb-barcode-box">
          <div class="pb-barcode">||| | ||||| || |||||| |||| ||| |||||||</div>
          <div class="pb-barcode-text">${passbookId}</div>
          <div class="pb-gen-tag">Generated by Saral-Niti Portal</div>
        </div>
      </div>
    </div>
  `;
}

function printCitizenPassbook() {
  if (!currentEligRecommendations || currentEligRecommendations.length === 0) {
    alert('Please evaluate your profile and find eligible schemes first.');
    return;
  }

  const printSection = document.getElementById('citizenPassbookPrintSection');
  if (!printSection) return;

  const active = (typeof window !== 'undefined' && window.SaralFamilyVault)
    ? (window.SaralFamilyVault.getActiveMember() || {})
    : {};

  printSection.innerHTML = generateCitizenPassbookHTML(active, lastSubmittedProfile, currentEligRecommendations);

  // Set print class on body
  document.body.classList.add('printing-passbook');

  // Trigger native print dialog
  setTimeout(() => {
    window.print();
  }, 150);

  // Clean up print class
  const cleanup = () => {
    document.body.classList.remove('printing-passbook');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}

// ══════════════════════════════════════════════════
//  HOUSEHOLD WELFARE MATRIX (SARAL PARIVAR DISCOVERY)
// ══════════════════════════════════════════════════
let currentHouseholdData = null;

async function evaluateEntireHousehold() {
  if (typeof window === 'undefined' || !window.SaralFamilyVault) {
    alert('Saral Parivar Vault is not available. Please refresh the page.');
    return;
  }

  const members = window.SaralFamilyVault.getMembers();
  if (!members || members.length === 0) {
    alert('Please add at least one family member in the Saral Parivar Vault first.');
    return;
  }

  const btn = document.getElementById('btnEvalAllHousehold');
  const resultsWrap = document.getElementById('eligResultsWrap');
  const matrixWrap = document.getElementById('householdMatrixWrap');

  if (!matrixWrap) return;

  if (btn) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Analyzing Household...</span>';
  }

  if (resultsWrap) resultsWrap.style.display = 'none';

  matrixWrap.style.display = 'block';
  matrixWrap.innerHTML = `
    <div class="hh-matrix-loading">
      <div class="hh-loading-spinner"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
      <h4 class="hh-loading-title">Discovering Household Welfare Matrix (${members.length} Members)...</h4>
      <p class="hh-loading-desc">Cross-evaluating central & state schemes, estimating combined annual cash support, health cover, and mapping unified document readiness.</p>
    </div>
  `;

  try {
    const res = await fetch('/api/recommend/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        members: members,
        include_ai_synthesis: true
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to evaluate household schemes.');
    }

    currentHouseholdData = data;
    renderHouseholdMatrix(data);

    matrixWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error('Household discovery error:', err);
    matrixWrap.innerHTML = `
      <div class="hh-error-banner">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div class="hh-error-text">
          <strong>Evaluation Error:</strong> ${escapeHtml(err.message || 'Unable to complete household analysis.')}
        </div>
        <button type="button" class="btn-secondary" onclick="evaluateEntireHousehold()">Try Again</button>
      </div>
    `;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml || '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Evaluate Entire Household</span>';
    }
  }
}

function renderHouseholdMatrix(data) {
  const matrixWrap = document.getElementById('householdMatrixWrap');
  if (!matrixWrap || !data) return;

  const s = data.household_summary || {};
  const members = data.members_matrix || [];
  const masterDocs = data.master_document_checklist || [];
  const aiSynthesis = data.ai_synthesis || '';

  const cashStr = (s.estimated_annual_cash_inflow || 0).toLocaleString('en-IN');
  const healthStr = (s.total_health_cover || 500000).toLocaleString('en-IN');

  let aiPlanHtml = '';
  if (aiSynthesis) {
    const lines = aiSynthesis.split('\n').filter(l => l.trim().length > 0);
    const bullets = lines.map(line => {
      let cleaned = escapeHtml(line.trim().replace(/^[-*•]\s*/, ''));
      cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<li>${cleaned}</li>`;
    }).join('');

    aiPlanHtml = `
      <div class="hh-ai-plan-card">
        <div class="hh-ai-plan-badge">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>AI Strategic Household Roadmap (Gemini 3.5 Flash)</span>
        </div>
        <div class="hh-ai-plan-content">
          <ul class="hh-ai-plan-list">
            ${bullets}
          </ul>
        </div>
      </div>
    `;
  }

  let masterDocsHtml = '';
  masterDocs.forEach((doc, idx) => {
    const docName = doc.name;
    const reqBy = (doc.required_by || []).map(r => `<span class="hh-member-pill-small">${escapeHtml(r)}</span>`).join('');
    masterDocsHtml += `
      <div class="hh-doc-item" onclick="toggleHouseholdDocCheck(this)">
        <input type="checkbox" id="hhDoc_${idx}" class="hh-doc-checkbox" onclick="event.stopPropagation()">
        <label for="hhDoc_${idx}" class="hh-doc-details">
          <div class="hh-doc-name-row">
            <span class="hh-doc-name"><strong>${idx + 1}.</strong> ${escapeHtml(docName)}</span>
          </div>
          <div class="hh-doc-beneficiaries">Needed by: ${reqBy}</div>
        </label>
      </div>
    `;
  });

  let membersHtml = '';
  members.forEach((m, idx) => {
    const prof = m.profile || {};
    const isOpen = idx === 0 ? 'open' : '';
    const relationMeta = (window.SaralFamilyVault && window.SaralFamilyVault.RELATION_METADATA[m.relationship]) || { avatar: '👤', labelHi: 'सदस्य' };
    
    let topSchemesHtml = '';
    (m.top_recommendations || []).forEach(rec => {
      const sch = rec.scheme || {};
      const benefitInfo = rec.benefit_info || {};
      const statusClass = rec.status === 'eligible' ? 'eligible' : 'partial';

      topSchemesHtml += `
        <div class="hh-sch-card">
          <div class="hh-sch-header">
            <div>
              <div class="hh-sch-title">${escapeHtml(sch.title || 'Scheme')}</div>
              <div class="hh-sch-dept">${escapeHtml(sch.ministry || 'Government of India')}</div>
            </div>
            <span class="match-score-badge ${statusClass}">${rec.match_score}% Fit</span>
          </div>
          <div class="hh-sch-benefit-badge">
            <i class="fa-solid fa-gift"></i> ${escapeHtml(benefitInfo.label || sch.benefits || 'Welfare Benefit')}
          </div>
          <div class="hh-sch-reasons">
            ${(rec.reasons || []).slice(0, 2).map(r => `<div class="hh-sch-reason"><i class="fa-solid fa-check"></i> ${escapeHtml(r)}</div>`).join('')}
          </div>
          <div class="hh-sch-actions">
            <a href="${escapeHtml(sch.application_url || 'https://myscheme.gov.in')}" target="_blank" rel="noopener noreferrer" class="btn-sch-portal">
              <span>Apply on Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
    });

    membersHtml += `
      <div class="hh-member-accordion ${isOpen}" id="hhMember_${m.member_id}">
        <div class="hh-member-head" onclick="toggleHouseholdMemberAccordion('${m.member_id}')">
          <div class="hh-member-avatar-wrap">
            <span class="hh-member-emoji">${relationMeta.avatar}</span>
            <div class="hh-member-title-box">
              <div class="hh-member-name">${escapeHtml(m.label)} <span class="hh-member-rel-tag">${escapeHtml(m.relationship.toUpperCase())}</span></div>
              <div class="hh-member-demographics">
                ${prof.age ? prof.age + ' Yrs' : ''} • ${escapeHtml((prof.gender || '').toUpperCase())} • ${escapeHtml(prof.occupation || 'Self')} • ${escapeHtml(prof.state || 'All India')}
              </div>
            </div>
          </div>
          <div class="hh-member-head-right">
            <span class="hh-member-schemes-badge">
              <i class="fa-solid fa-check-double"></i> <strong>${m.matched_count}</strong> Schemes
            </span>
            <i class="fa-solid fa-chevron-down hh-chevron"></i>
          </div>
        </div>
        <div class="hh-member-body">
          <div class="hh-member-schemes-grid">
            ${topSchemesHtml || '<p style="font-size:13px; color:var(--slate-500); padding: 10px;">No matching schemes found for this profile criteria.</p>'}
          </div>
        </div>
      </div>
    `;
  });

  matrixWrap.innerHTML = `
    <div class="hh-matrix-container">
      <div class="hh-matrix-top-bar">
        <div>
          <div class="hh-matrix-badge"><i class="fa-solid fa-people-roof"></i> SARAL PARIVAR DISCOVERY</div>
          <h3 class="hh-matrix-main-title">Entire Household Welfare Matrix</h3>
          <p class="hh-matrix-sub">Consolidated benefits discovery and family roadmap across ${s.total_members || 1} household members</p>
        </div>
        <div class="hh-matrix-actions">
          <button type="button" class="btn-print-passbook" onclick="printHouseholdPassbook()" title="Download or print complete household welfare dossier for CSC submission">
            <i class="fa-solid fa-file-invoice"></i>
            <span>Print Family Passbook (CSC Format)</span>
          </button>
          <button type="button" class="btn-hh-close" onclick="closeHouseholdMatrix()" title="Close Household View">✕</button>
        </div>
      </div>

      <div class="hh-metrics-grid">
        <div class="hh-metric-card cash">
          <div class="hh-metric-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
          <div class="hh-metric-content">
            <div class="hh-metric-label">Annual Direct Cash Support</div>
            <div class="hh-metric-value">₹${cashStr}<span class="hh-metric-unit">/yr</span></div>
            <div class="hh-metric-sub">Direct DBT to Bank Accounts</div>
          </div>
        </div>

        <div class="hh-metric-card health">
          <div class="hh-metric-icon"><i class="fa-solid fa-shield-heart"></i></div>
          <div class="hh-metric-content">
            <div class="hh-metric-label">Cashless Health Protection</div>
            <div class="hh-metric-value">₹${healthStr}</div>
            <div class="hh-metric-sub">Hospitalization & Critical Care</div>
          </div>
        </div>

        <div class="hh-metric-card in-kind">
          <div class="hh-metric-icon"><i class="fa-solid fa-boxes-packing"></i></div>
          <div class="hh-metric-content">
            <div class="hh-metric-label">Subsidies & In-Kind Aid</div>
            <div class="hh-metric-value">${s.in_kind_benefits_count || 0}</div>
            <div class="hh-metric-sub">Ration, LPG, Housing, Kits</div>
          </div>
        </div>

        <div class="hh-metric-card total">
          <div class="hh-metric-icon"><i class="fa-solid fa-layer-group"></i></div>
          <div class="hh-metric-content">
            <div class="hh-metric-label">Total Qualified Schemes</div>
            <div class="hh-metric-value">${s.total_schemes_matched || 0}</div>
            <div class="hh-metric-sub">Across All Family Members</div>
          </div>
        </div>
      </div>

      ${aiPlanHtml}

      <div class="hh-section-card">
        <div class="hh-section-header">
          <div class="hh-section-title"><i class="fa-solid fa-clipboard-check"></i> Master Family Document Readiness (${masterDocs.length} Documents)</div>
          <div class="hh-section-note">Carry these originals & photocopies to Jan Seva Kendra / CSC for rapid processing.</div>
        </div>
        <div class="hh-master-docs-grid">
          ${masterDocsHtml}
        </div>
      </div>

      <div class="hh-section-card">
        <div class="hh-section-header">
          <div class="hh-section-title"><i class="fa-solid fa-users"></i> Member-by-Member Welfare Entitlements</div>
          <div class="hh-section-note">Tap any member to expand their personalized qualified schemes and direct application links.</div>
        </div>
        <div class="hh-members-accordion-list">
          ${membersHtml}
        </div>
      </div>
    </div>
  `;
}

function toggleHouseholdMemberAccordion(memberId) {
  const el = document.getElementById('hhMember_' + memberId);
  if (!el) return;
  el.classList.toggle('open');
}

function toggleHouseholdDocCheck(box) {
  const cb = box.querySelector('.hh-doc-checkbox');
  if (cb) {
    cb.checked = !cb.checked;
    box.classList.toggle('checked', cb.checked);
  }
}

function closeHouseholdMatrix() {
  const matrixWrap = document.getElementById('householdMatrixWrap');
  if (matrixWrap) matrixWrap.style.display = 'none';
  const resultsWrap = document.getElementById('eligResultsWrap');
  if (resultsWrap && currentEligRecommendations && currentEligRecommendations.length > 0) {
    resultsWrap.style.display = 'block';
  }
}

function printHouseholdPassbook() {
  if (!currentHouseholdData) {
    alert('Please evaluate your household welfare matrix first.');
    return;
  }

  const printSection = document.getElementById('citizenPassbookPrintSection');
  if (!printSection) return;

  printSection.innerHTML = generateHouseholdPassbookHTML(currentHouseholdData);

  document.body.classList.add('printing-passbook');

  setTimeout(() => {
    window.print();
  }, 150);

  const cleanup = () => {
    document.body.classList.remove('printing-passbook');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}

function generateHouseholdPassbookHTML(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const passbookId = 'SN-FAM-' + Math.floor(100000 + Math.random() * 900000);

  const s = data.household_summary || {};
  const members = data.members_matrix || [];
  const masterDocs = data.master_document_checklist || [];

  const memberRows = members.map((m, idx) => {
    const prof = m.profile || {};
    return `
      <tr>
        <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
        <td><strong>${escapeHtml(m.label)}</strong></td>
        <td>${escapeHtml(m.relationship ? m.relationship.toUpperCase() : 'SELF')}</td>
        <td>${prof.age ? prof.age + ' Yrs' : '-'} • ${escapeHtml((prof.gender || '').toUpperCase())}</td>
        <td>${escapeHtml((prof.occupation || 'Self').toUpperCase())}</td>
        <td>${escapeHtml(prof.state && prof.state !== 'all' ? prof.state : 'All India')}</td>
        <td style="text-align: center;"><strong style="color: #15803D;">${m.matched_count} Schemes</strong></td>
      </tr>
    `;
  }).join('');

  let consolidatedSchemes = [];
  members.forEach(m => {
    (m.top_recommendations || []).forEach(r => {
      consolidatedSchemes.push({
        memberLabel: m.label,
        relationship: m.relationship,
        scheme: r.scheme,
        match_score: r.match_score,
        benefit_info: r.benefit_info
      });
    });
  });

  consolidatedSchemes.sort((a, b) => b.match_score - a.match_score);
  const displayedSchemes = consolidatedSchemes.slice(0, 15);

  const schemeRows = displayedSchemes.map((item, idx) => {
    const sch = item.scheme || {};
    const bInfo = item.benefit_info || {};
    return `
      <tr>
        <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
        <td>
          <div class="pb-scheme-title">${escapeHtml(sch.title || '')}</div>
          <div class="pb-scheme-dept">${escapeHtml(sch.ministry || 'Government of India')}</div>
        </td>
        <td>
          <span class="pb-member-tag">For: ${escapeHtml(item.memberLabel)} (${escapeHtml(item.relationship.toUpperCase())})</span>
        </td>
        <td>
          <div class="pb-scheme-benefit">${escapeHtml(bInfo.label || sch.benefits || 'Welfare Benefit')}</div>
        </td>
        <td style="text-align: center;">
          <span class="pb-match-badge">${item.match_score}% Fit</span>
        </td>
        <td>
          <div class="pb-portal-url">${escapeHtml(sch.application_url || 'https://myscheme.gov.in')}</div>
        </td>
      </tr>
    `;
  }).join('');

  let docsListHtml = '';
  masterDocs.forEach((doc, idx) => {
    const reqBy = (doc.required_by || []).map(escapeHtml).join(', ');
    docsListHtml += `
      <div class="pb-doc-box">
        <div class="pb-doc-check">[ ]</div>
        <div class="pb-doc-details">
          <div class="pb-doc-name"><strong>${idx + 1}. ${escapeHtml(doc.name)}</strong></div>
          <div class="pb-doc-applies">Required For: <strong>${reqBy}</strong></div>
        </div>
      </div>
    `;
  });

  return `
    <div class="passbook-page">
      <div class="pb-header">
        <div class="pb-emblem-wrap">
          <div class="pb-ashoka-flag">🇮🇳</div>
          <div class="pb-header-titles">
            <h1 class="pb-title">सरल नीति — संपूर्ण परिवार कल्याण पासबुक</h1>
            <h2 class="pb-subtitle">SARAL NITI • CONSOLIDATED HOUSEHOLD WELFARE PASSBOOK</h2>
            <div class="pb-desc">Multi-Member Family Welfare Entitlement Dossier for Jan Seva Kendra / CSC Submission</div>
          </div>
        </div>
        <div class="pb-meta-card">
          <div class="pb-ref-no">Family ID: <strong>${passbookId}</strong></div>
          <div class="pb-issue-date">Issued: ${dateStr} • ${timeStr}</div>
          <div class="pb-secure-code">Saral Parivar Vault • Verified CSC Format</div>
        </div>
      </div>

      <div class="pb-section-title">१. परिवार कल्याण प्रभाव सारांश (HOUSEHOLD WELFARE IMPACT SUMMARY)</div>
      <table class="pb-profile-table">
        <tr>
          <th>Total Registered Members:</th>
          <td><strong>${members.length} Members</strong></td>
          <th>Total Unique Qualified Schemes:</th>
          <td><strong style="color: #15803D;">${s.total_schemes_matched || 0} Schemes</strong></td>
        </tr>
        <tr>
          <th>Est. Annual Cash Support (DBT):</th>
          <td><strong style="color: #EA580C; font-size: 13px;">₹${(s.estimated_annual_cash_inflow || 0).toLocaleString('en-IN')}/year</strong></td>
          <th>Cashless Health Cover:</th>
          <td><strong style="color: #2563EB; font-size: 13px;">₹${(s.total_health_cover || 500000).toLocaleString('en-IN')}</strong></td>
        </tr>
        <tr>
          <th>Subsidized / In-Kind Benefits:</th>
          <td><strong>${s.in_kind_benefits_count || 0} Entitlements</strong> (Ration, LPG, Housing, Kits)</td>
          <th>Verification Standard:</th>
          <td>Direct DBTs via PFMS / Aadhaar NPCI Seeding</td>
        </tr>
      </table>

      <div class="pb-section-title" style="margin-top: 10px;">२. पंजीकृत परिवार सदस्य रोस्टर (FAMILY MEMBERS ROSTER)</div>
      <table class="pb-schemes-table">
        <thead>
          <tr>
            <th style="width: 24px;">#</th>
            <th>Member Name</th>
            <th>Relationship</th>
            <th>Age / Gender</th>
            <th>Occupation</th>
            <th>Domicile State</th>
            <th style="text-align: center;">Schemes Found</th>
          </tr>
        </thead>
        <tbody>
          ${memberRows}
        </tbody>
      </table>

      <div class="pb-section-title" style="margin-top: 10px;">३. मुख्य परिवार कल्याण योजनाएं (TOP CONSOLIDATED WELFARE SCHEMES)</div>
      <table class="pb-schemes-table">
        <thead>
          <tr>
            <th style="width: 24px;">#</th>
            <th>Scheme Title & Nodal Ministry</th>
            <th>Beneficiary Member</th>
            <th>Direct Benefit / Entitlement</th>
            <th style="width: 70px; text-align: center;">Match Fit</th>
            <th>Official Portal</th>
          </tr>
        </thead>
        <tbody>
          ${schemeRows}
        </tbody>
      </table>

      <div class="pb-section-title" style="margin-top: 10px;">४. परिवार एकीकृत दस्तावेज़ चेकलिस्ट (MASTER HOUSEHOLD DOCUMENT CHECKLIST)</div>
      <p class="pb-section-note">Carry 1 original + 2 self-attested photocopies of each checked document to your Block Development Office or Jan Seva Kendra.</p>
      <div class="pb-docs-grid">
        ${docsListHtml}
      </div>

      <div class="pb-footer-row">
        <div class="pb-stamp-box">
          <div class="pb-stamp-title">Jan Seva Kendra / CSC VLE Seal & Date</div>
          <div class="pb-stamp-space"></div>
        </div>
        <div class="pb-signature-box">
          <div class="pb-stamp-title">Head of Household Signature / Thumb</div>
          <div class="pb-stamp-space"></div>
        </div>
        <div class="pb-barcode-box">
          <div class="pb-barcode">||| | ||||| || |||||| |||| ||| |||||||</div>
          <div class="pb-barcode-text">${passbookId}</div>
          <div class="pb-gen-tag">Generated by Saral-Niti Portal</div>
        </div>
      </div>
    </div>
  `;
}


// ESC closes any modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeDetector();
    closeEligibilityModal();
  }
});

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
loadSchemes();

const SEARCH_PLACEHOLDERS = {
  en: [
    "Search schemes by keyword, benefit, or state (e.g. Kisan, Scholarship, PM Awas)...",
    "Search for farmer & agriculture schemes...",
    "Search for health & Ayushman schemes...",
    "Search for scholarships & student aid...",
    "Search for women welfare & ladli schemes...",
    "Search for housing & Awas Yojana..."
  ],
  hi: [
    "योजना का नाम, फ़ायदा या अपना राज्य खोजें (जैसे: किसान, छात्रवृत्ति, आवास)...",
    "किसान एवं खेती-किसानी योजनाएं खोजें...",
    "इलाज, अस्पताल और आयुष्मान योजना खोजें...",
    "छात्रवृत्ति और पढ़ाई योजना खोजें...",
    "महिला कल्याण और लाडली योजना खोजें...",
    "आवास और पक्का मकान योजना खोजें..."
  ]
};

let pIndex = 0;
function updateSearchPlaceholder() {
  const sEl = document.getElementById('searchInput');
  if (!sEl) return;
  if (document.activeElement === sEl && sEl.value) return;
  const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
  const list = SEARCH_PLACEHOLDERS[lang] || SEARCH_PLACEHOLDERS.en;
  sEl.placeholder = list[pIndex % list.length];
}

setInterval(() => {
  pIndex++;
  updateSearchPlaceholder();
}, 3500);

// Global Language Switch Listener: Update dynamic elements, cards, and placeholders
window.addEventListener('saralLanguageChange', (e) => {
  updateSearchPlaceholder();
  updateScrollStatus();
  if (currentSchemesList && currentSchemesList.length > 0) {
    const grid = document.getElementById('schemesGrid');
    if (grid) {
      const currentRendered = document.querySelectorAll('#schemesGrid .scheme-card').length;
      const countToRender = Math.max(currentRendered, Math.min(PAGE_SIZE, currentSchemesList.length));
      const visible = currentSchemesList.slice(0, countToRender);
      grid.innerHTML = visible.map((s, idx) => formatSchemeCardHTML(s, idx)).join('');
    }
  }
  if (currentModalScheme) {
    renderSaralBhashaGoldenQuestions(currentModalScheme);
  }
});

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark-mode');
  const icon = document.getElementById('darkIcon');
  if (document.documentElement.classList.contains('dark-mode')) {
    if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    localStorage.setItem('darkMode', 'on');
  } else {
    if (icon) icon.classList.replace('fa-sun', 'fa-moon');
    localStorage.setItem('darkMode', 'off');
  }
}

// Page load pe dark mode check karo
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'on') {
    document.documentElement.classList.add('dark-mode');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.classList.replace('fa-moon', 'fa-sun');
  }
});

// ══════════════════════════════════════════════════
//  MOBILE MENU TOGGLE (hamburger <-> X animation)
// ══════════════════════════════════════════════════
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  const burger = document.querySelector('.hamburger');
  if (links) links.classList.toggle('open');
  if (burger) burger.classList.toggle('open');
}


// ══════════════════════════════════════════════════
//  PWA SERVICE WORKER REGISTRATION & INSTALL ENGINE
// ══════════════════════════════════════════════════
let deferredInstallPrompt = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isFileOrStandalone = window.location.pathname.endsWith('.html');
    const swPath = isFileOrStandalone ? './sw.js' : '/sw.js';
    navigator.serviceWorker.register(swPath)
      .then((reg) => {
        console.log('[Saral PWA] Service Worker active with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[Saral PWA] Service Worker registration note:', err);
      });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.style.display = 'none';
  console.log('[Saral PWA] App installed successfully');
});

function triggerPWAInstall() {
  if (!deferredInstallPrompt) {
    alert('Saral Niti is installable! On Android Chrome, tap "Add to Home Screen" or the 3-dot menu. On iOS Safari, tap "Share" -> "Add to Home Screen".');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then((choiceResult) => {
    if (choiceResult && choiceResult.outcome === 'accepted') {
      console.log('[Saral PWA] User accepted installation prompt');
    }
    deferredInstallPrompt = null;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.style.display = 'none';
  });
}

window.addEventListener('online', () => updateOnlineStatus(true));
window.addEventListener('offline', () => updateOnlineStatus(false));
