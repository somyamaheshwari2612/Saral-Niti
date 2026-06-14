from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

search_bp = Blueprint("search", __name__)
MONGO_URI = os.getenv("MONGO_URI")
if MONGO_URI:
    client = MongoClient(MONGO_URI)
else:
    client = None
db = client["saral_niti_db"] if client else None
schemes_collection = db["schemes"]

def scheme_to_dict(scheme):
    scheme["_id"] = str(scheme["_id"])
    return scheme

# GET /api/search?q=keyword
@search_bp.route("/api/search", methods=["GET"])
def search_schemes():
    try:
        query = request.args.get("q", "")
        # Build search filter
        filter = {}

        if query:
            filter["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}},
                {"ministry": {"$regex": query, "$options": "i"}}
            ]
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