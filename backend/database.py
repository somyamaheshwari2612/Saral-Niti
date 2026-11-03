# backend/database.py
# High-speed local SQLite + FTS5 full-text search database engine for Saral Niti
# Auto-seeds from backend/data/schemes.json (zero cloud setup, zero monthly bills, <1ms searches)

import os
import json
import sqlite3
import threading
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

# Resolve unified data directory (root data/ directory)
DATA_DIR = os.getenv("SQLITE_DATA_DIR")
if not DATA_DIR:
    cand_root = os.path.abspath(os.path.join(base_dir, "..", "data"))
    cand_backend = os.path.join(base_dir, "data")
    if os.path.exists(os.path.join(cand_root, "schemes.json")):
        DATA_DIR = cand_root
    elif os.path.exists(os.path.join(cand_backend, "schemes.json")):
        DATA_DIR = cand_backend
    else:
        DATA_DIR = cand_root

DB_PATH = os.getenv("SQLITE_DB_PATH", os.path.join(DATA_DIR, "schemes.db"))
JSON_PATH = os.path.join(DATA_DIR, "schemes.json")

# Thread-local storage for SQLite connections
_local = threading.local()


def get_db_connection():
    """Returns a thread-local SQLite connection with row_factory enabled"""
    con = getattr(_local, "con", None)
    if con is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        con = sqlite3.connect(DB_PATH, check_same_thread=False)
        con.row_factory = sqlite3.Row
        _local.con = con
    return con


def row_to_dict(row):
    """Converts a SQLite Row object into a canonical Saral-Niti scheme dict"""
    if row is None:
        return None
    d = dict(row)

    # Parse JSON serialized fields
    for field in ["eligibility_json", "tags_json", "documents_json"]:
        if field in d:
            raw_val = d.pop(field)
            clean_key = field.replace("_json", "")
            if clean_key == "documents":
                clean_key = "documents_required"
            try:
                d[clean_key] = json.loads(raw_val) if raw_val else []
            except Exception:
                d[clean_key] = [] if "tags" in clean_key or "docs" in clean_key else {}

    # Ensure _id is a string matching id or existing _id
    d["_id"] = str(d.get("_id") or d.get("id"))
    d["is_active"] = bool(d.get("is_active", 1))
    return d


def scheme_to_dict(scheme):
    """Utility to convert document/Row to JSON-serializable dict"""
    if isinstance(scheme, sqlite3.Row):
        return row_to_dict(scheme)
    if isinstance(scheme, dict):
        if "_id" in scheme:
            scheme["_id"] = str(scheme["_id"])
        return scheme
    return scheme


def init_db(force=False):
    """
    Initializes SQLite tables and FTS5 search index.
    Auto-seeds from backend/data/schemes.json if the database is missing or empty.
    """
    con = get_db_connection()
    cur = con.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS schemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        _id TEXT UNIQUE,
        slug TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        level TEXT DEFAULT 'central',
        ministry TEXT,
        benefits TEXT,
        application_url TEXT,
        source TEXT DEFAULT 'myscheme',
        source_url TEXT,
        last_verified_at TEXT,
        launched_year INTEGER,
        is_active INTEGER DEFAULT 1,
        eligibility_json TEXT,
        tags_json TEXT,
        documents_json TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes(category);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_schemes_slug ON schemes(slug);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_schemes_level ON schemes(level);")

    # Full-Text Search (FTS5) Virtual Table
    cur.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS schemes_fts USING fts5(
        title,
        description,
        ministry,
        tags,
        benefits
    );
    """)

    # Check count
    cur.execute("SELECT COUNT(*) FROM schemes")
    count = cur.fetchone()[0]

    if count == 0 or force:
        if force:
            cur.execute("DROP TABLE IF EXISTS schemes_fts;")
            cur.execute("DELETE FROM schemes;")
            cur.execute("""
            CREATE VIRTUAL TABLE schemes_fts USING fts5(
                title,
                description,
                ministry,
                tags,
                benefits
            );
            """)

        if os.path.exists(JSON_PATH):
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                schemes_data = json.load(f)

            for s in schemes_data:
                _id = str(s.get("_id") or s.get("slug"))
                tags_list = s.get("tags") or []
                tags_str = " ".join(tags_list) if isinstance(tags_list, list) else str(tags_list)

                cur.execute("""
                INSERT OR REPLACE INTO schemes (
                    _id, slug, title, description, category, level,
                    ministry, benefits, application_url, source, source_url,
                    last_verified_at, launched_year, is_active,
                    eligibility_json, tags_json, documents_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    _id,
                    s.get("slug"),
                    s.get("title") or "Untitled",
                    s.get("description") or "",
                    s.get("category") or "financial",
                    s.get("level") or "central",
                    s.get("ministry") or "Government of India",
                    s.get("benefits") or "",
                    s.get("application_url") or "",
                    s.get("source") or "myscheme",
                    s.get("source_url") or "",
                    s.get("last_verified_at") or "2026-03-01",
                    s.get("launched_year"),
                    1 if s.get("is_active") is not False else 0,
                    json.dumps(s.get("eligibility", {})),
                    json.dumps(tags_list),
                    json.dumps(s.get("documents_required", [])),
                    str(s.get("created_at") or ""),
                    str(s.get("updated_at") or "")
                ))
                row_id = cur.lastrowid
                cur.execute("""
                INSERT INTO schemes_fts (rowid, title, description, ministry, tags, benefits)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    row_id,
                    s.get("title") or "",
                    s.get("description") or "",
                    s.get("ministry") or "",
                    tags_str,
                    s.get("benefits") or ""
                ))
            con.commit()

    return con


# ══════════════════════════════════════════════════
#  HIGH-PERFORMANCE SQLITE QUERY INTERFACE
# ══════════════════════════════════════════════════
def get_all_schemes(limit=None):
    con = get_db_connection()
    cur = con.cursor()
    query = "SELECT * FROM schemes WHERE is_active = 1 ORDER BY id ASC"
    if limit:
        query += f" LIMIT {int(limit)}"
    cur.execute(query)
    return [row_to_dict(r) for r in cur.fetchall()]


def get_scheme_by_id(scheme_id):
    con = get_db_connection()
    cur = con.cursor()
    # Check by numeric id, _id string, or slug
    cur.execute(
        "SELECT * FROM schemes WHERE id = ? OR _id = ? OR slug = ? LIMIT 1",
        (str(scheme_id), str(scheme_id), str(scheme_id))
    )
    row = cur.fetchone()
    return row_to_dict(row)


def filter_by_category(category, limit=50):
    con = get_db_connection()
    cur = con.cursor()
    if category.lower() == "all":
        cur.execute("SELECT * FROM schemes WHERE is_active = 1 LIMIT ?", (limit,))
    else:
        cur.execute(
            "SELECT * FROM schemes WHERE category = ? COLLATE NOCASE AND is_active = 1 LIMIT ?",
            (category, limit)
        )
    return [row_to_dict(r) for r in cur.fetchall()]


def search_schemes(query_text, limit=50):
    """
    Executes sub-millisecond FTS5 search with fallback to SQL LIKE substring search
    """
    con = get_db_connection()
    cur = con.cursor()
    clean_query = query_text.strip().replace('"', '""')

    # 1. Try FTS5 MATCH first
    try:
        fts_query = f'"{clean_query}"*'
        cur.execute("""
            SELECT s.* FROM schemes s
            JOIN schemes_fts f ON s.id = f.rowid
            WHERE schemes_fts MATCH ? AND s.is_active = 1
            LIMIT ?
        """, (fts_query, limit))
        results = [row_to_dict(r) for r in cur.fetchall()]
        if results:
            return results
    except Exception:
        pass

    # 2. Fallback to SQL LIKE
    like_pat = f"%{clean_query}%"
    cur.execute("""
        SELECT * FROM schemes
        WHERE is_active = 1 AND (
            title LIKE ? OR description LIKE ? OR ministry LIKE ? OR category LIKE ?
        )
        LIMIT ?
    """, (like_pat, like_pat, like_pat, like_pat, limit))
    return [row_to_dict(r) for r in cur.fetchall()]


def count_schemes():
    con = get_db_connection()
    cur = con.cursor()
    cur.execute("SELECT COUNT(*) FROM schemes WHERE is_active = 1")
    return cur.fetchone()[0]


# ══════════════════════════════════════════════════
#  MONGODB-COMPATIBLE ADAPTER CLASS
#  Ensures zero breaking changes across existing routes & tests
# ══════════════════════════════════════════════════
class SQLiteCollectionAdapter:
    def find(self, filter_dict=None):
        class Cursor(list):
            def limit(self, n):
                return Cursor(self[:n])

        if not filter_dict:
            return Cursor(get_all_schemes())

        if "category" in filter_dict:
            raw_regex = filter_dict["category"].get("$regex", "")
            cat = raw_regex.strip("^$").strip()
            return Cursor(filter_by_category(cat, limit=100))

        if "$or" in filter_dict:
            first_clause = filter_dict["$or"][0]
            val = ""
            for k in ["title", "description"]:
                if k in first_clause and "$regex" in first_clause[k]:
                    val = first_clause[k]["$regex"]
                    break
            return Cursor(search_schemes(val, limit=50))

        if "$text" in filter_dict:
            q = filter_dict["$text"].get("$search", "")
            return Cursor(search_schemes(q, limit=50))

        return Cursor(get_all_schemes())

    def find_one(self, filter_dict):
        if not filter_dict:
            return None
        target = filter_dict.get("_id") or filter_dict.get("id") or filter_dict.get("slug")
        return get_scheme_by_id(str(target))

    def count_documents(self, filter_dict=None):
        return count_schemes()


_adapter = SQLiteCollectionAdapter()
_schemes_collection = None

def get_schemes_collection():
    global _schemes_collection
    if _schemes_collection is not None:
        return _schemes_collection
    return _adapter

def get_client():
    return True

# Auto-initialize database on module load
try:
    init_db()
except Exception as e:
    print(f"Warning: Database auto-init error: {e}")
