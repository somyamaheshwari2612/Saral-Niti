from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import re

load_dotenv()

search_bp = Blueprint("search", __name__)
MONGO_URI = os.getenv("MONGO_URI")
if MONGO_URI:
    client = MongoClient(MONGO_URI)
else:
    client = None
db = client["saral_niti_db"] if client is not None else None
schemes_collection = db["schemes"] if db is not None else None

def scheme_to_dict(scheme):
    scheme["_id"] = str(scheme["_id"])
    return scheme

# GET /api/search?q=keyword
@search_bp.route("/api/search", methods=["GET"])
def search_schemes():
    try:
        query = request.args.get("q", "").strip()

        # ── INPUT VALIDATION ──
        # 1. Length check - prevent very long queries
        if len(query) > 100:
            return jsonify({"error": "Search query too long (max 100 characters)"}), 400

        # 2. Empty query - return empty result instead of querying DB
        if not query:
            return jsonify({
                "status": "ok",
                "query": "",
                "count": 0,
                "schemes": []
            })

        # 3. Escape regex special characters to prevent regex injection
        safe_query = re.escape(query)

        filter = {
            "$or": [
                {"title": {"$regex": safe_query, "$options": "i"}},
                {"description": {"$regex": safe_query, "$options": "i"}},
                {"tags": {"$regex": safe_query, "$options": "i"}},
                {"ministry": {"$regex": safe_query, "$options": "i"}}
            ]
        }

        results = list(schemes_collection.find(filter).limit(50))
        results = [scheme_to_dict(s) for s in results]
        return jsonify({
            "status": "ok",
            "query": query,
            "count": len(results),
            "schemes": results
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500