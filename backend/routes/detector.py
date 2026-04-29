
from flask import Flask, render_template, request, jsonify ,Blueprint
from flask_cors import CORS
from groq import Groq
import pdfplumber
from dotenv import load_dotenv  # ← ADD kiya
import os                        # ← ADD kiya

load_dotenv()                    # ← ADD kiya

client = Groq(api_key=os.getenv("GROQ_API_KEY"))# ← CHANGE kiya

detector_bp = Blueprint('detector', __name__)

def predict_fake_or_real(text):
    prompt = f"""
        You are an expert in detecting fraud, scams, and fake government schemes.
        Analyze the following content and determine: REAL or FAKE.
        Content: {text}
        Output format:
        Result: REAL or FAKE
        Reason: <clear explanation in 2-4 lines>
        """
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"


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
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"


@detector_bp.route("/api/detect-url", methods=['POST'])
def api_detect_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "No URL provided"}), 400
    url = data['url'].strip()
    if not url.startswith(('http://', 'https://')):
        return jsonify({"error": "URL must start with http:// or https://"}), 400
    result = url_detection(url)
    return jsonify({"result": result})

@detector_bp.route("/api/detect-file", methods=['POST'])
def api_detect_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    try:
        if file.filename.endswith(".pdf"):
            with pdfplumber.open(file) as pdf:
                extracted_text = "".join([
                    page.extract_text() or "" for page in pdf.pages
                ])
        elif file.filename.endswith(".txt"):
            extracted_text = file.read().decode("UTF-8")
        else:
            return jsonify({"error": "Only .pdf or .txt files are supported"}), 400
        if not extracted_text.strip():
            return jsonify({"error": "File is empty or text could not be extracted"}), 400
        result = predict_fake_or_real(extracted_text)
        return jsonify({"result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500