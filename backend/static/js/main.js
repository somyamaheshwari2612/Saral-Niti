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
const PAGE_SIZE = 24;
let currentPage = 1;

function renderSchemes(schemes, resetPage = true) {
  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');
  const resetBtn = document.getElementById('resetBtn');
  const paginationWrap = document.getElementById('paginationWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const paginationInfo = document.getElementById('paginationInfo');

  if (resetPage) {
    currentPage = 1;
    currentSchemesList = Array.isArray(schemes) ? schemes : [];
  }

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
    if (paginationWrap) paginationWrap.style.display = 'none';
    return;
  }

  const total = currentSchemesList.length;
  const displayedCount = Math.min(currentPage * PAGE_SIZE, total);
  count.innerHTML = `Showing <strong>${displayedCount}</strong> of <strong>${total.toLocaleString('en-IN')}</strong> verified schemes`;

  const visibleSchemes = currentSchemesList.slice(0, displayedCount);
  grid.innerHTML = visibleSchemes.map((s, idx) => {
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

  if (paginationWrap) {
    if (displayedCount < total) {
      paginationWrap.style.display = 'flex';
      if (loadMoreBtn) {
        const remaining = total - displayedCount;
        loadMoreBtn.style.display = 'inline-flex';
        loadMoreBtn.querySelector('span').textContent = `Load More Schemes (${Math.min(PAGE_SIZE, remaining)} more)`;
      }
      if (paginationInfo) {
        paginationInfo.textContent = `Showing ${displayedCount} of ${total.toLocaleString('en-IN')} total schemes`;
      }
    } else {
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      if (paginationInfo) {
        paginationInfo.textContent = `All ${total.toLocaleString('en-IN')} schemes displayed`;
      }
      paginationWrap.style.display = total > PAGE_SIZE ? 'flex' : 'none';
    }
  }
}

function loadMoreSchemes() {
  currentPage++;
  renderSchemes(currentSchemesList, false);
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

  const levelEl = document.getElementById('modalLevel');
  const verEl = document.getElementById('modalVerified');
  const docsEl = document.getElementById('modalDocs');

  if (levelEl) levelEl.textContent = (s.level === 'state' ? 'State Government' : 'Central Government');
  if (verEl) verEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verified Data • ${escapeHtml(s.last_verified_at || '2026')}`;

  if (docsEl) {
    const docs = Array.isArray(s.documents_required) && s.documents_required.length > 0
      ? s.documents_required
      : ['Aadhaar Card', 'Bank Account Details'];
    docsEl.innerHTML = docs.map(d => `<span class="doc-pill"><i class="fa-solid fa-file-check"></i> ${escapeHtml(d)}</span>`).join('');
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

// ══════════════════════════════════════════════════
//  PERSONALIZATION / ELIGIBILITY CHECKER
// ══════════════════════════════════════════════════
let currentEligRecommendations = [];

function openEligibilityModal() {
  const overlay = document.getElementById('eligibilityOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
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

  const payload = {
    age: ageVal ? Number(ageVal) : null,
    gender: document.getElementById('eligGender').value,
    state: document.getElementById('eligState').value,
    income: incomeVal ? Number(incomeVal) : null,
    caste: document.getElementById('eligCaste').value,
    occupation: document.getElementById('eligOccupation').value,
    is_student: document.getElementById('eligIsStudent').checked,
    is_differently_abled: document.getElementById('eligIsDisabled').checked
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
    resultsTitle.textContent = `Found ${currentEligRecommendations.length} Matching Schemes`;
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

    resultsList.innerHTML = currentEligRecommendations.map((rec, idx) => {
      const s = rec.scheme;
      const isEligible = rec.status === 'eligible';
      const scoreBadgeClass = isEligible ? 'eligible' : 'partial';
      const scoreBadgeText = isEligible ? `${rec.match_score}% Match • Eligible` : `${rec.match_score}% • Partial Match`;

      const reasonsHtml = (rec.reasons || []).map(r => `<li><i class="fa-solid fa-check"></i> ${escapeHtml(r)}</li>`).join('');
      const unmetHtml = (rec.unmet_criteria || []).map(u => `<li><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(u)}</li>`).join('');

      return `
        <div class="elig-result-card">
          <div class="elig-card-top">
            <span class="category-badge cat-${escapeHtml(s.category || 'general')}">${escapeHtml(s.category || 'Welfare')}</span>
            <span class="match-score-badge ${scoreBadgeClass}">${scoreBadgeText}</span>
          </div>
          <div class="elig-card-title">${escapeHtml(s.title)}</div>
          <div class="elig-card-ministry"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(s.ministry || 'Government of India')}</div>
          
          ${reasonsHtml ? `<ul class="elig-reasons-list">${reasonsHtml}</ul>` : ''}
          ${unmetHtml ? `<ul class="elig-unmet-list">${unmetHtml}</ul>` : ''}

          <div class="elig-card-action">
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
