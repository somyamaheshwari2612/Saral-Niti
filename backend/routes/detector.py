import os
import re
import requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv

# Ensure .env is loaded reliably regardless of current working directory
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, '..', '.env'))

# Optional/guarded imports so app can start even if optional dependencies are not installed
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    pdfplumber = None
    PDFPLUMBER_AVAILABLE = False

detector_bp = Blueprint('detector', __name__)

def get_api_key():
    """Retrieve Gemini API Key (supports GROQ_API_KEY as fallback)"""
    return os.getenv("GEMINI_API_KEY") or os.getenv("GROQ_API_KEY")

def get_model_name():
    """Retrieve Gemini Model Name (defaults to gemini-2.5-flash-lite)"""
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()
    return model.lower().replace(" ", "-")

def call_gemini(prompt):
    """Generate content with Gemini using official SDK or direct REST API fallback"""
    api_key = get_api_key()
    if not api_key:
        return None, "Error: GEMINI_API_KEY is not configured in backend/.env"

    model_name = get_model_name()

    # 1. Try official google-genai SDK if installed
    if GENAI_AVAILABLE and genai is not None:
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            if response and response.text:
                return response.text, None
        except Exception:
            pass  # Fall back to direct REST API

    # 2. Direct REST API via requests (zero extra dependencies required)
    models_to_try = [model_name]
    for fallback in ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-1.5-flash"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2
            }
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=20)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"], None
            elif res.status_code == 404:
                last_error = f"Model '{model}' not found on Gemini API."
                continue
            else:
                err_data = res.json().get("error", {})
                last_error = err_data.get("message", res.text)
        except Exception as e:
            last_error = str(e)

    return None, f"Error: {last_error or 'Failed to generate response from Gemini'}"


def parse_verdict(text):
    """Accurately extract verdict from LLM output, handling markdown and plain formats."""
    if not text:
        return "suspicious"
    
    # Check for explicit Result: REAL / FAKE / SUSPICIOUS line (supports markdown bold, headers, etc.)
    result_match = re.search(r"Result[^\w\n]*\s*[*_#`]*\s*(REAL|FAKE|SUSPICIOUS)", text, re.IGNORECASE)
    if result_match:
        return result_match.group(1).lower()

    # Fallback to Risk Level line
    risk_match = re.search(r"Risk\s*Level[^\w\n]*\s*[*_#`]*\s*(LOW|MEDIUM|HIGH)", text, re.IGNORECASE)
    if risk_match:
        risk = risk_match.group(1).upper()
        if risk == "LOW":
            return "real"
        elif risk == "HIGH":
            return "fake"
        return "suspicious"

    return "suspicious"


def predict_fake_or_real(text):
    truncated_text = text[:3000]
    prompt = f"""
        You are an expert in detecting fraud, scams, and fake government schemes.
        Analyze the following content and determine: REAL or FAKE.
        Content: {truncated_text}

        Output format:
        Result: REAL or FAKE
        Reason: <clear explanation in 2-4 lines>
        """
    content, error = call_gemini(prompt)
    if error:
        return error, "error"
    verdict = parse_verdict(content)
    return content, verdict


def url_detection(url):
    prompt = f"""
        You are a senior cybersecurity analyst. Detect if this is a FAKE GOVERNMENT SCHEME URL.
        Analyze this URL: {url}

        OUTPUT FORMAT (strictly follow this):
        Result: REAL or FAKE or SUSPICIOUS
        Risk Level: LOW or MEDIUM or HIGH
        Scheme Targeted: <which govt scheme, if any>
        Domain Check: <.gov.in/.nic.in or fake?>
        Protocol Check: <HTTPS or HTTP?>
        Reason:
        - <point 1>
        - <point 2>
        - <point 3>
        Red Flags Found:
        - <flag 1>
        - <flag 2>
        Citizen Advisory: <1 line simple advice>

        Rules:
        - Real Indian govt URLs end with .gov.in / .nic.in
        - HTTPS = safe, HTTP = unsafe
        - Fake sites use .com .org .in .xyz pretending to be govt
        - Phishing keywords: free-money, apply-now, kyc-update, instant-loan
        - Too many hyphens = red flag
        """
    content, error = call_gemini(prompt)
    if error:
        return error, "error"
    verdict = parse_verdict(content)
    return content, verdict


@detector_bp.route("/api/detect-url", methods=['POST'])
def api_detect_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "No URL provided"}), 400
    url = data['url'].strip()
    if not url.startswith(('http://', 'https://')):
        return jsonify({"error": "URL must start with http:// or https://"}), 400
    result_text, verdict = url_detection(url)
    if verdict == "error":
        status_code = 503 if "API_KEY" in result_text else 502
        return jsonify({
            "error": result_text,
            "result": result_text,
            "verdict": "error"
        }), status_code
    return jsonify({
        "result": result_text,
        "verdict": verdict
    })


MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@detector_bp.route("/api/detect-file", methods=['POST'])
def api_detect_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Check file size
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)
    if file_length > MAX_FILE_SIZE:
        return jsonify({"error": "File size exceeds 5MB limit"}), 400

    try:
        if file.filename.lower().endswith(".pdf"):
            if not PDFPLUMBER_AVAILABLE or pdfplumber is None:
                return jsonify({"error": "PDF processing library (pdfplumber) is not installed on the server"}), 503
            with pdfplumber.open(file) as pdf:
                extracted_text = "".join([
                    page.extract_text() or "" for page in pdf.pages[:10]
                ])
        elif file.filename.lower().endswith(".txt"):
            extracted_text = file.read().decode("UTF-8", errors="ignore")
        else:
            return jsonify({"error": "Only .pdf or .txt files are supported"}), 400
        if not extracted_text.strip():
            return jsonify({"error": "File is empty or text could not be extracted"}), 400
        result_text, verdict = predict_fake_or_real(extracted_text)
        if verdict == "error":
            status_code = 503 if "API_KEY" in result_text else 502
            return jsonify({
                "error": result_text,
                "result": result_text,
                "verdict": "error"
            }), status_code
        return jsonify({
            "result": result_text,
            "verdict": verdict
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
