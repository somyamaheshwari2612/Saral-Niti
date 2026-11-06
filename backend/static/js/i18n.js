/**
 * Saral Niti — Vernacular i18n Dictionary & Language Engine
 * Supports seamless bilingual switching: English (en) & Hindi (hi)
 * Designed for citizen-first simplicity (Saral Bhasha), replacing heavy bureaucratic legal jargon.
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
    nav_install: "Install App",
    lang_toggle: "हिन्दी",

    // Hero Section
    hero_badge: "Government Scheme Center • Direct Benefits in Your Bank Account",
    hero_title_1: "Find the Right",
    hero_title_2: "Government Scheme",
    hero_title_3: "In Simple Words for You & Family",
    hero_sub: "Explore verified welfare schemes across farming, healthcare, education, and jobs — in simple language with zero paperwork confusion.",
    search_placeholder: "Search schemes by keyword, benefit, or state (e.g. Kisan, Scholarship, PM Awas)...",
    search_btn: "Search",
    popular_label: "Popular:",
    chip_eligibility: "Check Eligibility",
    chip_kisan: "🌾 PM Kisan",
    chip_ayushman: "🏥 Ayushman Bharat",
    chip_scholarships: "📚 Scholarships",
    chip_women: "👩 Women Welfare",
    chip_housing: "🏠 Awas Yojana",

    // Metric Stats
    stat_active_schemes: "Active Schemes",
    stat_target_sectors: "Key Sectors",
    stat_official_free: "Official & Free",
    stat_ai_fraud: "Safe & Verified",

    // Scheme Directory Headings & Categories
    sec_category_directory: "Category Directory",
    sec_schemes_title: "Explore Welfare Schemes by Sector & Needs",
    sec_schemes_sub: "Find government support for farming, studies, healthcare, pension, and small business",
    cat_all: "✨ All Categories",
    cat_agri: "🌾 Agriculture",
    cat_health: "🏥 Healthcare",
    cat_edu: "📚 Education",
    cat_housing: "🏠 Housing",
    cat_employment: "💼 Employment",
    cat_women: "👩 Women & Child",
    cat_financial: "💰 Financial Aid",
    cat_elderly: "👴 Senior Citizens",
    cat_youth: "🧑 Youth & Skill",
    cat_disability: "♿ Divyangjan",

    // Filter Controls
    btn_adv_filters: "Advanced Filters",
    pill_all: "All Types",
    pill_dbt: "Direct Cash (DBT)",
    pill_subsidy: "Subsidies",
    pill_loan: "Loans & Credit",
    pill_scholarship: "Scholarships",
    pill_in_kind: "In-Kind",
    pill_insurance: "Insurance",
    btn_reset_filters: "Reset All Filters",
    active_filters_label: "Active Filters:",
    btn_clear_all: "Clear All",
    loading_schemes: "Loading next 24 schemes...",
    btn_load_more: "Load More Schemes",

    // Scheme Cards & Modal
    card_apply: "Apply",
    card_active_title: "Active Scheme",
    card_details: "View Details",
    modal_verified: "Verified Scheme",
    modal_sec_about: "About this Scheme",
    modal_sec_benefits: "Key Benefits",
    modal_sec_eligibility: "Eligibility Criteria",
    modal_sec_docs: "Required Documents",
    modal_sec_tags: "Related Tags",
    modal_btn_apply: "Apply on Official Portal",
    modal_btn_checklist: "Checklist",
    modal_btn_ask_sahayak: "Ask Sahayak",
    modal_btn_share: "Share",
    modal_btn_close: "Close",
    modal_disclaimer: "Citizen Advisory: Informational only. Official terms, deadlines, and benefits must be verified on official ministry portals. Saral Niti is completely free.",
    modal_elig_age: "Age Range",
    modal_elig_gender: "Gender",
    modal_elig_income: "Income Limit",
    modal_elig_state: "Coverage State",
    elig_no_limit: "No limit",
    elig_years: "years",
    elig_all_citizens: "All Citizens",
    elig_all_india: "All India",
    elig_no_income_cap: "No income cap",
    modal_level_state: "State Government",
    modal_level_central: "Central Government",
    modal_verified_prefix: "Verified Data",

    // Step 2: 3 Golden Questions & Plain Language Simplifier
    modal_tab_saral: "🌟 Plain Summary (Simple Words)",
    modal_tab_official: "🏛️ Official Text (Gazette)",
    saral_explainer_badge: "Plain Language Explainer",
    saral_read_time: "1-Min Summary",
    golden_q1_title: "1. What Will I Get? (Direct Benefits)",
    golden_q1_sub: "Direct cash transfer, monthly pension, subsidies, or services",
    golden_q2_title: "2. Who Is Eligible? (Qualification Rules)",
    golden_q2_sub: "Simple rules on age, income, occupation, and family status",
    golden_q3_title: "3. What Papers to Bring? (CSC Checklist)",
    golden_q3_sub: "Keep original documents and photocopies ready for Jan Seva Kendra / CSC",
    golden_kendra_tip: "💡 Jan Seva Kendra / CSC Tip: Carry original copies and one self-attested photocopy of each document.",
    saral_dbt_badge: "Direct Bank Transfer (DBT)",
    saral_doc_original: "Original + Copy",
    saral_rule_age: "Age Limit",
    saral_rule_income: "Family Income",
    saral_rule_gender: "Gender",
    saral_rule_state: "State / UT",
    saral_rule_work: "Occupation & Group",

    // Family Vault
    vault_title: "Family Welfare Passbook",
    vault_sub: "Add all household members (parents, children) to discover eligible schemes and consolidated document checklists.",
    vault_add_member: "Add Family Member",

    // Chatbot
    chat_title: "Saral Niti Sahayak",
    chat_status: "Online • Voice & Scheme Assistant",
    chat_placeholder: "Ask about any scheme in English, हिन्दी, or Hinglish...",
    chat_voice_hint: "Listening... Speak now",
    chat_quick_farmer: "🌾 Kisan Schemes",
    chat_quick_student: "🎓 Scholarships",
    chat_quick_health: "🏥 Health & Ayushman",
    chat_quick_pension: "👴 Old Age Pension",

    // Footer
    footer_tagline: "Empowering every Indian citizen with simple, transparent, and verified access to central and state welfare benefits.",
    footer_links_title: "Platform Links",
    footer_gov_title: "Official Portals",
    footer_contact_title: "Developed By",
    footer_disclaimer: "Saral Niti is an independent citizen discovery platform. Always verify final guidelines on respective official ministry websites.",
    footer_back_top: "Back to Top ↑",
    footer_link_home: "Home Portal",
    footer_link_browse: "Browse All Schemes",
    footer_link_eligibility: "Check Eligibility",
    footer_link_scam: "AI Scam Verifier",
    footer_link_chat: "Chat with Assistant",
    footer_link_mail: "Mail Us",
    footer_github: "View on GitHub",
    footer_made_with: "© 2026 Saral Niti — Made with ❤️ for the Citizens of India 🇮🇳",

    // Offline Status & PWA
    offline_banner_text: "📡 Offline Mode Active (Gram Panchayat Cache) — Browsing cached schemes & Welfare Passbook.",
    offline_banner_retry: "Check Connection",
    offline_banner_checking: "Checking network connection...",
    offline_banner_reconnected: "🟢 Reconnected to Saral Niti Network — Live scheme sync enabled.",
    offline_results_count: "Showing <strong>{count}</strong> schemes from Gram Panchayat Offline Cache 📡",
    offline_empty_title: "Could not connect to server",
    offline_empty_sub: "You appear to be offline with no cached schemes yet. Please connect to internet."
  },
  hi: {
    // Brand & Nav
    portal_name: "सरल",
    portal_sub: "नागरिक कल्याण केंद्र",
    nav_home: "मुख्य पृष्ठ",
    nav_browse: "सभी योजनाएं",
    nav_eligibility: "पात्रता जांचें",
    nav_about: "हमारे बारे में",
    nav_scam: "फ़्रॉड डिटेक्टर",
    nav_install: "ऐप इंस्टॉल करें",
    lang_toggle: "English",

    // Hero Section (Citizen-First "Saral Bhasha")
    hero_badge: "सरकारी योजना केंद्र • सीधा फ़ायदा आपके बैंक खाते में",
    hero_title_1: "अपने और परिवार के लिए",
    hero_title_2: "सही सरकारी योजना",
    hero_title_3: "सीधे और आसान शब्दों में खोजें",
    hero_sub: "खेती, इलाज, पढ़ाई और रोज़गार की सभी सरकारी योजनाओं की सही जानकारी — बिना किसी बिचौलिए या कागज़ी परेशानी के।",
    search_placeholder: "योजना का नाम, फ़ायदा या अपना राज्य खोजें (जैसे: किसान, छात्रवृत्ति, आवास)...",
    search_btn: "खोजें",
    popular_label: "लोकप्रिय:",
    chip_eligibility: "पात्रता जांचें",
    chip_kisan: "🌾 पीएम किसान",
    chip_ayushman: "🏥 आयुष्मान भारत",
    chip_scholarships: "📚 छात्रवृत्ति",
    chip_women: "👩 महिला कल्याण",
    chip_housing: "🏠 आवास योजना",

    // Metric Stats
    stat_active_schemes: "सक्रिय योजनाएं",
    stat_target_sectors: "प्रमुख श्रेणियां",
    stat_official_free: "सरकारी व निःशुल्क",
    stat_ai_fraud: "सुरक्षित व प्रमाणित",

    // Scheme Directory Headings & Categories
    sec_category_directory: "योजना श्रेणियां",
    sec_schemes_title: "अपनी ज़रूरत और काम के अनुसार योजनाएं खोजें",
    sec_schemes_sub: "खेती, पढ़ाई, इलाज, पेंशन और छोटे व्यापार से जुड़ी सभी सरकारी योजनाएं देखें",
    cat_all: "✨ सभी श्रेणियां",
    cat_agri: "🌾 खेती-किसानी",
    cat_health: "🏥 इलाज व अस्पताल",
    cat_edu: "📚 पढ़ाई व छात्रवृत्ति",
    cat_housing: "🏠 आवास व मकान",
    cat_employment: "💼 रोज़गार व नौकरी",
    cat_women: "👩 महिला व बाल कल्याण",
    cat_financial: "💰 लोन व आर्थिक मदद",
    cat_elderly: "👴 बुज़ुर्ग व पेंशन",
    cat_youth: "🧑 युवा व हुनर",
    cat_disability: "♿ दिव्यांग सहायता",

    // Filter Controls
    btn_adv_filters: "विस्तृत फ़िल्टर",
    pill_all: "सभी प्रकार",
    pill_dbt: "खाते में नकद (DBT)",
    pill_subsidy: "सब्सिडी (छूट)",
    pill_loan: "सस्ता लोन",
    pill_scholarship: "छात्रवृत्ति",
    pill_in_kind: "मुफ़्त सामान/राशन",
    pill_insurance: "बीमा सुरक्षा",
    btn_reset_filters: "सभी फ़िल्टर हटाएं",
    active_filters_label: "लागू फ़िल्टर:",
    btn_clear_all: "सभी हटाएं",
    loading_schemes: "अगली 24 योजनाएं ला रहे हैं...",
    btn_load_more: "और योजनाएं देखें",

    // Scheme Cards & Modal
    card_apply: "आवेदन करें",
    card_active_title: "सक्रिय योजना",
    card_details: "पूरी जानकारी देखें",
    modal_verified: "सत्यापित योजना",
    modal_sec_about: "योजना के बारे में",
    modal_sec_benefits: "ज़रूरी लाभ व फ़ायदे",
    modal_sec_eligibility: "पात्रता (किसे मिलेगा लाभ)",
    modal_sec_docs: "ज़रूरी कागज़ात (दस्तावेज़)",
    modal_sec_tags: "संबंधित विषय",
    modal_btn_apply: "सरकारी पोर्टल पर आवेदन करें",
    modal_btn_checklist: "कागज़ात सूची",
    modal_btn_ask_sahayak: "सरल साथी से पूछें",
    modal_btn_share: "शेयर करें",
    modal_btn_close: "बंद करें",
    modal_disclaimer: "नागरिक सूचना: यह केवल जानकारी हेतु है। आवेदन करने से पहले आधिकारिक वेबसाइट पर नियम अवश्य जांचें। सरल नीति पूरी तरह निःशुल्क है।",
    modal_elig_age: "उम्र सीमा",
    modal_elig_gender: "लिंग",
    modal_elig_income: "वार्षिक पारिवारिक आय",
    modal_elig_state: "योजना क्षेत्र / राज्य",
    elig_no_limit: "कोई सीमा नहीं",
    elig_years: "वर्ष",
    elig_all_citizens: "सभी नागरिक",
    elig_all_india: "पूरे भारत में लागू",
    elig_no_income_cap: "आय की कोई सीमा नहीं",
    modal_level_state: "राज्य सरकार",
    modal_level_central: "केंद्र सरकार",
    modal_verified_prefix: "सत्यापित जानकारी",

    // Step 2: 3 Golden Questions & Plain Language Simplifier
    modal_tab_saral: "🌟 सरल सारांश (आसान भाषा)",
    modal_tab_official: "🏛️ सरकारी विवरण (विभागीय भाषा)",
    saral_explainer_badge: "सरल भाषा में समझें",
    saral_read_time: "1 मिनट में समझें",
    golden_q1_title: "1. मुझे क्या मिलेगा? (सीधा फ़ायदा)",
    golden_q1_sub: "नकद राशि, पेंशन, सब्सिडी या मुफ़्त सरकारी सहायता",
    golden_q2_title: "2. कौन पात्र है? (किसे मिलेगा लाभ)",
    golden_q2_sub: "उम्र, आय, ज़मीन और परिवार से जुड़ी मुख्य शर्तें",
    golden_q3_title: "3. क्या कागज़ ले जाने हैं? (सीएससी चेकलिस्ट)",
    golden_q3_sub: "जन सेवा केंद्र या ऑनलाइन आवेदन हेतु मूल दस्तावेज़",
    golden_kendra_tip: "💡 सीएससी / जन सेवा केंद्र टिप: इन सभी कागज़ातों की मूल प्रति और एक-एक स्वप्रमाणित फ़ोटोकॉपी साथ ले जाएं।",
    saral_dbt_badge: "सीधे बैंक खाते में (DBT)",
    saral_doc_original: "मूल प्रति + फ़ोटोकॉपी",
    saral_rule_age: "उम्र सीमा",
    saral_rule_income: "पारिवारिक आय",
    saral_rule_gender: "लिंग",
    saral_rule_state: "योजना क्षेत्र / राज्य",
    saral_rule_work: "पेशा व वर्ग",

    // Family Vault
    vault_title: "परिवार का वेलफेयर खाता",
    vault_sub: "अपने पूरे परिवार (माता-पिता, बच्चों) को जोड़ें और देखें किसको किस योजना का फ़ायदा मिलेगा।",
    vault_add_member: "नया सदस्य जोड़ें",

    // Chatbot
    chat_title: "सरल नीति साथी",
    chat_status: "सक्रिय • आवाज़ और योजना खोज",
    chat_placeholder: "हिंदी, English या हिंग्लिश में कोई भी सवाल पूछें...",
    chat_voice_hint: "सुन रहा हूँ... कृपया बोलिए",
    chat_quick_farmer: "🌾 किसान योजनाएं",
    chat_quick_student: "🎓 छात्रवृत्ति",
    chat_quick_health: "🏥 स्वास्थ्य व आयुष्मान",
    chat_quick_pension: "👴 वृद्धावस्था पेंशन",

    // Footer
    footer_tagline: "भारत के हर नागरिक तक सरकारी योजनाओं का लाभ सरल, पारदर्शी और सही तरीके से पहुँचाने का प्रयास।",
    footer_links_title: "महत्वपूर्ण लिंक",
    footer_gov_title: "सरकारी पोर्टल",
    footer_contact_title: "निर्माता",
    footer_disclaimer: "सरल नीति एक स्वतंत्र नागरिक सहायता मंच है। अंतिम दिशा-निर्देश संबंधित मंत्रालय की आधिकारिक वेबसाइट पर अवश्य जांचें।",
    footer_back_top: "वापस ऊपर जाएं ↑",
    footer_link_home: "मुख्य पोर्टल",
    footer_link_browse: "सभी योजनाएं देखें",
    footer_link_eligibility: "पात्रता जांचें",
    footer_link_scam: "AI फ्रॉड डिटेक्टर",
    footer_link_chat: "सरल सहायक से बात करें",
    footer_link_mail: "संपर्क / सुझाव",
    footer_github: "गिटहब पर देखें",
    footer_made_with: "© 2026 सरल नीति — भारत के नागरिकों के लिए सस्नेह समर्पित 🇮🇳",

    // Offline Status & PWA
    offline_banner_text: "📡 ऑफलाइन मोड चालू (ग्राम पंचायत सुरक्षित डेटा) — सहेजी गई योजनाएं और कल्याण पासबुक देख रहे हैं।",
    offline_banner_retry: "दोबारा जांचें",
    offline_banner_checking: "इंटरनेट जांच रहे हैं...",
    offline_banner_reconnected: "🟢 सरल नीति से पुनः जुड़ गए — ताज़ा योजनाएं लोड हो रही हैं।",
    offline_results_count: "ग्राम पंचायत सुरक्षित डेटा: <strong>{count}</strong> प्रमुख योजनाएं प्रदर्शित 📡",
    offline_empty_title: "सर्वर से संपर्क नहीं हो सका",
    offline_empty_sub: "आप ऑफलाइन प्रतीत हो रहे हैं। कृपया इंटरनेट कनेक्शन की जांच करें।"
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

function t(key, fallback = '') {
  const lang = currentLang || 'en';
  if (I18N_TRANSLATIONS[lang] && I18N_TRANSLATIONS[lang][key]) {
    return I18N_TRANSLATIONS[lang][key];
  }
  if (I18N_TRANSLATIONS.en && I18N_TRANSLATIONS.en[key]) {
    return I18N_TRANSLATIONS.en[key];
  }
  return fallback || key;
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
      const val = I18N_TRANSLATIONS[lang][key];
      if (val.includes('<') && val.includes('>')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
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

  // Update search placeholder immediately
  if (typeof updateSearchPlaceholder === 'function') {
    updateSearchPlaceholder();
  }

  // Trigger event for dynamic components (cards, filters, passbook)
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
