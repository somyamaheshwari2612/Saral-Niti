import os
import sys
import json
from bson import ObjectId

# Ensure backend root is in Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from routes.detector import parse_verdict
import database

# ══════════════════════════════════════════════════
#  MOCK DATABASE FIXTURE (Runs offline & in CI)
# ══════════════════════════════════════════════════
class MockCursor:
    def __init__(self, items):
        self.items = items

    def limit(self, count):
        return self.items[:count]

    def __iter__(self):
        return iter(self.items)

    def __len__(self):
        return len(self.items)


class MockCollection:
    def __init__(self, data):
        self.data = data

    def find(self, filter_dict=None):
        if not filter_dict:
            return MockCursor([dict(x) for x in self.data])

        results = []
        for s in self.data:
            if "category" in filter_dict:
                pattern = filter_dict["category"]["$regex"].strip("^$").lower()
                if pattern in s.get("category", "").lower():
                    results.append(dict(s))
            elif "$or" in filter_dict:
                pattern = filter_dict["$or"][0]["title"]["$regex"].lower()
                tags_str = " ".join(s.get("tags", [])) if isinstance(s.get("tags"), list) else str(s.get("tags", ""))
                search_blob = f"{s.get('title', '')} {s.get('description', '')} {tags_str} {s.get('ministry', '')}".lower()
                if pattern in search_blob:
                    results.append(dict(s))
        return MockCursor(results)

    def find_one(self, filter_dict):
        if "_id" in filter_dict:
            target_id = str(filter_dict["_id"])
            for s in self.data:
                if str(s.get("_id")) == target_id:
                    return dict(s)
        return None

    def count_documents(self, filter_dict=None):
        return len(self.data)


_cached_schemes = None

def setup_mock_db():
    global _cached_schemes
    if _cached_schemes is None:
        data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'schemes.json')
        if os.path.exists(data_path):
            with open(data_path, "r", encoding="utf-8") as f:
                schemes = json.load(f)
        else:
            schemes = [
                {
                    "title": "PM-KISAN",
                    "slug": "pm-kisan",
                    "description": "Income support for farmers",
                    "category": "agriculture",
                    "tags": ["farmer", "agriculture", "subsidy"],
                    "ministry": "Ministry of Agriculture",
                    "benefits": "Rs 6000 per year"
                }
            ]

        for s in schemes:
            if "_id" not in s or not isinstance(s["_id"], ObjectId):
                s["_id"] = ObjectId()
        _cached_schemes = schemes

    database._schemes_collection = MockCollection(_cached_schemes)
    return _cached_schemes


SAMPLE_SCHEMES = setup_mock_db()

# Try importing pytest fixtures; fallback gracefully if pytest is not installed locally
try:
    import pytest

    @pytest.fixture
    def client():
        app.config['TESTING'] = True
        setup_mock_db()
        with app.test_client() as c:
            yield c
except ImportError:
    pass

def get_test_client():
    app.config['TESTING'] = True
    setup_mock_db()
    return app.test_client()


# ══════════════════════════════════════════════════
#  TEST CASES
# ══════════════════════════════════════════════════

# Test 1 - Homepage loads successfully
def test_home(client=None):
    c = client or get_test_client()
    res = c.get('/')
    assert res.status_code == 200
    assert b"Saral Niti" in res.data


# Test 2 - Dedicated routes render base template
def test_schemes_page(client=None):
    c = client or get_test_client()
    res = c.get('/schemes')
    assert res.status_code == 200


def test_project_page(client=None):
    c = client or get_test_client()
    res = c.get('/project')
    assert res.status_code == 200


# Test 3 - Schemes API responds with status ok
def test_get_schemes(client=None):
    c = client or get_test_client()
    res = c.get('/api/schemes')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "schemes" in data
    assert data["count"] > 0


# Test 4 - Get scheme by ID (Valid)
def test_get_scheme_by_id_valid(client=None):
    c = client or get_test_client()
    sample_id = str(SAMPLE_SCHEMES[0]["_id"])
    res = c.get(f'/api/schemes/{sample_id}')
    assert res.status_code == 200
    data = res.get_json()
    assert data["title"] == SAMPLE_SCHEMES[0]["title"]


# Test 5 - Get scheme by ID (Invalid ObjectId format)
def test_get_scheme_by_id_invalid(client=None):
    c = client or get_test_client()
    res = c.get('/api/schemes/invalid-non-hex-id')
    assert res.status_code == 400
    data = res.get_json()
    assert "Invalid scheme ID format" in data["error"]


# Test 6 - Get scheme by ID (Not Found)
def test_get_scheme_by_id_not_found(client=None):
    c = client or get_test_client()
    non_existent_id = str(ObjectId())
    res = c.get(f'/api/schemes/{non_existent_id}')
    assert res.status_code == 404


# Test 7 - Search responds properly
def test_search(client=None):
    c = client or get_test_client()
    res = c.get('/api/search?q=farmer')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["query"] == "farmer"


# Test 8 - Empty search returns empty list
def test_empty_search(client=None):
    c = client or get_test_client()
    res = c.get('/api/search?q=')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["count"] == 0


# Test 9 - Query too long triggers 400 validation error
def test_search_too_long(client=None):
    c = client or get_test_client()
    long_query = "a" * 101
    res = c.get(f'/api/search?q={long_query}')
    assert res.status_code == 400


# Test 10 - Invalid category triggers 400 validation error
def test_filter_invalid_category(client=None):
    c = client or get_test_client()
    res = c.get('/api/filter?category=non_existent_category_123')
    assert res.status_code == 400


# Test 11 - Filter valid category responds ok
def test_filter_valid_category(client=None):
    c = client or get_test_client()
    res = c.get('/api/filter?category=agriculture')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["category"] == "agriculture"


# Test 12 - Chatbot responds to messages
def test_chatbot(client=None):
    c = client or get_test_client()
    res = c.post('/api/chatbot', json={"message": "farmer"})
    assert res.status_code == 200
    data = res.get_json()
    assert "PM-KISAN" in data["reply"]


# Test 13 - Chatbot handles 'scholarship' without matching 'hi'
def test_chatbot_word_boundary(client=None):
    c = client or get_test_client()
    res = c.post('/api/chatbot', json={"message": "I want scholarship schemes"})
    assert res.status_code == 200
    data = res.get_json()
    assert "scholarship" in data["reply"].lower()


# Test 14 - Chatbot missing body triggers 400
def test_chatbot_missing_body(client=None):
    c = client or get_test_client()
    res = c.post('/api/chatbot', json={})
    assert res.status_code == 400


# Test 15 - Chatbot rejects invalid payload types (numbers, None, excessive length)
def test_chatbot_invalid_types(client=None):
    c = client or get_test_client()
    # Non-string message (integer)
    res_int = c.post('/api/chatbot', json={"message": 12345})
    assert res_int.status_code == 400
    assert "non-empty string" in res_int.get_json().get("error", "")

    # Null message
    res_null = c.post('/api/chatbot', json={"message": None})
    assert res_null.status_code == 400

    # Whitespace message
    res_space = c.post('/api/chatbot', json={"message": "    "})
    assert res_space.status_code == 400

    # Exceeding length limit (500 chars)
    res_long = c.post('/api/chatbot', json={"message": "a" * 501})
    assert res_long.status_code == 400


# Test 16 - Detector rejects invalid URLs
def test_detect_url_invalid(client=None):
    c = client or get_test_client()
    res = c.post('/api/detect-url', json={"url": "not-a-valid-url"})
    assert res.status_code == 400


# Test 17 - Detector rejects missing URL payload
def test_detect_url_missing(client=None):
    c = client or get_test_client()
    res = c.post('/api/detect-url', json={})
    assert res.status_code == 400


# Test 18 - Detector rejects invalid URL types (numbers, null, excessive length)
def test_detect_url_invalid_types(client=None):
    c = client or get_test_client()
    # Non-string URL (integer)
    res_int = c.post('/api/detect-url', json={"url": 99999})
    assert res_int.status_code == 400
    assert "non-empty string" in res_int.get_json().get("error", "")

    # Null URL
    res_null = c.post('/api/detect-url', json={"url": None})
    assert res_null.status_code == 400

    # Whitespace URL
    res_space = c.post('/api/detect-url', json={"url": "    "})
    assert res_space.status_code == 400

    # Exceeding URL length limit (2048 chars)
    res_long = c.post('/api/detect-url', json={"url": "https://gov.in/" + "a" * 2050})
    assert res_long.status_code == 400


# Test 19 - Detector file endpoint rejects missing file
def test_detect_file_missing(client=None):
    c = client or get_test_client()
    res = c.post('/api/detect-file')
    assert res.status_code == 400


# Test 20 - API routes return JSON for 404
def test_api_404_json(client=None):
    c = client or get_test_client()
    res = c.get('/api/non-existent-endpoint')
    assert res.status_code == 404
    data = res.get_json()
    assert data is not None
    assert "error" in data


# Test 18 - Live routes handle upstream gracefully
def test_live_routes_resilience(client=None):
    c = client or get_test_client()
    res = c.get('/api/live/schemes?q=farmer')
    assert res.status_code in [200, 502, 503, 504]

    res_id = c.get('/api/live/scheme/invalid-chars-!@#$')
    assert res_id.status_code == 400


# Test 21 - Recommendation engine ranks schemes based on profile
def test_recommend_schemes(client=None):
    c = client or get_test_client()
    profile = {
        "age": 28,
        "gender": "male",
        "state": "all",
        "income": 120000,
        "caste": "obc",
        "occupation": "farmer"
    }
    res = c.post('/api/recommend', json=profile)
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["matched_count"] > 0
    recs = data["recommendations"]
    assert len(recs) > 0
    first = recs[0]
    assert "match_score" in first
    assert "reasons" in first
    assert "scheme" in first
    assert first["match_score"] >= 60


# Test 22 - Recommendation engine rejects invalid profile values
def test_recommend_invalid_inputs(client=None):
    c = client or get_test_client()
    # Negative age
    res_age = c.post('/api/recommend', json={"age": -5})
    assert res_age.status_code == 400

    # Age above limit
    res_age2 = c.post('/api/recommend', json={"age": 200})
    assert res_age2.status_code == 400

    # Negative income
    res_inc = c.post('/api/recommend', json={"income": -500})
    assert res_inc.status_code == 400

    # Non-dict body
    res_body = c.post('/api/recommend', data="invalid", content_type="application/json")
    assert res_body.status_code == 400


# Test 23 - Detector verdict parser correctly handles plain and markdown formats
def test_parse_verdict():
    real_sample = "Analysis:\nResult: REAL\nRisk Level: LOW\nScheme Targeted: PM Kisan\nCitizen Advisory: Safe"
    assert parse_verdict(real_sample) == "real"

    fake_sample = "Analysis:\nResult: FAKE\nRisk Level: HIGH\nScheme Targeted: PM Kisan\nRed Flags: Fake domain"
    assert parse_verdict(fake_sample) == "fake"

    # Markdown bold formatting from LLMs
    md_real = "**Result:** REAL\n**Risk Level:** LOW"
    assert parse_verdict(md_real) == "real"

    md_fake = "**Result:** **FAKE**\n**Risk Level:** HIGH"
    assert parse_verdict(md_fake) == "fake"

    # Tricky sample with 'fake' in explanation
    tricky_real = "Result: REAL\nReason: This is the official portal. Do not fall for fake websites."
    assert parse_verdict(tricky_real) == "real"


# ══════════════════════════════════════════════════
#  DIRECT TEST RUNNER (Works without pytest installed)
# ══════════════════════════════════════════════════
if __name__ == "__main__":
    test_functions = [
        test_home,
        test_schemes_page,
        test_project_page,
        test_get_schemes,
        test_get_scheme_by_id_valid,
        test_get_scheme_by_id_invalid,
        test_get_scheme_by_id_not_found,
        test_search,
        test_empty_search,
        test_search_too_long,
        test_filter_invalid_category,
        test_filter_valid_category,
        test_chatbot,
        test_chatbot_word_boundary,
        test_chatbot_missing_body,
        test_chatbot_invalid_types,
        test_detect_url_invalid,
        test_detect_url_missing,
        test_detect_url_invalid_types,
        test_detect_file_missing,
        test_api_404_json,
        test_recommend_schemes,
        test_recommend_invalid_inputs,
        test_live_routes_resilience,
        test_parse_verdict,
    ]

    passed = 0
    failed = 0
    print(f"\n--- Running {len(test_functions)} Saral Niti Unit Tests ---\n")
    for fn in test_functions:
        name = fn.__name__
        try:
            fn()
            passed += 1
            print(f"  PASS: {name}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL: {name} - {e}")
        except Exception as e:
            failed += 1
            print(f"  ERROR: {name} - {e}")

    print(f"\nSummary: {passed} passed, {failed} failed.")
    if failed > 0:
        sys.exit(1)
    else:
        print("All tests PASSED successfully!\n")
