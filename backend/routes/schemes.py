from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId
import os

load_dotenv()

# Create blueprint
schemes_bp = Blueprint("schemes", __name__)

# Connect to DB
client = MongoClient(os.getenv("MONGO_URI"))
db = client["saralniti"]
schemes_collection = db["schemes"]

# Helper to convert MongoDB object to JSON
def scheme_to_dict(scheme):
    scheme["_id"] = str(scheme["_id"])
    return scheme

# GET /api/schemes — get all schemes
@schemes_bp.route("/api/schemes", methods=["GET"])
def get_all_schemes():
    try:
        schemes = list(schemes_collection.find())
        schemes = [scheme_to_dict(s) for s in schemes]
        return jsonify({
            "status": "ok",
            "count": len(schemes),
            "schemes": schemes
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# GET /api/schemes/<id> — get one scheme by ID
@schemes_bp.route("/api/schemes/<id>", methods=["GET"])
def get_scheme_by_id(id):
    try:
        scheme = schemes_collection.find_one({"_id": ObjectId(id)})
        if not scheme:
            return jsonify({"error": "Scheme not found"}), 404
        return jsonify(scheme_to_dict(scheme))
    except Exception as e:
        return jsonify({"error": str(e)}), 500