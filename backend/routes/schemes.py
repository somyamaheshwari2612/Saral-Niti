from flask import Blueprint, jsonify
from bson import ObjectId
from database import get_schemes_collection, scheme_to_dict

schemes_bp = Blueprint("schemes", __name__)

# GET /api/schemes — get all schemes
@schemes_bp.route("/api/schemes", methods=["GET"])
def get_all_schemes():
    try:
        schemes_collection = get_schemes_collection()
        if schemes_collection is None:
            return jsonify({"error": "Database not connected"}), 500
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
        schemes_collection = get_schemes_collection()
        if schemes_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        scheme = schemes_collection.find_one({"_id": ObjectId(id)})
        if not scheme:
            return jsonify({"error": "Scheme not found"}), 404
        return jsonify(scheme_to_dict(scheme))
    except Exception as e:
        return jsonify({"error": str(e)}), 500