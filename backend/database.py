import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_client = None
_db = None
_schemes_collection = None

def get_client():
    global _client
    if _client is None:
        mongo_uri = os.getenv("MONGO_URI")
        if mongo_uri:
            try:
                _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            except Exception as e:
                print(f"Failed to connect to MongoDB: {e}")
                _client = None
    return _client

def get_db():
    global _db
    if _db is None:
        client = get_client()
        if client is not None:
            _db = client["saral_niti_db"]
    return _db

def get_schemes_collection():
    global _schemes_collection
    if _schemes_collection is None:
        db = get_db()
        if db is not None:
            _schemes_collection = db["schemes"]
    return _schemes_collection

def scheme_to_dict(scheme):
    """Utility to convert MongoDB document to JSON-serializable dict"""
    if scheme and "_id" in scheme:
        scheme["_id"] = str(scheme["_id"])
    return scheme
