from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

filter_bp = Blueprint("filter", __name__)

client = MongoClient(os.getenv("MONGO_URI"))
db = client["saral_niti_db"]
schemes_collection = db["schemes"]

def scheme_to_dict(scheme):
    scheme["_id"] = str(scheme["_id"])
    return scheme

# GET /api/filter?category=health
@filter_bp.route("/api/filter", methods=["GET"])
def filter_schemes():
    try:
        category = request.args.get("category", "")
        filter = {}
        if category:
            filter["category"] = {"$regex": category, "$options": "i"}
        results = list(schemes_collection.find(filter).limit(50))
        results = [scheme_to_dict(s) for s in results]
        return jsonify({
            "status": "ok",
            "category": category,
            "count": len(results),
            "schemes": results
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
