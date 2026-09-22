from flask import Flask, render_template  # ← render_template ADD kiya
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os


# Load .env file
load_dotenv()

# ← template_folder aur static_folder ADD kiya
app = Flask(__name__,
    template_folder='templates',
    static_folder='static'
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

# Register blueprints — kuch nahi badla
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
    app.run(debug=True, port=5000)  # port same hai