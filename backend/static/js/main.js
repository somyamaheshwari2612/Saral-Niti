// ══════════════════════════════════════════════════
//  CONFIG
//  Automatically handles monolithic, local separate dev, and cloud-separated deployments
// ══════════════════════════════════════════════════
const BACKEND_URL = (typeof window !== 'undefined' && window.SARAL_API_BASE) || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.port === '5000' ? '' : 'http://127.0.0.1:5000')
    : (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') ? '' : 'https://saral-niti-backend.onrender.com')
);
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
//  LOAD SCHEMES
// ══════════════════════════════════════════════════
async function loadSchemes() {
  try {
    const res = await fetch(`${SCHEMES_API}/api/schemes`);
    const data = await res.json();
    if (!res.ok || data.error) {
      document.getElementById('schemesGrid').innerHTML = `
        <div class="no-results">
          <h3>Could not load schemes</h3>
          <p>${escapeHtml(data.error || 'Database connection error')}</p>
        </div>`;
      document.getElementById('resultsCount').textContent = 'Server error';
      return;
    }
    allSchemes = data.schemes || [];
    const totalEl = document.getElementById('totalCount');
    if (totalEl) totalEl.textContent = allSchemes.length + '+';
    renderSchemes(allSchemes);
  } catch (err) {
    document.getElementById('schemesGrid').innerHTML = `
      <div class="no-results">
        <h3>Could not connect to server</h3>
        <p>Make sure your Flask backend is running on port 5000</p>
      </div>`;
    document.getElementById('resultsCount').textContent = 'Connection error';
  }
}

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

// ══════════════════════════════════════════════════
//  RENDER CARDS (XSS-safe with data attributes)
// ══════════════════════════════════════════════════
function renderSchemes(schemes) {
  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');
  const resetBtn = document.getElementById('resetBtn');

  currentSchemesList = Array.isArray(schemes) ? schemes : [];

  if (resetBtn) {
    const isFiltered = currentSchemesList.length !== allSchemes.length;
    resetBtn.style.display = isFiltered ? 'inline-flex' : 'none';
  }

  if (!currentSchemesList.length) {
    grid.innerHTML = `
      <div class="no-results">
        <h3>No schemes found matching your search</h3>
        <p>Try searching for different keywords or select "All Categories".</p>
      </div>`;
    count.innerHTML = 'Showing <strong>0</strong> schemes';
    return;
  }

  count.innerHTML = `Showing <strong>${currentSchemesList.length}</strong> verified scheme${currentSchemesList.length !== 1 ? 's' : ''}`;
  grid.innerHTML = currentSchemesList.map((s, idx) => {
    const icon = CATEGORY_ICONS[s.category] || '🏛';
    const safeCat = escapeHtml(s.category || 'general');
    const safeTitle = escapeHtml(s.title || '');
    const safeDesc = escapeHtml(s.description || '');
    const safeBenefits = escapeHtml(s.benefits || '');
    const safeMinistry = escapeHtml(s.ministry || '');
    const safeUrl = sanitizeUrl(s.application_url);

    return `
    <div class="scheme-card" data-index="${idx}" tabindex="0" role="button" aria-label="View details for ${safeTitle}">
      <div>
        <div class="card-top">
          <span class="category-badge cat-${safeCat}">${icon} ${safeCat}</span>
          <div class="active-dot" title="Active Scheme"></div>
        </div>
        <div class="card-title">${safeTitle}</div>
        <div class="card-desc">${safeDesc}</div>
        <div class="card-benefit">
          <i class="fa-solid fa-gift" style="margin-right:4px;"></i> ${safeBenefits}
        </div>
      </div>
      <div class="card-footer">
        <span class="ministry-name" title="${safeMinistry}"><i class="fa-solid fa-building-columns"></i> ${safeMinistry}</span>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="apply-btn" onclick="event.stopPropagation()">
          <span>Apply</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>
  `}).join('');
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
  if (!q) { renderSchemes(allSchemes); return; }
  renderSkeletons();
  try {
    const res = await fetch(`${SCHEMES_API}/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      document.getElementById('schemesGrid').innerHTML = `
        <div class="no-results">
          <h3>Search Error</h3>
          <p>${escapeHtml(data.error || 'Failed to search schemes')}</p>
        </div>`;
      document.getElementById('resultsCount').innerHTML = 'Error searching schemes';
      return;
    }
    renderSchemes(data.schemes || []);
  } catch {
    document.getElementById('schemesGrid').innerHTML = `<div class="no-results"><h3>Search failed</h3><p>Please check your connection and try again</p></div>`;
    document.getElementById('resultsCount').textContent = 'Connection error';
  }
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

function resetFilters() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  const allBtn = document.querySelector('.filter-btn');
  if (allBtn) filterByCategory('all', allBtn);
}

const searchEl = document.getElementById('searchInput');
if (searchEl) {
  const debouncedSearch = debounce(() => handleSearch(), 300);
  searchEl.addEventListener('input', debouncedSearch);
  searchEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });
}

// ══════════════════════════════════════════════════
//  FILTER BY CATEGORY
// ══════════════════════════════════════════════════
async function filterByCategory(category, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  if (category === 'all') { renderSchemes(allSchemes); return; }

  renderSkeletons();
  try {
    const res = await fetch(`${SCHEMES_API}/api/filter?category=${encodeURIComponent(category)}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      document.getElementById('schemesGrid').innerHTML = `
        <div class="no-results">
          <h3>Filter Error</h3>
          <p>${escapeHtml(data.error || 'Failed to filter schemes')}</p>
        </div>`;
      document.getElementById('resultsCount').innerHTML = 'Error filtering schemes';
      return;
    }
    renderSchemes(data.schemes || []);
  } catch {
    document.getElementById('schemesGrid').innerHTML = `<div class="no-results"><h3>Filter failed</h3><p>Please check your connection and try again</p></div>`;
    document.getElementById('resultsCount').textContent = 'Connection error';
  }
}

// ══════════════════════════════════════════════════
//  SCHEME DETAIL MODAL & SHARE (XSS-safe)
// ══════════════════════════════════════════════════
let currentModalScheme = null;

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
  if (descEl) descEl.textContent = s.description || '';
  if (benEl) benEl.textContent = s.benefits || '';
  if (applyEl) applyEl.href = sanitizeUrl(s.application_url);

  const e = s.eligibility || {};
  const incomeStr = e.income_limit ? '₹' + Number(e.income_limit).toLocaleString('en-IN') + ' / year' : 'No income cap';
  if (eligEl) {
    eligEl.innerHTML = `
      <div class="elig-item"><div class="elig-label">Age Range</div><div class="elig-value">${escapeHtml(e.min_age ?? 0)} – ${escapeHtml(e.max_age ?? 'No limit')} years</div></div>
      <div class="elig-item"><div class="elig-label">Gender</div><div class="elig-value">${escapeHtml(e.gender ?? 'All Citizens')}</div></div>
      <div class="elig-item"><div class="elig-label">Income Limit</div><div class="elig-value">${escapeHtml(incomeStr)}</div></div>
      <div class="elig-item"><div class="elig-label">Coverage State</div><div class="elig-value">${escapeHtml(e.state ?? 'All India')}</div></div>
    `;
  }

  if (tagsEl) {
    tagsEl.innerHTML = (s.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  }
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function shareOnWhatsApp() {
  if (!currentModalScheme) return;
  const text = `🇮🇳 *${currentModalScheme.title}*\n\n${currentModalScheme.description}\n\n*Key Benefits:* ${currentModalScheme.benefits}\n\nApply on official portal: ${currentModalScheme.application_url}\n\n_Discovered via Saral Niti Portal_`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
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

// ESC closes any modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDetector(); }
});

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
loadSchemes();
const placeholders = [
  "Search for farmer schemes...",
  "Search for health schemes...",
  "Search for student schemes...",
  "Search for women schemes...",
  "Search for housing schemes..."
];

let pIndex = 0;
setInterval(() => {
  pIndex = (pIndex + 1) % placeholders.length;
  const sEl = document.getElementById('searchInput');
  if (sEl) sEl.placeholder = placeholders[pIndex];
}, 3500);

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
