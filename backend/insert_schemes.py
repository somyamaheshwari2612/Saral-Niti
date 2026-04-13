from pymongo import MongoClient
import json
import os

# MongoDB connection
MONGO_URI = "mongodb+srv://saral_admin:Saral%401234@saralniti.lo8zpcn.mongodb.net/saral_niti_db?retryWrites=true&w=majority&appName=SaralNiti"

client = MongoClient(MONGO_URI)
db = client["saral_niti_db"]
schemes_collection = db["schemes"]

# Load schemes from JSON
with open("data/schemes.json", "r", encoding="utf-8") as f:
    schemes = json.load(f)

print(f"Found {len(schemes)} schemes in JSON file")

# Clear existing schemes and insert fresh
schemes_collection.delete_many({})
print("Cleared old schemes from database")

# Insert all schemes
result = schemes_collection.insert_many(schemes)
print(f"Successfully inserted {len(result.inserted_ids)} schemes!")

# Verify
count = schemes_collection.count_documents({})
print(f"Total schemes in database now: {count}")

client.close()
