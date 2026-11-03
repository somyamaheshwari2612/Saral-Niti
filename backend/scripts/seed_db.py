import json
import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient, TEXT
from dotenv import load_dotenv

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("ERROR: MONGO_URI not found in .env file")
    sys.exit(1)

# Connect to MongoDB Atlas
client = MongoClient(MONGO_URI)
db = client["saral_niti_db"]
collection = db["schemes"]

# Load dataset
data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'schemes.json')

with open(data_path, "r", encoding="utf-8") as f:
    schemes = json.load(f)

# Add timestamps to each document
now = datetime.now(timezone.utc)
for scheme in schemes:
    scheme["created_at"] = now
    scheme["updated_at"] = now

# Clear old data and insert fresh
print("Deleting old data...")
collection.delete_many({})

print(f"Inserting {len(schemes)} schemes...")
result = collection.insert_many(schemes)
print(f"Inserted {len(result.inserted_ids)} documents successfully!")

# Create indexes
print("Creating indexes...")

collection.create_index([
    ("title", TEXT),
    ("description", TEXT),
    ("tags", TEXT)
], name="scheme_text_search")

collection.create_index([("category", 1)])
collection.create_index([("slug", 1)], unique=True)
collection.create_index([("category", 1), ("is_active", 1)])

print("All indexes created!")

# Verify
count = collection.count_documents({})
print(f"\nVerification: {count} total schemes in database")

categories = collection.distinct("category")
print(f"Categories found: {categories}")

client.close()
print("\nDone! Database seeded successfully.")
