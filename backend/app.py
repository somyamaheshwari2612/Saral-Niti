from flask import Flask, render_template  # ← render_template ADD kiya
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# ← template_folder aur static_folder ADD kiya
app = Flask(__name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)
CORS(app)

# Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client["saral_niti_db"]
schemes_collection = db["schemes"]

# ← pehle JSON return karta tha, ab HTML page serve karta hai
@app.route("/")
def home():
    return render_template("project.html")  # ← CHANGE kiya

# MongoDB connection test — kuch nahi badla
@app.route("/test-db")
def test_db():
    try:
        client.admin.command("ping")
        count = schemes_collection.count_documents({})
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

# from prototype.backend.routes.detector import api_detect_url, api_detect_file
# app.add_url_rule('/api/detect-url', view_func=api_detect_url, methods=['POST'])
# app.add_url_rule('/api/detect-file', view_func=api_detect_file, methods=['POST'])

app.register_blueprint(schemes_bp)
app.register_blueprint(search_bp)
app.register_blueprint(filter_bp)
app.register_blueprint(live_bp)
app.register_blueprint(chatbot_bp)
app.register_blueprint(detector_bp)

if __name__ == "__main__":
    app.run(debug=True, port=5000)  # port same hai