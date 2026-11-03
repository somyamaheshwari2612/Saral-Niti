# backend/routes/chatbot.py
# Rule-based citizen welfare chatbot backend

import re
from flask import Blueprint, request, jsonify

chatbot_bp = Blueprint('chatbot', __name__)

# Rule-based response map: ordered from specific multi-word phrases to general keywords
RULES = {
    "pm kisan": "PM-KISAN gives ₹6000/year to eligible farmers in 3 installments of ₹2000. You can apply at pmkisan.gov.in",
    "ayushman bharat": "Ayushman Bharat Yojana provides health insurance cover of up to ₹5 lakh per family per year for hospitalisation.",
    "ayushman": "Ayushman Bharat Yojana provides health insurance cover of up to ₹5 lakh per family per year for hospitalisation.",
    "farmer": "Here are some schemes for farmers:\n1. PM-KISAN — ₹6000/year income support\n2. Pradhan Mantri Fasal Bima Yojana — crop insurance\n3. Kisan Credit Card — easy credit access",
    "scholarship": "Here are some scholarship schemes for students:\n1. National Scholarship Portal (NSP) — central and UGC scholarships\n2. Post-Matric Scholarships for SC/ST/OBC\n3. PM Yashasvi Scheme",
    "student": "Here are some schemes for students:\n1. National Scholarship Portal — multiple scholarships\n2. PM Vidya Lakshmi — education loans\n3. Post Matric Scholarship — for SC/ST students",
    "women": "Here are some schemes for women:\n1. Beti Bachao Beti Padhao\n2. Ujjwala Yojana — free LPG connection\n3. PM Matru Vandana Yojana — maternity benefit",
    "health": "Here are health-related schemes:\n1. Ayushman Bharat — free health cover up to ₹5 lakh\n2. Janani Suraksha Yojana — safe motherhood\n3. PM Jan Arogya Yojana",
    "hello": "Namaste! 🙏 I am Saral Niti Bot. I can help you find government schemes. Try asking: 'schemes for farmers' or 'schemes for women'.",
    "hi": "Namaste! 🙏 How can I help you today? Ask me about government schemes.",
    "help": "You can ask me things like:\n- Schemes for farmers\n- Schemes for students\n- Schemes for women\n- What is PM Kisan?",
    "bye": "Thank you for using Saral Niti! Jai Hind 🇮🇳",
    "thanks": "You're welcome! Is there anything else I can help you with?",
    "thank you": "You're welcome! Is there anything else I can help you with?"
}

DEFAULT_RESPONSE = "I'm not sure about that. Try asking about schemes for farmers, women, students, or health. Type 'help' for more options."


@chatbot_bp.route('/api/chatbot', methods=['POST'])
def chatbot_reply():
    """Rule-based chatbot endpoint with word-boundary matching and input hardening"""
    data = request.get_json(silent=True)
    
    if not isinstance(data, dict) or 'message' not in data:
        return jsonify({"error": "No message provided"}), 400

    raw_message = data.get('message')
    if not isinstance(raw_message, str) or not raw_message.strip():
        return jsonify({"error": "Message must be a non-empty string"}), 400

    if len(raw_message) > 500:
        return jsonify({"error": "Message too long (max 500 characters)"}), 400

    user_message = raw_message.lower().strip()

    # Match rules with word boundaries to avoid substring false positives
    reply = DEFAULT_RESPONSE
    for keyword, response in RULES.items():
        pattern = rf"\b{re.escape(keyword)}(?:s|es)?\b"
        if re.search(pattern, user_message, re.IGNORECASE):
            reply = response
            break

    return jsonify({
        "reply": reply,
        "bot": "Saral Niti Bot"
    }), 200
