import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure .env is loaded reliably regardless of current working directory
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

app = Flask(
    __name__,
    template_folder=os.path.join(base_dir, "templates"),
    static_folder=os.path.join(base_dir, "static")
)
# Protect against unbounded request body buffering (6MB max payload)
app.config['MAX_CONTENT_LENGTH'] = 6 * 1024 * 1024

# Lock CORS: allow Vercel frontend domain (configurable via FRONTEND_URL or CORS_ORIGINS)
frontend_origin = os.getenv("FRONTEND_URL") or os.getenv("CORS_ORIGINS") or "https://your-domain.vercel.app"
allowed_origins = [orig.strip() for orig in frontend_origin.split(",") if orig.strip()]
# Include local dev hosts if in development mode or not explicitly overridden
if "your-domain.vercel.app" in frontend_origin or os.getenv("FLASK_ENV") == "development":
    for local_host in ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000", "http://127.0.0.1:5000"]:
        if local_host not in allowed_origins:
            allowed_origins.append(local_host)

CORS(app, origins=allowed_origins)

# ══════════════════════════════════════════════════
#  GLOBAL ERROR HANDLERS (JSON-safe for APIs)
# ══════════════════════════════════════════════════
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Payload too large. Maximum allowed size is 6MB."}), 413

@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/") or request.is_json or "application/json" in request.headers.get("Accept", ""):
        return jsonify({"error": "Resource not found"}), 404
    return render_template("base.html"), 404

@app.errorhandler(500)
def internal_server_error(error):
    if request.path.startswith("/api/") or request.is_json or "application/json" in request.headers.get("Accept", ""):
        return jsonify({"error": "Internal server error"}), 500
    return render_template("base.html"), 500

from database import get_client, get_schemes_collection

@app.route("/")
def home():
    return render_template("base.html")

@app.route("/schemes")
def schemes_page():
    return render_template("base.html")

@app.route("/project")
def project_page():
    return render_template("base.html")

# Database connection and health test
@app.route("/test-db")
def test_db():
    try:
        collection = get_schemes_collection()
        count = collection.count_documents({}) if collection is not None else 0
        return {
            "message": "Database connected successfully",
            "schemes_in_db": count,
            "status": "ok",
            "engine": "sqlite3_fts5"
        }
    except Exception as e:
        return {"message": "Database connection failed", "error": str(e)}, 500

# Register blueprints
from routes.schemes import schemes_bp
from routes.search import search_bp
from routes.filter import filter_bp
from routes.live import live_bp
from routes.chatbot import chatbot_bp
from routes.detector import detector_bp
from routes.recommend import recommend_bp
from routes.pre_audit import pre_audit_bp

app.register_blueprint(schemes_bp)
app.register_blueprint(search_bp)
app.register_blueprint(filter_bp)
app.register_blueprint(live_bp)
app.register_blueprint(chatbot_bp)
app.register_blueprint(detector_bp)
app.register_blueprint(recommend_bp)
app.register_blueprint(pre_audit_bp)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") == "development" or os.getenv("FLASK_DEBUG") == "1"
    app.run(debug=debug, port=port)
