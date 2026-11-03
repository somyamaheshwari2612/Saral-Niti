import os
import re
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv

# Ensure .env is loaded reliably regardless of current working directory
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, '..', '.env'))

# Optional/guarded imports so app can start even if optional dependencies are not installed
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    Groq = None
    GROQ_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    pdfplumber = None
    PDFPLUMBER_AVAILABLE = False

detector_bp = Blueprint('detector', __name__)

def get_groq_client():
    if not GROQ_AVAILABLE or Groq is None:
        return None
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        return Groq(api_key=api_key)
    except Exception as e:
        print(f"Failed to initialize Groq client: {e}")
        return None

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
    if not GROQ_AVAILABLE:
        return "Error: groq library is not installed on the server", "error"
    client = get_groq_client()
    if not client:
        return "Error: GROQ_API_KEY is not configured", "error"

    # Truncate content to 3000 chars to avoid exceeding context limits
    truncated_text = text[:3000]
    prompt = f"""
        You are an expert in detecting fraud, scams, and fake government schemes.
        Analyze the following content and determine: REAL or FAKE.
        Content: {truncated_text}

        Output format:
        Result: REAL or FAKE
        Reason: <clear explanation in 2-4 lines>
        """
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        content = response.choices[0].message.content
        verdict = parse_verdict(content)
        return content, verdict
    except Exception as e:
        return f"Error: {str(e)}", "error"


def url_detection(url):
    if not GROQ_AVAILABLE:
        return "Error: groq library is not installed on the server", "error"
    client = get_groq_client()
    if not client:
        return "Error: GROQ_API_KEY is not configured", "error"

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
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        content = response.choices[0].message.content
        verdict = parse_verdict(content)
        return content, verdict
    except Exception as e:
        return f"Error: {str(e)}", "error"


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
        status_code = 503 if ("GROQ_API_KEY" in result_text or "not installed" in result_text) else 502
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
                    page.extract_text() or "" for page in pdf.pages[:10]  # Limit to first 10 pages
                ])
        elif file.filename.lower().endswith(".txt"):
            extracted_text = file.read().decode("UTF-8", errors="ignore")
        else:
            return jsonify({"error": "Only .pdf or .txt files are supported"}), 400
        if not extracted_text.strip():
            return jsonify({"error": "File is empty or text could not be extracted"}), 400
        result_text, verdict = predict_fake_or_real(extracted_text)
        if verdict == "error":
            status_code = 503 if ("GROQ_API_KEY" in result_text or "not installed" in result_text) else 502
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
