from flask import Blueprint, jsonify, request
from database import get_scheme_by_id as fetch_scheme_by_id, get_schemes_paginated, scheme_to_dict

schemes_bp = Blueprint("schemes", __name__)

# GET /api/schemes — paginated schemes listing with metadata
@schemes_bp.route("/api/schemes", methods=["GET"])
def get_all_schemes():
    try:
        raw_page = request.args.get("page", 1)
        raw_limit = request.args.get("limit") or request.args.get("page_size") or 50
        category = request.args.get("category")

        # Allow limit=0 or all=true for bulk export if explicitly requested
        if request.args.get("all", "").lower() in ("true", "1", "yes") or str(raw_limit) == "0":
            limit = 0
            page = 1
        else:
            try:
                page = max(1, int(raw_page))
            except (ValueError, TypeError):
                return jsonify({"error": "Page parameter must be a positive integer"}), 400

            try:
                limit = max(1, min(100, int(raw_limit)))
            except (ValueError, TypeError):
                return jsonify({"error": "Limit parameter must be an integer between 1 and 100"}), 400

        result = get_schemes_paginated(page=page, limit=limit, category=category)
        return jsonify({
            "status": "ok",
            "total": result["total"],
            "count": result["count"],
            "page": result["page"],
            "limit": result["limit"],
            "total_pages": result["total_pages"],
            "has_more": result["has_more"],
            "schemes": result["schemes"]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# GET /api/schemes/<id> — get one scheme by ID (supports integer id, _id string, or slug)
@schemes_bp.route("/api/schemes/<id>", methods=["GET"])
def get_scheme_by_id(id):
    try:
        scheme = fetch_scheme_by_id(str(id))
        if not scheme:
            return jsonify({"error": "Scheme not found"}), 404
        return jsonify(scheme_to_dict(scheme))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
