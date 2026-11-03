import os
from flask import Flask, render_template
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
CORS(app)

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

# MongoDB connection test
@app.route("/test-db")
def test_db():
    try:
        client = get_client()
        if client is None:
            return {"message": "MongoDB connection failed", "error": "No MongoDB client available"}, 500
        client.admin.command("ping")
        collection = get_schemes_collection()
        count = collection.count_documents({}) if collection is not None else 0
        return {
            "message": "MongoDB connected successfully",
            "schemes_in_db": count,
            "status": "ok"
        }
    except Exception as e:
        return {"message": "MongoDB connection failed", "error": str(e)}, 500

# Register blueprints
from routes.schemes import schemes_bp
from routes.search import search_bp
from routes.filter import filter_bp
from routes.live import live_bp
from routes.chatbot import chatbot_bp
from routes.detector import detector_bp

app.register_blueprint(schemes_bp)
app.register_blueprint(search_bp)
app.register_blueprint(filter_bp)
app.register_blueprint(live_bp)
app.register_blueprint(chatbot_bp)
app.register_blueprint(detector_bp)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") == "development" or os.getenv("FLASK_DEBUG") == "1"
    app.run(debug=debug, port=port)
