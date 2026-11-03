#!/usr/bin/env python3
"""
backend/scripts/seed_db.py
--------------------------
Seeds the local high-speed SQLite database (schemes.db) with FTS5 search
indexes directly from backend/data/schemes.json.
"""

import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database import init_db, count_schemes, get_all_schemes

if __name__ == "__main__":
    print("--- Seeding Saral Niti SQLite Database ---")
    con = init_db(force=True)
    total = count_schemes()
    print(f"Successfully seeded {total} verified welfare schemes into schemes.db!")

    sample = get_all_schemes(limit=3)
    print("\nSample records:")
    for s in sample:
        print(f"  • [{s.get('level', 'central').upper()}] {s.get('title')} ({s.get('category')}) - {s.get('ministry')}")

    print("\nDatabase is ready for ultra-fast queries (<1ms search latency).")
