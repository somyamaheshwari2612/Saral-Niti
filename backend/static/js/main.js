// ══════════════════════════════════════════════════
//  CONFIG
//  SCHEMES_API  → Person 2's Flask backend (schemes)
//  ML_API       → ML Flask backend (URL detector)
// ══════════════════════════════════════════════════
const SCHEMES_API = 'https://saral-niti-backend.onrender.com';
const ML_API      = 'https://saral-niti-backend.onrender.com';

let allSchemes = [];

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

// ══════════════════════════════════════════════════
//  RENDER CARDS
// ══════════════════════════════════════════════════
function renderSchemes(schemes) {
  const grid = document.getElementById('schemesGrid');
  const count = document.getElementById('resultsCount');

  if (!schemes.length) {
    grid.innerHTML = `<div class="no-results"><h3>No schemes found</h3><p>Try a different search or category</p></div>`;
    count.innerHTML = 'No results found';
    return;
  }

  count.innerHTML = `Showing <strong>${schemes.length}</strong> scheme${schemes.length !== 1 ? 's' : ''}`;
  grid.innerHTML = schemes.map(s => `
    <div class="scheme-card" onclick="openModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">
      <div class="card-top">
        <span class="category-badge cat-${s.category}">${s.category}</span>
        <div class="active-dot"></div>
      </div>
      <div class="card-title">${s.title}</div>
      <div class="card-desc">${s.description}</div>
      <div class="card-benefit">${s.benefits}</div>
      <div class="card-footer">
        <span class="ministry-name">${s.ministry}</span>
        <a href="${s.application_url}" target="_blank" class="apply-btn" onclick="event.stopPropagation()">Apply ↗</a>
      </div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════════
async function handleSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) { renderSchemes(allSchemes); return; }
  document.getElementById('schemesGrid').innerHTML = `<div class="loading"><div class="spinner"></div><span>Searching...</span></div>`;
  try {
    const res = await fetch(`${SCHEMES_API}/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    renderSchemes(data.schemes || []);
  } catch {
    document.getElementById('schemesGrid').innerHTML = `<div class="no-results"><h3>Search failed</h3><p>Please try again</p></div>`;
  }
}
const searchEl = document.getElementById('searchInput');
if (searchEl) {
  searchEl.addEventListener('input', () => handleSearch());
  searchEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });
}

// ══════════════════════════════════════════════════
//  FILTER BY CATEGORY
// ══════════════════════════════════════════════════
async function filterByCategory(category, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('searchInput').value = '';

  if (category === 'all') { renderSchemes(allSchemes); return; }

  document.getElementById('schemesGrid').innerHTML = `<div class="loading"><div class="spinner"></div><span>Filtering...</span></div>`;
  try {
    const res = await fetch(`${SCHEMES_API}/api/filter?category=${category}`);
    const data = await res.json();
    renderSchemes(data.schemes || []);
  } catch {
    document.getElementById('schemesGrid').innerHTML = `<div class="no-results"><h3>Filter failed</h3></div>`;
  }
}

// ══════════════════════════════════════════════════
//  SCHEME DETAIL MODAL
// ══════════════════════════════════════════════════
function openModal(s) {
  document.getElementById('modalCategory').textContent = '🏛 ' + s.category.toUpperCase();
  document.getElementById('modalTitle').textContent = s.title;
  document.getElementById('modalMinistry').textContent = s.ministry + ' • Since ' + s.launched_year;
  document.getElementById('modalDesc').textContent = s.description;
  document.getElementById('modalBenefits').textContent = s.benefits;
  document.getElementById('modalApplyBtn').href = s.application_url;

  const e = s.eligibility || {};
  document.getElementById('modalEligibility').innerHTML = `
    <div class="elig-item"><div class="elig-label">Age Range</div><div class="elig-value">${e.min_age ?? 0} – ${e.max_age ?? 'No limit'} years</div></div>
    <div class="elig-item"><div class="elig-label">Gender</div><div class="elig-value">${e.gender ?? 'All'}</div></div>
    <div class="elig-item"><div class="elig-label">Income Limit</div><div class="elig-value">${e.income_limit ? '₹' + e.income_limit.toLocaleString('en-IN') : 'No limit'}</div></div>
    <div class="elig-item"><div class="elig-label">State</div><div class="elig-value">${e.state ?? 'All India'}</div></div>
  `;

  document.getElementById('modalTags').innerHTML = (s.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
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
      showDetectorResult('url', data.result, classifyResult(data.result));
    }
  } catch (err) {
    showDetectorResult('url',
      '❌ Could not connect to ML backend.\n\nMake sure Flask server is running on port 5001.\n\nError: ' + err.message,
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
      showDetectorResult('file', data.result, classifyResult(data.result));
    }
  } catch (err) {
    showDetectorResult('file',
      '❌ Could not connect to ML backend.\n\nMake sure Flask server is running on port 5001.\n\nError: ' + err.message,
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
  box.className = 'det-result-box ' + cssClass;
  document.getElementById(type + 'Result').classList.add('show');
}

function classifyResult(text) {
  const t = text.toUpperCase();
  if (t.includes('FAKE') || t.includes('HIGH') || t.includes('SCAM')) return 'fake';
  if (t.includes('SUSPICIOUS') || t.includes('MEDIUM')) return 'suspicious';
  if (t.includes('REAL') || t.includes('LEGITIMATE') || t.includes('LOW')) return 'real';
  return '';
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
