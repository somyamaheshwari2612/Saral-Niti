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

function formatSchemeCardHTML(s, idx) {
  const icon = CATEGORY_ICONS[s.category] || '🏛';
  const safeCat = escapeHtml(s.category || 'general');
  const safeTitle = escapeHtml(s.title || '');
  const safeDesc = escapeHtml(s.description || '');
  const safeBenefits = escapeHtml(s.benefits || '');
  const safeMinistry = escapeHtml(s.ministry || '');
  const safeUrl = sanitizeUrl(s.application_url);

  return `
    <div class="scheme-card fade-in-card" data-index="${idx}" tabindex="0" role="button" aria-label="View details for ${safeTitle}">
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
    if (!append && grid) {
      grid.innerHTML = `
        <div class="no-results">
          <h3>Could not connect to server</h3>
          <p>Make sure your Flask backend is running on port 5000</p>
        </div>`;
      if (count) count.textContent = 'Connection error';
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

function setupAutoScrollObserver() {
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
  const cards = document.querySelectorAll('#schemesGrid .scheme-card');
  const displayedCount = cards.length;
  const total = isServerBrowsing ? totalAvailableSchemes : currentSchemesList.length;

  if (count) {
    count.innerHTML = `Showing <strong>${displayedCount}</strong> of <strong>${total.toLocaleString('en-IN')}</strong> verified schemes`;
  }

  if (paginationWrap) {
    paginationWrap.style.display = total > 0 ? 'flex' : 'none';
  }

  if (paginationInfo) {
    const hasMore = isServerBrowsing ? hasMoreServerSchemes : (displayedCount < total);
    if (hasMore) {
      paginationInfo.innerHTML = `Loaded <strong>${displayedCount}</strong> of <strong>${total.toLocaleString('en-IN')}</strong> schemes (auto-loading as you scroll)`;
    } else {
      paginationInfo.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10B981; margin-right:5px;"></i> All <strong>${total.toLocaleString('en-IN')}</strong> verified schemes loaded`;
    }
  }

  setupAutoScrollObserver();
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
      document.getElementById('schemesGrid').innerHTML = `
        <div class="no-results">
          <h3>Filter Error</h3>
          <p>${escapeHtml(data.error || 'Failed to apply filters')}</p>
        </div>`;
      document.getElementById('resultsCount').innerHTML = 'Error applying filters';
      return;
    }
    renderSchemes(data.schemes || []);
  } catch (err) {
    document.getElementById('schemesGrid').innerHTML = `
      <div class="no-results">
        <h3>Filter failed</h3>
        <p>Please check your connection and try again</p>
      </div>`;
    document.getElementById('resultsCount').textContent = 'Connection error';
  }
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
    closeEligibilityModal();
    openModal(currentEligRecommendations[idx].scheme);
    setTimeout(() => {
      const auditSec = document.getElementById('modalPreAuditSection');
      if (auditSec) {
        auditSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }
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
  setVal('eligOccupation', member.occupation || 'other');

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
