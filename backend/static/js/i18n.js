/**
 * Saral Niti — Vernacular i18n Dictionary & Language Engine
 * Supports seamless bilingual switching: English (en) & Hindi (hi)
 */

const I18N_TRANSLATIONS = {
  en: {
    // Brand & Nav
    portal_name: "Saral",
    portal_sub: "Citizen Welfare Portal",
    nav_home: "Home",
    nav_browse: "Browse Schemes",
    nav_eligibility: "Check Eligibility",
    nav_about: "About",
    nav_scam: "Scam Detector",
    lang_toggle: "हिन्दी",

    // Hero Section
    hero_badge: "National Welfare Portal • Direct Benefit Discovery",
    hero_title_1: "Find the Right",
    hero_title_2: "Government Scheme",
    hero_title_3: "For You & Your Family",
    hero_sub: "Explore verified central and state welfare initiatives across agriculture, healthcare, education, and entrepreneurship with zero paperwork hurdles.",
    stat_schemes: "Schemes Catalogued",
    stat_states: "States & UTs Covered",
    stat_categories: "Welfare Categories",
    stat_direct: "Direct Benefit (DBT)",

    // Search & Filter
    search_placeholder: "Search schemes by keyword, benefit, or state (e.g. Kisan, Scholarship, PM Awas)...",
    search_filter_btn: "Filters",
    search_voice_title: "Voice Search in Hindi or English",
    filter_all: "All Schemes",
    filter_agri: "Agriculture",
    filter_edu: "Education & Skills",
    filter_health: "Healthcare",
    filter_finance: "Loans & Finance",
    filter_women: "Women & Child",
    filter_social: "Social Welfare",

    // Scheme Card & Details
    scheme_nodal: "Ministry / Department",
    scheme_view_btn: "View Details",
    scheme_elig_btn: "Check Eligibility",
    scheme_apply_btn: "Official Application",

    // Family Vault
    vault_title: "Family Welfare Vault",
    vault_sub: "Add household members to evaluate combined eligibility, DBT benefits, and document checklists.",
    vault_add_member: "Add Family Member",

    // Chatbot
    chat_title: "Saral Niti Sahayak",
    chat_status: "Online • Voice & Scheme RAG",
    chat_placeholder: "Ask about any scheme in English, हिन्दी, or Hinglish...",
    chat_voice_hint: "Listening... Speak now",
    chat_quick_farmer: "🌾 Kisan Schemes",
    chat_quick_student: "🎓 Scholarships",
    chat_quick_health: "🏥 Health & Ayushman",
    chat_quick_pension: "👴 Old Age Pension"
  },
  hi: {
    // Brand & Nav
    portal_name: "सरल",
    portal_sub: "नागरिक कल्याण पोर्टल",
    nav_home: "मुख्य पृष्ठ",
    nav_browse: "योजनाएं देखें",
    nav_eligibility: "पात्रता जांचें",
    nav_about: "परिचय",
    nav_scam: "फ्रॉड डिटेक्टर",
    lang_toggle: "English",

    // Hero Section
    hero_badge: "राष्ट्रीय जनकल्याण पोर्टल • प्रत्यक्ष लाभ खोज",
    hero_title_1: "अपने और परिवार के लिए",
    hero_title_2: "सही सरकारी योजना",
    hero_title_3: "सरल भाषा में खोजें",
    hero_sub: "कृषि, स्वास्थ्य, शिक्षा और रोजगार से जुड़ी सभी केंद्रीय और राज्य सरकार की योजनाओं की प्रामाणिक जानकारी बिना किसी परेशानी के प्राप्त करें।",
    stat_schemes: "कुल योजनाएं",
    stat_states: "राज्य और केंद्र शासित प्रदेश",
    stat_categories: "कल्याणकारी श्रेणियां",
    stat_direct: "प्रत्यक्ष लाभ (DBT)",

    // Search & Filter
    search_placeholder: "योजना का नाम, लाभ या राज्य खोजें (जैसे: किसान सम्मान, छात्रवृत्ति, आवास)...",
    search_filter_btn: "फ़िल्टर",
    search_voice_title: "हिंदी या अंग्रेजी में बोलकर खोजें",
    filter_all: "सभी योजनाएं",
    filter_agri: "कृषि एवं किसान",
    filter_edu: "शिक्षा एवं कौशल",
    filter_health: "स्वास्थ्य सेवाएं",
    filter_finance: "ऋण एवं वित्तीय",
    filter_women: "महिला एवं बाल",
    filter_social: "सामाजिक कल्याण",

    // Scheme Card & Details
    scheme_nodal: "मंत्रालय / विभाग",
    scheme_view_btn: "विवरण देखें",
    scheme_elig_btn: "पात्रता जांचें",
    scheme_apply_btn: "आधिकारिक आवेदन",

    // Family Vault
    vault_title: "पारिवारिक जनकल्याण वॉल्ट",
    vault_sub: "परिवार के सदस्यों को जोड़कर सामूहिक पात्रता, वित्तीय लाभ और आवश्यक दस्तावेजों की सूची देखें।",
    vault_add_member: "नया सदस्य जोड़ें",

    // Chatbot
    chat_title: "सरल नीति सहायक",
    chat_status: "सक्रिय • आवाज़ और योजना खोज",
    chat_placeholder: "हिंदी, English या हिंग्लिश में कोई भी सवाल पूछें...",
    chat_voice_hint: "सुन रहा हूँ... कृपया बोलिए",
    chat_quick_farmer: "🌾 किसान योजनाएं",
    chat_quick_student: "🎓 छात्रवृत्ति",
    chat_quick_health: "🏥 स्वास्थ्य व आयुष्मान",
    chat_quick_pension: "👴 वृद्धावस्था पेंशन"
  }
};

let currentLang = 'en';

function getStoredLanguage() {
  try {
    return localStorage.getItem('saral_language') || 'en';
  } catch (e) {
    return 'en';
  }
}

function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'hi') lang = 'en';
  currentLang = lang;
  try {
    localStorage.setItem('saral_language', lang);
  } catch (e) {}

  document.documentElement.setAttribute('lang', lang);

  // Update text for all elements with data-i18n
  const translatableElements = document.querySelectorAll('[data-i18n]');
  translatableElements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (I18N_TRANSLATIONS[lang] && I18N_TRANSLATIONS[lang][key]) {
      el.textContent = I18N_TRANSLATIONS[lang][key];
    }
  });

  // Update placeholders
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (I18N_TRANSLATIONS[lang] && I18N_TRANSLATIONS[lang][key]) {
      el.setAttribute('placeholder', I18N_TRANSLATIONS[lang][key]);
    }
  });

  // Update titles/tooltips
  const titleElements = document.querySelectorAll('[data-i18n-title]');
  titleElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (I18N_TRANSLATIONS[lang] && I18N_TRANSLATIONS[lang][key]) {
      el.setAttribute('title', I18N_TRANSLATIONS[lang][key]);
    }
  });

  // Update the language toggle button label
  const langToggleBtn = document.getElementById('langToggleText');
  if (langToggleBtn) {
    langToggleBtn.textContent = lang === 'en' ? 'हिन्दी' : 'English';
  }

  // Update recognition language if speech recognition is active
  if (typeof window !== 'undefined' && window.recognition) {
    window.recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  }

  // Trigger event for any other component listening for language changes
  window.dispatchEvent(new CustomEvent('saralLanguageChange', { detail: { lang } }));
}

function toggleLanguage() {
  const newLang = currentLang === 'en' ? 'hi' : 'en';
  setLanguage(newLang);
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const initialLang = getStoredLanguage();
  setLanguage(initialLang);
});
