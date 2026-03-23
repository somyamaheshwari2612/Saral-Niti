from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

search_bp = Blueprint("search", __name__)

client = MongoClient(os.getenv("MONGO_URI"))
db = client["saral_niti_db"]
schemes_collection = db["schemes"]

def scheme_to_dict(scheme):
    scheme["_id"] = str(scheme["_id"])
    return scheme

# GET /api/search?q=keyword&category=education
@search_bp.route("/api/search", methods=["GET"])
def search_schemes():
    try:
        query = request.args.get("q", "")
        category = request.args.get("category", "")

        search_filter = {}

        if query:
            search_filter["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},        # ✅ fixed
                {"description": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}},
                {"ministry": {"$regex": query, "$options": "i"}}
            ]

        if category:
            search_filter["category"] = {"$regex": category, "$options": "i"}

        results = list(schemes_collection.find(search_filter).limit(20))
        results = [scheme_to_dict(s) for s in results]

        return jsonify({
            "status": "ok",
            "query": query,
            "category": category,
            "count": len(results),
            "schemes": results
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# GET /api/filter?category=agriculture
@search_bp.route("/api/filter", methods=["GET"])
def filter_schemes():
    try:
        category = request.args.get("category", "")
        is_active = request.args.get("is_active", "true")

        search_filter = {}

        if category:
            search_filter["category"] = category.lower()

        if is_active:
            search_filter["is_active"] = True

        results = list(schemes_collection.find(search_filter))
        results = [scheme_to_dict(s) for s in results]

        return jsonify({
            "status": "ok",
            "category": category,
            "count": len(results),
            "schemes": results
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# GET /api/categories — list all categories
@search_bp.route("/api/categories", methods=["GET"])
def get_categories():
    try:
        categories = schemes_collection.distinct("category")
        return jsonify({
            "status": "ok",
            "categories": sorted(categories)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500