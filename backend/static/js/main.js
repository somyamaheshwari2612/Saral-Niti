// ══════════════════════════════════════════════════
//  CONFIG
//  Using relative URLs so local and production hosts work automatically
// ══════════════════════════════════════════════════
const SCHEMES_API = '';
const ML_API      = '';

let allSchemes = [];

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
    allSchemes = data.schemes || [];
    document.getElementById('totalCount').textContent = allSchemes.length + '+';
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
//  RENDER CARDS
// ══════════════════════════════════════════════════
function renderSchemes(schemes) {
  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');
  const resetBtn = document.getElementById('resetBtn');

  if (resetBtn) {
    const isFiltered = schemes.length !== allSchemes.length;
    resetBtn.style.display = isFiltered ? 'inline-flex' : 'none';
  }

  if (!schemes.length) {
    grid.innerHTML = `
      <div class="no-results">
        <h3>No schemes found matching your search</h3>
        <p>Try searching for different keywords or select "All Categories".</p>
      </div>`;
    count.innerHTML = 'Showing <strong>0</strong> schemes';
    return;
  }

  count.innerHTML = `Showing <strong>${schemes.length}</strong> verified scheme${schemes.length !== 1 ? 's' : ''}`;
  grid.innerHTML = schemes.map(s => {
    const icon = CATEGORY_ICONS[s.category] || '🏛';
    return `
    <div class="scheme-card" onclick="openModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">
      <div>
        <div class="card-top">
          <span class="category-badge cat-${s.category}">${icon} ${s.category}</span>
          <div class="active-dot" title="Active Scheme"></div>
        </div>
        <div class="card-title">${s.title}</div>
        <div class="card-desc">${s.description}</div>
        <div class="card-benefit">
          <i class="fa-solid fa-gift" style="margin-right:4px;"></i> ${s.benefits}
        </div>
      </div>
      <div class="card-footer">
        <span class="ministry-name" title="${s.ministry}"><i class="fa-solid fa-building-columns"></i> ${s.ministry}</span>
        <a href="${s.application_url}" target="_blank" rel="noopener noreferrer" class="apply-btn" onclick="event.stopPropagation()">
          <span>Apply</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>
  `}).join('');
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
    renderSchemes(data.schemes || []);
  } catch {
    document.getElementById('schemesGrid').innerHTML = `<div class="no-results"><h3>Search failed</h3><p>Please check your connection and try again</p></div>`;
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
    const res = await fetch(`${SCHEMES_API}/api/filter?category=${category}`);
    const data = await res.json();
    renderSchemes(data.schemes || []);
  } catch {
    document.getElementById('schemesGrid').innerHTML = `<div class="no-results"><h3>Filter failed</h3></div>`;
  }
}

// ══════════════════════════════════════════════════
//  SCHEME DETAIL MODAL & SHARE
// ══════════════════════════════════════════════════
let currentModalScheme = null;

function openModal(s) {
  currentModalScheme = s;
  const icon = CATEGORY_ICONS[s.category] || '🏛';
  document.getElementById('modalCategory').textContent = icon + ' ' + s.category.toUpperCase();
  document.getElementById('modalTitle').textContent = s.title;
  document.getElementById('modalMinistry').textContent = s.ministry + (s.launched_year ? ' • Launched ' + s.launched_year : '');
  document.getElementById('modalDesc').textContent = s.description;
  document.getElementById('modalBenefits').textContent = s.benefits;
  document.getElementById('modalApplyBtn').href = s.application_url;

  const e = s.eligibility || {};
  document.getElementById('modalEligibility').innerHTML = `
    <div class="elig-item"><div class="elig-label">Age Range</div><div class="elig-value">${e.min_age ?? 0} – ${e.max_age ?? 'No limit'} years</div></div>
    <div class="elig-item"><div class="elig-label">Gender</div><div class="elig-value">${e.gender ?? 'All Citizens'}</div></div>
    <div class="elig-item"><div class="elig-label">Income Limit</div><div class="elig-value">${e.income_limit ? '₹' + e.income_limit.toLocaleString('en-IN') + ' / year' : 'No income cap'}</div></div>
    <div class="elig-item"><div class="elig-label">Coverage State</div><div class="elig-value">${e.state ?? 'All India'}</div></div>
  `;

  document.getElementById('modalTags').innerHTML = (s.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function shareOnWhatsApp() {
  if (!currentModalScheme) return;
  const text = `🇮🇳 *${currentModalScheme.title}*\n\n${currentModalScheme.description}\n\n*Key Benefits:* ${currentModalScheme.benefits}\n\nApply on official portal: ${currentModalScheme.application_url}\n\n_Discovered via Saral Niti Portal_`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ══════════════════════════════════════════════════
//  URL DETECTOR — OPEN / CLOSE
// ══════════════════════════════════════════════════
function openDetector() {
  document.getElementById('detOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetector() {
  document.getElementById('detOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('urlInput').value = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('fileName').style.display = 'none';
  document.getElementById('fileName').textContent = '';
  ['url', 'file'].forEach(t => {
    document.getElementById(t + 'Spinner').classList.remove('show');
    document.getElementById(t + 'Result').classList.remove('show');
    document.getElementById(t + 'ResultBox').textContent = '';
    document.getElementById(t + 'ResultBox').className = 'det-result-box';
    document.getElementById(t + 'Btn').disabled = false;
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
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
    document.getElementById('panel-' + t).classList.toggle('active', t === tab);
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
  const url = document.getElementById('urlInput').value.trim();
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
    if (data.error) {
      showDetectorResult('url', '❌ Error: ' + data.error, 'fake');
    } else {
      showDetectorResult('url', data.result, classifyResult(data.result, data.verdict));
    }
  } catch (err) {
    showDetectorResult('url',
      '❌ Could not connect to backend server.\n\nError: ' + err.message,
      'fake'
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
  if (!fileInput.files.length) { alert('Please select a file first.'); return; }

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
    if (data.error) {
      showDetectorResult('file', '❌ Error: ' + data.error, 'fake');
    } else {
      showDetectorResult('file', data.result, classifyResult(data.result, data.verdict));
    }
  } catch (err) {
    showDetectorResult('file',
      '❌ Could not connect to backend server.\n\nError: ' + err.message,
      'fake'
    );
  } finally {
    setDetectorLoading('file', false);
  }
}

// ══════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════
function setDetectorLoading(type, loading) {
  document.getElementById(type + 'Btn').disabled = loading;
  document.getElementById(type + 'Spinner').classList.toggle('show', loading);
  if (loading) document.getElementById(type + 'Result').classList.remove('show');
}

function showDetectorResult(type, text, cssClass) {
  const box = document.getElementById(type + 'ResultBox');
  box.textContent = text;
  box.className = 'det-result-box ' + (cssClass || 'suspicious');
  document.getElementById(type + 'Result').classList.add('show');
}

function classifyResult(text, verdict) {
  if (verdict) return verdict.toLowerCase();
  if (!text) return 'suspicious';
  
  // Look for explicit Result: REAL/FAKE/SUSPICIOUS line
  const resultMatch = text.match(/Result:\s*(REAL|FAKE|SUSPICIOUS)/i);
  if (resultMatch) {
    return resultMatch[1].toLowerCase();
  }
  
  // Look for Risk Level: LOW/MEDIUM/HIGH line
  const riskMatch = text.match(/Risk Level:\s*(LOW|MEDIUM|HIGH)/i);
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
    icon.classList.replace('fa-moon', 'fa-sun');
    localStorage.setItem('darkMode', 'on');
  } else {
    icon.classList.replace('fa-sun', 'fa-moon');
    localStorage.setItem('darkMode', 'off');
  }
}

// Page load pe dark mode check karo
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'on') {
    document.documentElement.classList.add('dark-mode');
    document.getElementById('darkIcon').classList.replace('fa-moon', 'fa-sun');
  }
});

// ══════════════════════════════════════════════════
//  MOBILE MENU TOGGLE (hamburger <-> X animation)
// ══════════════════════════════════════════════════
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  const burger = document.querySelector('.hamburger');
  links.classList.toggle('open');
  if (burger) burger.classList.toggle('open');
}