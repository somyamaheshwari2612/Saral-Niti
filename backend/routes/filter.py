from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import re

load_dotenv()

filter_bp = Blueprint("filter", __name__)

MONGO_URI = os.getenv("MONGO_URI")
if MONGO_URI:
    client = MongoClient(MONGO_URI)
else:
    client = None
db = client["saral_niti_db"] if client else None
schemes_collection = db["schemes"] if db is not None else None

def scheme_to_dict(scheme):
    scheme["_id"] = str(scheme["_id"])
    return scheme

# Allowed categories - matches your actual scheme categories
ALLOWED_CATEGORIES = [
    "agriculture", "health", "education", "housing", "employment",
    "women", "financial", "elderly", "youth", "disability"
]

# GET /api/filter?category=health
@filter_bp.route("/api/filter", methods=["GET"])
def filter_schemes():
    try:
        category = request.args.get("category", "").strip().lower()

        # ── INPUT VALIDATION ──
        # 1. Length check
        if len(category) > 50:
            return jsonify({"error": "Category value too long"}), 400

        # 2. Empty category - return empty result
        if not category:
            return jsonify({
                "status": "ok",
                "category": "",
                "count": 0,
                "schemes": []
            })

        # 3. Whitelist check - only allow known categories
        if category != "all" and category not in ALLOWED_CATEGORIES:
            return jsonify({"error": f"Invalid category: {category}"}), 400

        filter = {}
        if category != "all":
            safe_category = re.escape(category)
            filter["category"] = {"$regex": f"^{safe_category}$", "$options": "i"}

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