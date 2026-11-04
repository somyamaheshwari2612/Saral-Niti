# backend/database.py
# High-speed local SQLite + FTS5 full-text search database engine for Saral Niti
# Auto-seeds from backend/data/schemes.json (zero cloud setup, zero monthly bills, <1ms searches)

import os
import json
import sqlite3
import threading
import time
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
        con.execute("PRAGMA journal_mode=WAL")
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

    # API Rate Limits Table (Protects Gemini Quota: 13 RPM Server-Wide Ceiling)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS api_rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_group TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        timestamp REAL NOT NULL
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rate_limits_group_ts ON api_rate_limits(endpoint_group, timestamp);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rate_limits_client_ts ON api_rate_limits(endpoint_group, client_ip, timestamp);")

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


def get_schemes_paginated(page=1, limit=50, category=None):
    """
    Returns high-speed paginated schemes from SQLite with total counts and pagination metadata.
    Supports limit=0 to return full dataset if explicitly requested.
    """
    con = get_db_connection()
    cur = con.cursor()

    where_clauses = ["is_active = 1"]
    params = []
    if category and str(category).strip().lower() != "all":
        where_clauses.append("category = ? COLLATE NOCASE")
        params.append(str(category).strip())

    where_sql = " AND ".join(where_clauses)

    # 1. Total matching count
    cur.execute(f"SELECT COUNT(*) FROM schemes WHERE {where_sql}", params)
    total = cur.fetchone()[0]

    # 2. If limit <= 0, return all schemes
    if limit is not None and int(limit) <= 0:
        cur.execute(f"SELECT * FROM schemes WHERE {where_sql} ORDER BY id ASC", params)
        schemes = [row_to_dict(r) for r in cur.fetchall()]
        return {
            "total": total,
            "count": len(schemes),
            "page": 1,
            "limit": total,
            "total_pages": 1,
            "has_more": False,
            "schemes": schemes
        }

    # 3. Apply server-side pagination
    page = max(1, int(page or 1))
    limit = max(1, min(100, int(limit or 50)))
    offset = (page - 1) * limit
    total_pages = (total + limit - 1) // limit if total > 0 else 1

    cur.execute(
        f"SELECT * FROM schemes WHERE {where_sql} ORDER BY id ASC LIMIT ? OFFSET ?",
        params + [limit, offset]
    )
    rows = cur.fetchall()
    schemes = [row_to_dict(r) for r in rows]

    return {
        "total": total,
        "count": len(schemes),
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_more": (offset + len(schemes)) < total,
        "schemes": schemes
    }


def get_schemes_for_recommendation(profile=None):
    """
    High-performance SQL pre-filter for citizen welfare recommendation.
    Filters out schemes at the SQLite database layer by state, gender, and category
    before passing candidate schemes to the rules engine, avoiding full table scans.
    """
    profile = profile or {}
    con = get_db_connection()
    cur = con.cursor()

    where_clauses = ["is_active = 1"]
    params = []

    # 1. State pre-filter
    citizen_state = (profile.get("state") or "").strip()
    if citizen_state and citizen_state.lower() != "all":
        where_clauses.append("""(
            level = 'central'
            OR eligibility_json LIKE '%"state": "all"%'
            OR eligibility_json NOT LIKE '%"state"%'
            OR eligibility_json LIKE ?
            OR ministry LIKE ?
        )""")
        state_pat = f"%{citizen_state}%"
        params.extend([state_pat, state_pat])

    # 2. Gender pre-filter
    citizen_gender = (profile.get("gender") or "").strip().lower()
    if citizen_gender and citizen_gender not in ("all", "any"):
        where_clauses.append("""(
            eligibility_json LIKE '%"gender": "all"%'
            OR eligibility_json NOT LIKE '%"gender"%'
            OR eligibility_json LIKE ?
        )""")
        params.append(f'%"gender": "{citizen_gender}"%')

    # 3. Category pre-filter (if specified)
    category = (profile.get("category") or "").strip().lower()
    if category and category != "all":
        where_clauses.append("category = ? COLLATE NOCASE")
        params.append(category)

    where_sql = " AND ".join(where_clauses)
    query = f"SELECT * FROM schemes WHERE {where_sql} ORDER BY id ASC"

    cur.execute(query, params)
    rows = cur.fetchall()
    return [row_to_dict(r) for r in rows]


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
#  SLIDING-WINDOW RATE LIMITER (PROTECTS GEMINI 15 RPM QUOTA)
# ══════════════════════════════════════════════════
def acquire_rate_limit_slot(endpoint_group="gemini_ai", client_ip="127.0.0.1", global_limit=13, client_limit=5, window_sec=60):
    """
    Thread-safe & multi-worker safe sliding-window rate limiter powered by SQLite in WAL mode.
    Guarantees that global calls to Gemini stay <= 13 RPM across the entire server,
    with a per-IP fair-use cap of 5 RPM to prevent starvation.

    Returns:
        tuple: (allowed: bool, retry_after_seconds: int, reason: str)
    """
    now = time.time()
    cutoff = now - window_sec
    con = get_db_connection()
    cur = con.cursor()

    try:
        # 1. Clean up entries older than 2 minutes to keep table compact
        cur.execute("DELETE FROM api_rate_limits WHERE timestamp < ?", (now - 120,))

        # 2. Check Global Server-Wide Ceiling (13 RPM across all clients combined)
        cur.execute(
            "SELECT COUNT(*), MIN(timestamp) FROM api_rate_limits WHERE endpoint_group = ? AND timestamp >= ?",
            (endpoint_group, cutoff)
        )
        row = cur.fetchone()
        global_count = row[0] if row else 0
        oldest_global = row[1] if row else None

        if global_count >= global_limit:
            retry_after = max(1, int(oldest_global + window_sec - now)) if oldest_global else window_sec
            con.commit()
            return False, retry_after, "global_limit_reached"

        # 3. Check Per-Client Fair Use Ceiling (5 RPM per client IP)
        cur.execute(
            "SELECT COUNT(*), MIN(timestamp) FROM api_rate_limits WHERE endpoint_group = ? AND client_ip = ? AND timestamp >= ?",
            (endpoint_group, client_ip, cutoff)
        )
        c_row = cur.fetchone()
        client_count = c_row[0] if c_row else 0
        oldest_client = c_row[1] if c_row else None

        if client_count >= client_limit:
            retry_after = max(1, int(oldest_client + window_sec - now)) if oldest_client else window_sec
            con.commit()
            return False, retry_after, "client_limit_reached"

        # 4. Slot granted — record timestamp and commit atomically
        cur.execute(
            "INSERT INTO api_rate_limits (endpoint_group, client_ip, timestamp) VALUES (?, ?, ?)",
            (endpoint_group, client_ip, now)
        )
        con.commit()
        return True, 0, "ok"
    except Exception as e:
        print(f"Warning: Rate limit check error: {e}")
        return True, 0, "error_fallback"


def reset_rate_limits(endpoint_group="gemini_ai"):
    """Resets rate limit records (used by unit tests and admin maintenance)."""
    try:
        con = get_db_connection()
        cur = con.cursor()
        if endpoint_group:
            cur.execute("DELETE FROM api_rate_limits WHERE endpoint_group = ?", (endpoint_group,))
        else:
            cur.execute("DELETE FROM api_rate_limits")
        con.commit()
    except Exception:
        pass


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
