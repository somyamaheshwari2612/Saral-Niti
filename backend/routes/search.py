from flask import Blueprint, jsonify, request
import re
from database import get_schemes_collection, scheme_to_dict

search_bp = Blueprint("search", __name__)

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

        schemes_collection = get_schemes_collection()
        if schemes_collection is None:
            return jsonify({"error": "Database not connected"}), 500

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