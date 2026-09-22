from flask import Blueprint, jsonify, request
import re
from database import get_schemes_collection, scheme_to_dict

filter_bp = Blueprint("filter", __name__)

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

        schemes_collection = get_schemes_collection()
        if schemes_collection is None:
            return jsonify({"error": "Database not connected"}), 500

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