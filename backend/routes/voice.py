# backend/routes/voice.py
# Voice-First Vernacular Input & Anti-Hallucination Query Normalizer for Rural Bharat
# Cascading Speech-to-Text: Tier 1 (whisper-large-v3-turbo) -> Tier 2 (whisper-large-v3) -> Tier 3 (Client Native STT)
# Guarded by 18 RPM ceiling to eliminate concurrency crashes and Groq 429 rate limit errors.
# Bilingual: Full Devanagari script (हिंदी) and Romanized Hinglish support.

import os
import re
import json
import requests
from flask import Blueprint, request, jsonify
from database import get_schemes_collection, scheme_to_dict, acquire_rate_limit_slot

voice_bp = Blueprint("voice", __name__)

# Concurrency & Rate Limiting Constants
GROQ_RPM_CEILING = 18     # 18 RPM ceiling provides a 2-RPM safety buffer below Groq's 20 RPM hard quota
CLIENT_RPM_CEILING = 8    # Fair-use per client IP to prevent single-user starvation
WINDOW_SECONDS = 60       # 60-second sliding rate limiting window

ALLOWED_AUDIO_MIMES = {
    'audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 
    'audio/x-m4a', 'audio/mp3', 'audio/aac', 'video/webm', 'application/octet-stream'
}

# ══════════════════════════════════════════════════
#  STOPWORD & CONNECTOR DICTIONARIES (VERNACULAR + EN)
# ══════════════════════════════════════════════════
HINDI_CONNECTORS = {
    # Romanized Hinglish
    'kya', 'hai', 'hain', 'tha', 'the', 'thi', 'ke', 'ki', 'ka', 'ko', 'se', 'me', 'mein', 
    'par', 'pe', 'liye', 'aur', 'ya', 'koi', 'kuch', 'bhi', 'to', 'toh', 'hi', 'ab', 'tak',
    'mujhe', 'mera', 'meri', 'mere', 'hum', 'humko', 'hume', 'hamara', 'hamare', 'hamaare', 
    'unka', 'unki', 'unke', 'unhe', 'unko', 'aap', 'aapka', 'aapki', 'aapke', 'tum', 'tumhara',
    'batao', 'chahiye', 'bataiye', 'hoga', 'hogi', 'hoge', 'kaise', 'milega', 'milegi', 'milege',
    'milta', 'milte', 'milti', 'milna', 'dena', 'karo', 'karna', 'kare', 'karen', 'hota', 'hote', 'hoti',
    'raha', 'rahe', 'rahi', 'hua', 'hue', 'hui', 'sakta', 'sakte', 'sakti', 'bata', 'de', 'do', 'jaise', 'aise',
    'bhai', 'sahab', 'sahib', 'sir', 'madam', 'kripya', 'please', 'namaste', 'shukriya', 'thanks',
    'sarkari', 'sarkar', 'yojana', 'yojna', 'yojanaye', 'scheme', 'schemes', 'portal', 'kitna', 'kitni',
    'paise', 'paisa', 'rupaye', 'rupiye', 'baare', 'wala', 'wali', 'wale', 'bhi',
    # Native Devanagari Script (देवनागरी)
    'क्या', 'है', 'हैं', 'था', 'थे', 'थी', 'के', 'की', 'का', 'को', 'से', 'में', 'मे', 'पर', 'पे',
    'लिए', 'और', 'या', 'कोई', 'कुछ', 'भी', 'तो', 'ही', 'अब', 'तक', 'मुझे', 'मेरा', 'मेरी', 'मेरे',
    'हम', 'हमको', 'हमें', 'हमारा', 'हमारे', 'उनका', 'उनकी', 'उनके', 'उन्हें', 'उनको', 'आप', 'आपका',
    'आपकी', 'आपके', 'तुम', 'तुम्हारा', 'बताओ', 'चाहिए', 'बताइए', 'होगा', 'होगी', 'होंगे', 'कैसे',
    'मिलेगा', 'मिलेगी', 'मिलेंगे', 'मिलता', 'मिलते', 'मिलती', 'मिलना', 'देना', 'करो', 'करना', 'करें',
    'होता', 'होते', 'होती', 'रहा', 'रहे', 'रही', 'हुआ', 'हुए', 'हुई', 'सकता', 'सकते', 'सकती', 'बता',
    'दे', 'दो', 'जैसे', 'ऐसे', 'भाई', 'साहब', 'सर', 'मैडम', 'कृपया', 'प्लीज', 'नमस्ते', 'शुक्रिया',
    'धन्यवाद', 'सरकारी', 'सरकार', 'योजना', 'योजनाएं', 'योजनाओं', 'पोर्टल', 'कितना', 'कितनी', 'पैसे',
    'पैसा', 'रुपये', 'रुपए', 'रुपया', 'बारे', 'वाला', 'वाली', 'वाले'
}

ENGLISH_CONNECTORS = {
    'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
    'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'on', 'at', 'of', 'by', 'with', 'about',
    'tell', 'me', 'how', 'what', 'where', 'which', 'who', 'whom', 'whose', 'why',
    'can', 'could', 'would', 'should', 'shall', 'will', 'may', 'might',
    'i', 'we', 'he', 'she', 'it', 'they', 'them', 'my', 'our', 'their', 'his', 'her', 'its', 'us', 'you', 'your',
    'get', 'any', 'some', 'there', 'here', 'do', 'does', 'did', 'have', 'has', 'had', 'from',
    'give', 'help', 'details', 'information', 'apply', 'applying', 'eligible', 'want', 'need',
    'government', 'govt', 'scheme', 'schemes', 'yojana', 'portal', 'please', 'sir', 'madam'
}

ALL_CONNECTORS = HINDI_CONNECTORS | ENGLISH_CONNECTORS

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh"
]

DEVANAGARI_STATES = {
    "उत्तर प्रदेश": "Uttar Pradesh", "बिहार": "Bihar", "राजस्थान": "Rajasthan",
    "मध्य प्रदेश": "Madhya Pradesh", "महाराष्ट्र": "Maharashtra", "पश्चिम बंगाल": "West Bengal",
    "गुजरात": "Gujarat", "हरियाणा": "Haryana", "पंजाब": "Punjab", "दिल्ली": "Delhi",
    "झारखंड": "Jharkhand", "छत्तीसगढ़": "Chhattisgarh", "उत्तराखंड": "Uttarakhand",
    "तमिलनाडु": "Tamil Nadu", "कर्नाटक": "Karnataka", "ओडिशा": "Odisha", "असम": "Assam"
}


def extract_dynamic_search_schema(raw_text):
    """
    Strips conversational noise, punctuation (including Devanagari purna viram), and filler particles.
    Extracts high-intent domain entities (beneficiary, category, state, keywords).
    Bilingual support for both Devanagari Hindi and Romanized Hinglish/English.
    """
    if not raw_text or not isinstance(raw_text, str):
        return {
            "intent": "general_inquiry",
            "beneficiary": None,
            "category": None,
            "state": None,
            "genuine_keywords": [],
            "clean_search_query": ""
        }

    # Clean punctuation, including Devanagari purna viram (। / ॥), dashes, and quotes
    cleaned = re.sub(r'[\?!,.:;\-_/\\()\[\]"\'\n\r\u0964\u0965\u2014\u2013\u201c\u201d\u2018\u2019]', ' ', raw_text.lower()).strip()
    tokens = [t for t in re.split(r'\s+', cleaned) if t]

    # 1. State extraction (English & Devanagari)
    detected_state = None
    lower_raw = raw_text.lower()
    for state_name in INDIAN_STATES:
        if state_name.lower() in lower_raw:
            detected_state = state_name
            break
    if not detected_state:
        for dev_name, eng_name in DEVANAGARI_STATES.items():
            if dev_name in raw_text:
                detected_state = eng_name
                break
    if not detected_state:
        if re.search(r'\b(up|uttar pradesh|u\.p\.)\b', lower_raw):
            detected_state = "Uttar Pradesh"
        elif re.search(r'\b(mp|madhya pradesh|m\.p\.)\b', lower_raw):
            detected_state = "Madhya Pradesh"
        elif re.search(r'\b(wb|west bengal|bangla|bengal)\b', lower_raw):
            detected_state = "West Bengal"

    # 2. Beneficiary / Persona extraction (Composite awareness in Hinglish + Devanagari)
    has_girl = any(k in tokens for k in ['beti', 'kanya', 'ladki', 'girl', 'daughter', 'shadi', 'बेटी', 'कन्या', 'लड़की', 'पुत्री'])
    has_student = any(k in tokens for k in ['student', 'chhatra', 'vidyarthi', 'padhai', 'study', 'college', 'school', 'coaching', 'छात्र', 'छात्रा', 'विद्यार्थी', 'पढ़ाई', 'शिक्षा'])
    has_farmer = any(k in tokens for k in ['kisan', 'farmer', 'krishi', 'kheti', 'kashtkar', 'batai', 'किसान', 'कृषि', 'खेती', 'काश्तकार'])
    has_woman = any(k in tokens for k in ['mahila', 'women', 'woman', 'aurat', 'mataji', 'mother', 'nari', 'patni', 'महिला', 'महिलाएं', 'औरत', 'माताजी', 'माता', 'नारी', 'पत्नी'])
    has_senior = any(k in tokens for k in ['bujurg', 'senior', 'vriddha', 'elderly', 'dada', 'dadi', 'grandfather', 'grandmother', 'old', 'बुजुर्ग', 'वृद्ध', 'वृद्धा', 'वरिष्ठ', 'दादा', 'दादी'])
    has_disabled = any(k in tokens for k in ['divyang', 'viklang', 'disabled', 'handicap', 'disability', 'दिव्यांग', 'विकलांग', 'अपंग'])
    has_widow = any(k in tokens for k in ['vidhwa', 'widow', 'विधवा'])

    detected_beneficiary = None
    if has_girl and has_student:
        detected_beneficiary = 'girl_student'
    elif has_girl:
        detected_beneficiary = 'daughter'
    elif has_widow:
        detected_beneficiary = 'widow'
    elif has_farmer:
        detected_beneficiary = 'farmer'
    elif has_student:
        detected_beneficiary = 'student'
    elif has_woman:
        detected_beneficiary = 'women'
    elif has_senior:
        detected_beneficiary = 'senior_citizen'
    elif has_disabled:
        detected_beneficiary = 'differently_abled'

    # 3. Category matching (direct DB slugs: agriculture, education, health, housing, women, financial, employment, youth, elderly, disability)
    detected_category = None
    if any(k in tokens for k in ['scholarship', 'chhatravritti', 'wazifa', 'padhai', 'education', 'stipend', 'fees', 'school', 'college', 'exam', 'छात्रवृत्ति', 'वजीफा', 'पढ़ाई', 'शिक्षा', 'फीस']):
        detected_category = 'education'
    elif any(k in tokens for k in ['kisan', 'fasal', 'khet', 'sinchai', 'tractor', 'fertilizer', 'beej', 'agriculture', 'krishi', 'mandi', 'khad', 'pmkisan', 'किसान', 'फसल', 'खेत', 'सिंचाई', 'ट्रैक्टर', 'खाद', 'बीज', 'कृषि']):
        detected_category = 'agriculture'
    elif any(k in tokens for k in ['health', 'swasthya', 'ayushman', 'ilaj', 'hospital', 'dawa', 'bimari', 'medical', 'clinic', 'operation', 'doctor', 'स्वास्थ्य', 'आयुष्मान', 'इलाज', 'अस्पताल', 'दवा', 'बीमारी', 'चिकित्सा']):
        detected_category = 'health'
    elif any(k in tokens for k in ['awas', 'makaan', 'ghar', 'housing', 'chhat', 'pmay', 'colony', 'shelter', 'आवास', 'मकान', 'घर', 'छत', 'बसेरा']):
        detected_category = 'housing'
    elif any(k in tokens for k in ['beti', 'kanya', 'mahila', 'woman', 'women', 'ladli', 'matritva', 'pregnancy', 'garbhavati', 'sukanya', 'बेटी', 'कन्या', 'महिला', 'लाडली', 'मातृत्व', 'गर्भवती', 'सुकन्या']):
        detected_category = 'women'
    elif any(k in tokens for k in ['mudra', 'loan', 'vyapar', 'dukan', 'business', 'credit', 'subvention', 'bank', 'khata', 'jandhan', 'bima', 'dbt', 'paisa', 'paise', 'ऋण', 'लोन', 'मुद्रा', 'व्यापार', 'दुकान', 'सब्सिडी', 'बैंक', 'खाता', 'जनधन', 'बीमा']):
        detected_category = 'financial'
    elif any(k in tokens for k in ['rojgar', 'naukri', 'job', 'skill', 'kaushal', 'training', 'apprentice', 'employment', 'placement', 'रोजगार', 'नौकरी', 'कौशल', 'प्रशिक्षण']):
        detected_category = 'employment'
    elif any(k in tokens for k in ['pension', 'bujurg', 'vriddha', 'elderly', 'senior', 'पेंशन', 'बुजुर्ग', 'वृद्धावस्था', 'वृद्ध']):
        detected_category = 'elderly'
    elif any(k in tokens for k in ['divyang', 'viklang', 'disabled', 'disability', 'udid', 'दिव्यांग', 'विकलांग']):
        detected_category = 'disability'

    # 4. Filter genuine discriminative keywords (leave out connector words)
    genuine_keywords = []
    for t in tokens:
        if t in ALL_CONNECTORS:
            continue
        if len(t) < 2:
            continue
        # Avoid redundant state words in the text search query if state is already captured
        if detected_state and t in detected_state.lower().split():
            continue
        genuine_keywords.append(t)

    # 5. Formulate clean search query
    clean_search_query = " ".join(genuine_keywords[:5]).strip()
    if not clean_search_query:
        # Fallback to category name if all words were connectors
        clean_search_query = detected_category or (tokens[0] if tokens else "welfare")

    return {
        "intent": "search_schemes",
        "beneficiary": detected_beneficiary,
        "category": detected_category,
        "state": detected_state,
        "genuine_keywords": genuine_keywords,
        "clean_search_query": clean_search_query
    }


def transcribe_audio_groq(audio_file_bytes, client_ip="127.0.0.1", filename="audio.webm", content_type="audio/webm"):
    """
    Tier 1 & Tier 2 cascading speech-to-text with Groq.
    Enforces a strict 18 RPM ceiling per model group to prevent race conditions and 429 quota exhaustion.
    Tier 1: whisper-large-v3-turbo (fastest, ~300ms, capped at 18 RPM)
    Tier 2: whisper-large-v3 (failover fallback, capped at 18 RPM)
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return None, {"error": "GROQ_API_KEY is not configured in backend/.env", "fallback_to_browser": True}

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {groq_api_key}"}

    scheme_prompt = (
        "Saral Niti, PM-KISAN, Ayushman Bharat, Pradhan Mantri Awas Yojana, "
        "DBT, Ration Card, Ladli Behna, Sukanya Samriddhi, scholarship, "
        "Jan Dhan, Jan Seva Kendra, Kisan Credit Card, kisan, pension, divyang, beti"
    )

    models_to_try = [
        ("whisper-large-v3-turbo", "groq_whisper_turbo", 1),
        ("whisper-large-v3", "groq_whisper_large", 2)
    ]
    last_error = None
    rate_limit_hits = []

    for model_name, rate_group, tier_num in models_to_try:
        # Check rate limiter ceiling: 18 RPM globally, 8 RPM per IP
        allowed, retry_after, reason = acquire_rate_limit_slot(
            endpoint_group=rate_group,
            client_ip=client_ip,
            global_limit=GROQ_RPM_CEILING,
            client_limit=CLIENT_RPM_CEILING,
            window_sec=WINDOW_SECONDS
        )

        if not allowed:
            rate_limit_hits.append(f"{model_name} rate limit reached ({reason}, retry in {retry_after}s)")
            # Tier is saturated at 18 RPM, automatically cascade to next tier!
            continue

        try:
            files = {
                "file": (filename, audio_file_bytes, content_type)
            }
            data = {
                "model": model_name,
                "temperature": 0.0,
                "prompt": scheme_prompt,
                "response_format": "json"
            }
            res = requests.post(url, headers=headers, files=files, data=data, timeout=12)
            if res.status_code == 200:
                result_json = res.json()
                raw_text = result_json.get("text", "").strip()
                if raw_text:
                    return {
                        "text": raw_text,
                        "model": model_name,
                        "tier": tier_num
                    }, None
            elif res.status_code == 429:
                last_error = f"Rate limit on {model_name} (HTTP 429)"
                continue
            else:
                last_error = f"Groq HTTP {res.status_code}: {res.text[:120]}"
        except Exception as e:
            last_error = str(e)
            continue

    # Both tiers are either rate-limited at 18 RPM or unavailable
    return None, {
        "status": "fallback",
        "fallback_to_browser": True,
        "message": "Cloud speech engines are at peak capacity (18 RPM concurrency guard). Switching to browser speech recognition.",
        "details": last_error or "; ".join(rate_limit_hits)
    }


@voice_bp.route("/api/voice/transcribe", methods=["POST"])
def voice_transcribe():
    """
    POST /api/voice/transcribe
    Accepts an audio recording file or raw transcribed text.
    Executes cascading STT (guarded by 18 RPM ceiling) and dynamic schema extraction.
    Returns clean search query, extracted entities, and top matched schemes.
    """
    try:
        raw_transcript = None
        model_used = None
        tier_used = None
        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr or "127.0.0.1"

        # 1. Check if raw text was passed (e.g. from Native Web Speech fallback or text test)
        if request.is_json:
            req_data = request.get_json(silent=True) or {}
            raw_transcript = req_data.get("text")
            model_used = "client-web-speech-api"
            tier_used = 3

        # 2. Check if audio file was uploaded
        if not raw_transcript and "file" in request.files:
            audio_file = request.files["file"]
            audio_bytes = audio_file.read()
            filename = audio_file.filename or "audio.webm"
            content_type = (audio_file.content_type or "audio/webm").lower().split(";")[0].strip()

            # Validation: Audio length and content-type sanity checks
            if len(audio_bytes) < 300:
                return jsonify({"error": "Audio clip too short or empty. Please speak for at least 1-2 seconds."}), 400

            if len(audio_bytes) > 6 * 1024 * 1024:
                return jsonify({"error": "Audio clip exceeds 6MB limit."}), 413

            # Groq cascading STT with 18 RPM rate limiter
            groq_res, groq_err = transcribe_audio_groq(
                audio_bytes, 
                client_ip=client_ip, 
                filename=filename, 
                content_type=content_type
            )

            if groq_res:
                raw_transcript = groq_res["text"]
                model_used = groq_res["model"]
                tier_used = groq_res["tier"]
            else:
                # Both cloud tiers exhausted or offline -> Fallback to client native STT
                return jsonify({
                    "status": "fallback",
                    "fallback_to_browser_stt": True,
                    "message": groq_err.get("message") if isinstance(groq_err, dict) else "Cloud speech engine busy.",
                    "details": groq_err
                }), 200

        if not raw_transcript:
            return jsonify({"error": "No audio file or text provided."}), 400

        # 3. Dynamic Schema Extraction & Stopword Removal (Anti-Hallucination Guard)
        schema = extract_dynamic_search_schema(raw_transcript)
        clean_query = schema["clean_search_query"]

        # 4. Search Database with Clean Genuine Terms & Category Prioritization
        schemes_collection = get_schemes_collection()
        matched_schemes = []
        search_mode = "keyword_match"

        if schemes_collection is not None:
            all_schemes = list(schemes_collection.find())
            scored = []

            for s in all_schemes:
                s_dict = scheme_to_dict(s)
                haystack = (
                    s_dict.get("title", "") + " " +
                    s_dict.get("description", "") + " " +
                    s_dict.get("category", "") + " " +
                    " ".join(s_dict.get("tags", [])) + " " +
                    s_dict.get("ministry", "")
                ).lower()

                score = 0
                for kw in schema["genuine_keywords"]:
                    if kw in haystack:
                        score += 2
                        if kw in s_dict.get("title", "").lower():
                            score += 3

                if schema["category"] and s_dict.get("category", "").lower() == schema["category"].lower():
                    score += 2

                if schema["state"]:
                    sch_state = (s_dict.get("state") or s_dict.get("eligibility", {}).get("state") or "all").lower()
                    if sch_state in (schema["state"].lower(), "all", "central"):
                        score += 1

                if score > 0:
                    scored.append((score, s_dict))

            scored.sort(key=lambda x: x[0], reverse=True)
            matched_schemes = [x[1] for x in scored[:24]]

            # Zero dead-end fallback: if no keyword matches but category detected, return top category schemes
            if not matched_schemes and schema["category"]:
                cat_matches = [
                    scheme_to_dict(s) for s in all_schemes 
                    if s.get("category", "").lower() == schema["category"].lower()
                ]
                matched_schemes = cat_matches[:24]
                search_mode = "category_fallback"

        return jsonify({
            "status": "ok",
            "model_used": model_used,
            "tier_used": tier_used,
            "raw_transcript": raw_transcript,
            "clean_search_query": clean_query,
            "search_mode": search_mode,
            "schema": schema,
            "matched_count": len(matched_schemes),
            "schemes": matched_schemes
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@voice_bp.route("/api/voice/normalize", methods=["POST"])
def voice_normalize():
    """
    POST /api/voice/normalize
    Extracts genuine keywords and dynamic schema directly from input text.
    """
    try:
        data = request.get_json(silent=True) or {}
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "Field 'text' is required."}), 400

        schema = extract_dynamic_search_schema(text)
        return jsonify({
            "status": "ok",
            "raw_text": text,
            "schema": schema
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
