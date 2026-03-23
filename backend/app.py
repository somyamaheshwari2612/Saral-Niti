from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Create Flask app
app = Flask(__name__)
CORS(app)

# Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client["saral_niti_db"]
schemes_collection = db["schemes"]

# Test route
@app.route("/")
def home():
    return {
        "message" : "Saral Niti Backend is running !",
        "status" : "ok"
    }

# MongoDB connection test route
@app.route("/test-db")
def test_db():
    try:
        client.admin.command("ping")
        count = schemes_collection.count_documents({})
        return {
            "message" : "MongoDB connected successfully",
            "scheme_in_db" : count,
            "status" : "ok"
        }
    except Exception as e:
        return {
            "message" : " MongoDB connection failed",
            "error" : str(e)
        } , 500

# Register blueprints
from routes.schemes import schemes_bp
from routes.search import search_bp
app.register_blueprint(schemes_bp)
app.register_blueprint(search_bp)
    
if __name__ == "__main__":
    app.run(debug=True , port=5000)