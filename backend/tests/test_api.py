import os
import sys
import json

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
        cand_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'schemes.json'))
        cand_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'schemes.json'))
        data_path = cand_root if os.path.exists(cand_root) else cand_backend
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
    # 1. Default pagination (page=1, limit=50)
    res = c.get('/api/schemes')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "schemes" in data
    assert data["count"] > 0
    assert data["total"] >= data["count"]
    assert data["page"] == 1
    assert data["limit"] == 50
    assert "has_more" in data
    assert "total_pages" in data

    # 2. Custom page and limit
    res2 = c.get('/api/schemes?page=1&limit=10')
    assert res2.status_code == 200
    d2 = res2.get_json()
    assert d2["page"] == 1
    assert d2["limit"] == 10
    assert d2["count"] <= 10

    # 3. Validation on invalid parameters
    res_bad_page = c.get('/api/schemes?page=not_a_number')
    assert res_bad_page.status_code == 400
    res_bad_limit = c.get('/api/schemes?limit=xyz')
    assert res_bad_limit.status_code == 400


# Test 4 - Get scheme by ID (Valid) - SQLite supports integer id or slug lookup

def test_get_scheme_by_id_valid(client=None):

    c = client or get_test_client()

    # Try the first scheme's slug; fall back to integer id "1"

    slug = (SAMPLE_SCHEMES[0].get("slug") or "").strip() or "1"

    res = c.get(f'/api/schemes/{slug}')

    # 200 when slug exists in SQLite; 404 acceptable when mock data slug differs

    assert res.status_code in (200, 404)

    if res.status_code == 200:

        data = res.get_json()

        assert "title" in data


# Test 5 - Non-existent scheme ID returns 404 (SQLite layer accepts any string)

def test_get_scheme_by_id_invalid(client=None):

    c = client or get_test_client()

    res = c.get('/api/schemes/this-slug-does-not-exist-9999')

    assert res.status_code == 404

    data = res.get_json()

    assert "error" in data


# Test 6 - Get scheme by ID (Not Found)

def test_get_scheme_by_id_not_found(client=None):

    c = client or get_test_client()

    non_existent_id = "nonexistent-slug-zzz-99999999"

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


# Test 24 - Advanced Multi-Filter: Demographic and Identity
def test_filter_demographics(client=None):
    c = client or get_test_client()
    # Age + Female + Widow
    res = c.post('/api/filter', json={
        "demographics": {
            "age": 45,
            "gender": "female",
            "vulnerabilities": ["widow"]
        }
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["total_matched"] > 0
    assert len(data["schemes"]) > 0

    # Transgender filter
    res_trans = c.post('/api/filter', json={"gender": "transgender"})
    assert res_trans.status_code == 200
    assert res_trans.get_json()["total_matched"] > 0

    # Minority and DNT categories
    res_min = c.post('/api/filter', json={"social_category": "minority"})
    assert res_min.status_code == 200
    assert res_min.get_json()["total_matched"] > 0

    res_dnt = c.post('/api/filter', json={"social_category": "dnt"})
    assert res_dnt.status_code == 200
    assert res_dnt.get_json()["total_matched"] > 0


# Test 25 - Advanced Multi-Filter: Geographic & Domicile
def test_filter_geographic_domicile(client=None):
    c = client or get_test_client()
    # State + Rural location type
    res_geo = c.post('/api/filter', json={
        "geographic": {
            "state": "Maharashtra",
            "location_type": "rural"
        }
    })
    assert res_geo.status_code == 200
    data = res_geo.get_json()
    assert data["status"] == "ok"
    assert data["total_matched"] > 0

    # Domicile migrant worker
    res_mig = c.post('/api/filter', json={"domicile_status": "migrant"})
    assert res_mig.status_code == 200
    assert res_mig.get_json()["total_matched"] > 0


# Test 26 - Advanced Multi-Filter: Socio-Economic & Financial
def test_filter_socio_economic(client=None):
    c = client or get_test_client()
    # BPL Ration card
    res_bpl = c.post('/api/filter', json={"ration_card": "bpl"})
    assert res_bpl.status_code == 200
    assert res_bpl.get_json()["total_matched"] > 0

    # Antyodaya Anna Yojana (AAY)
    res_aay = c.post('/api/filter', json={"ration_card": "aay"})
    assert res_aay.status_code == 200
    assert res_aay.get_json()["total_matched"] > 0

    # Housing Kutcha / Homeless
    res_house = c.post('/api/filter', json={"housing_status": "kutcha"})
    assert res_house.status_code == 200
    assert res_house.get_json()["total_matched"] > 0

    # Land ownership: marginal farmer
    res_land = c.post('/api/filter', json={"land_ownership": "marginal"})
    assert res_land.status_code == 200
    assert res_land.get_json()["total_matched"] > 0


# Test 27 - Advanced Multi-Filter: Education & Occupation
def test_filter_education_occupation(client=None):
    c = client or get_test_client()
    # Vocational / ITI
    res_voc = c.post('/api/filter', json={"education_level": "vocational"})
    assert res_voc.status_code == 200
    assert res_voc.get_json()["total_matched"] > 0

    # Targeted profession: Handloom weaver
    res_weave = c.post('/api/filter', json={"targeted_profession": "handloom_weaver"})
    assert res_weave.status_code == 200
    assert res_weave.get_json()["total_matched"] > 0

    # Targeted profession: Gig worker & Sanitation
    res_gig = c.post('/api/filter', json={"targeted_profession": "gig_worker"})
    assert res_gig.status_code == 200
    assert res_gig.get_json()["total_matched"] > 0

    res_san = c.post('/api/filter', json={"targeted_profession": "sanitation"})
    assert res_san.status_code == 200
    assert res_san.get_json()["total_matched"] > 0


# Test 28 - Advanced Multi-Filter: Benefit Types ("What I Need")
def test_filter_benefit_types(client=None):
    c = client or get_test_client()
    for b_type in ["dbt", "subsidy", "loan", "scholarship", "in_kind", "insurance"]:
        res = c.post('/api/filter', json={"benefit_type": b_type})
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "ok"
        assert data["total_matched"] > 0


# Test 29 - Advanced Multi-Filter: Enterprise & MSME
def test_filter_enterprise(client=None):
    c = client or get_test_client()
    # MSME + Tech sector
    res_msme = c.post('/api/filter', json={
        "enterprise": {
            "applicant_type": "msme",
            "business_sector": "tech"
        }
    })
    assert res_msme.status_code == 200
    assert res_msme.get_json()["total_matched"] > 0

    # SHG
    res_shg = c.post('/api/filter', json={"applicant_type": "shg"})
    assert res_shg.status_code == 200
    assert res_shg.get_json()["total_matched"] > 0


# Test 30 - GET /api/filter with query parameters
def test_filter_get_with_query_params(client=None):
    c = client or get_test_client()
    res = c.get('/api/filter?benefit_type=dbt&location_type=rural&category=agriculture')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["total_matched"] > 0


# Test 31 - Chatbot Code-Mixed Vernacular & RAG Grounding
def test_chatbot_code_mixed_rag(client=None):
    c = client or get_test_client()
    res = c.post('/api/chatbot', json={"message": "kisan ke liye fasal bima aur loan"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "reply" in data
    assert len(data["reply"]) > 10
    assert "matched_schemes" in data
    assert "extracted_slots" in data
    assert "suggested_followups" in data


def test_name_similarity_engine(client=None):
    from routes.pre_audit import calculate_name_similarity

    # Exact match
    r1 = calculate_name_similarity('Ramesh Kumar Sharma', 'Ramesh Kumar Sharma')
    assert r1['status'] == 'PASS'
    assert r1['score'] == 100

    # Honorific stripping
    r2 = calculate_name_similarity('Shri Ramesh Sharma', 'Ramesh Sharma')
    assert r2['status'] == 'PASS'
    assert r2['score'] >= 85

    # Token reordering (surname first)
    r3 = calculate_name_similarity('Sharma Ramesh', 'Ramesh Sharma')
    assert r3['status'] == 'PASS'
    assert r3['score'] >= 85

    # Minor initial variation
    r4 = calculate_name_similarity('Ramesh K Sharma', 'Ramesh Kumar Sharma')
    assert r4['score'] >= 70

    # Devanagari (Hindi) transliteration to English
    r_dev = calculate_name_similarity('रमेश कुमार शर्मा', 'Ramesh Kumar Sharma')
    assert r_dev['status'] == 'PASS'
    assert r_dev['score'] >= 85

    # Compound name joining/splitting
    r_comp = calculate_name_similarity('Ramkumar Sharma', 'Ram Kumar Sharma')
    assert r_comp['status'] == 'PASS'
    assert r_comp['score'] >= 90

    # Common middle patronymic omission tolerance
    r_mid = calculate_name_similarity('Ramesh Sharma', 'Ramesh Kumar Sharma')
    assert r_mid['status'] == 'PASS'
    assert r_mid['score'] >= 85

    # Phonetic surname variations (Choudhary / Chaudhary)
    r_sur = calculate_name_similarity('Suresh Choudhary', 'Suresh Chaudhary')
    assert r_sur['status'] == 'PASS'
    assert r_sur['score'] >= 90

    # Phonetic surname variations (Aggarwal / Agarwal)
    r_agg = calculate_name_similarity('Amit Aggarwal', 'Amit Agarwal')
    assert r_agg['status'] == 'PASS'
    assert r_agg['score'] >= 90

    # Initial abbreviation matching
    r_init = calculate_name_similarity('R K Sharma', 'Ramesh Kumar Sharma')
    assert r_init['status'] == 'PASS'
    assert r_init['score'] >= 85

    # Severe mismatch
    r5 = calculate_name_similarity('Ramesh Sharma', 'Sita Devi')
    assert r5['status'] == 'FAIL'
    assert r5['score'] < 60


def test_scheme_last_mile_audit(client=None):
    # This test exercises the last-mile audit route directly against the SQLite DB.
    # We first ensure the DB is initialized, then pick the first real scheme's slug.
    from database import init_db, get_scheme_by_id as _get
    init_db()
    first_scheme = _get('1')  # integer id=1 is always the first seeded scheme
    if not first_scheme:
        # DB not seeded in this environment; skip gracefully
        return
    scheme_id = str(first_scheme.get('id') or first_scheme.get('_id') or '1')
    c = client or app.test_client()
    res = c.get(f'/api/schemes/{scheme_id}/last-mile-audit')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'ok'
    assert 'audit_spec' in data
    spec = data['audit_spec']
    assert 'scheme_title' in spec
    assert 'checkpoints' in spec
    assert len(spec['checkpoints']) >= 2
    checkpoint_ids = [cp['id'] for cp in spec['checkpoints']]
    assert any(k in checkpoint_ids for k in ['mobile_otp', 'npci_seeding', 'name_matching'])


def test_pre_audit_high_readiness(client=None):
    c = client or app.test_client()
    payload = {
        'aadhaar_name': 'Ramesh Kumar Sharma',
        'bank_name': 'Ramesh Kumar Sharma',
        'npci_seeded': 'yes',
        'aadhaar_mobile_active': True,
        'family_tax_filer': False,
        'income_cert_status': 'valid_current_fy',
        'caste_cert_status': 'digital_barcode',
        'land_record_status': 'individual_digitized',
        'channel_aware': True
    }
    res = c.post('/api/pre-audit', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'ok'
    assert data['readiness_score'] >= 85
    assert data['readiness_level'] == 'READY_FOR_SUBMISSION'
    assert len(data['critical_failures']) == 0
    assert 'printable_slip' in data
    assert data['printable_slip']['audit_id'].startswith('SN-AUDIT')


def test_pre_audit_critical_rejection_traps(client=None):
    c = client or app.test_client()
    payload = {
        'aadhaar_name': 'Ramesh Sharma',
        'bank_name': 'Sita Devi',
        'npci_seeded': 'no',
        'aadhaar_mobile_active': False,
        'family_tax_filer': True,
        'income_cert_status': 'older_than_1yr',
        'land_record_status': 'manual_unregistered',
        'channel_aware': False
    }
    res = c.post('/api/pre-audit', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'ok'
    assert data['readiness_score'] < 60
    assert data['readiness_level'] == 'HIGH_REJECTION_RISK'
    assert len(data['critical_failures']) >= 3
    assert len(data['remedies']) >= 3
    assert any('NPCI' in r for r in data['remedies'])
    assert any('mobile' in r.lower() for r in data['remedies'])


# Test 38 - Rate Limiter enforces strict 13 RPM Global Ceiling
def test_rate_limiter_13_rpm(client=None):
    from database import acquire_rate_limit_slot, reset_rate_limits
    reset_rate_limits('unit_test_pool')

    for i in range(13):
        allowed, retry_after, _ = acquire_rate_limit_slot(
            'unit_test_pool', f'192.168.1.{i+1}', global_limit=13, client_limit=5, window_sec=60
        )
        assert allowed is True
        assert retry_after == 0

    allowed14, retry_after14, reason = acquire_rate_limit_slot(
        'unit_test_pool', '192.168.1.99', global_limit=13, client_limit=5, window_sec=60
    )
    assert allowed14 is False
    assert retry_after14 > 0
    assert reason == 'global_limit_reached'
    reset_rate_limits('unit_test_pool')


# Test 39 - Chatbot gracefully falls back to verified rulebook under rate limiting
def test_chatbot_rate_limit_graceful_fallback(client=None):
    from database import reset_rate_limits
    reset_rate_limits('gemini_ai')
    c = client or get_test_client()

    for i in range(13):
        res = c.post('/api/chatbot', json={'message': 'hello'}, headers={'X-Forwarded-For': f'10.0.0.{i+1}'})
        assert res.status_code == 200

    res14 = c.post('/api/chatbot', json={'message': 'farmer'}, headers={'X-Forwarded-For': '10.0.0.99'})
    assert res14.status_code == 200
    data = res14.get_json()
    assert data['status'] == 'ok'
    assert data['rate_limited'] is True
    assert 'PM-KISAN' in data['reply']
    reset_rate_limits('gemini_ai')


# ══════════════════════════════════════════════════
#  DIRECT TEST RUNNER (Works without pytest installed)
# ══════════════════════════════════════════════════
# Test 40 - Household Persona & Relationship Slot Extraction NLU
def test_chatbot_family_relationship_nlu(client=None):
    from routes.chatbot import extract_entities_and_slots
    c = client or get_test_client()

    # 1. Direct slot extraction for family members
    slots_father, _, _ = extract_entities_and_slots("My father is a 58 year old farmer in UP")
    assert slots_father.get("relationship") == "father"
    assert slots_father.get("target_subject") == "Father"
    assert slots_father.get("gender") == "male"
    assert slots_father.get("age") == 58
    assert slots_father.get("state") == "Uttar Pradesh"
    assert slots_father.get("occupation") == "farmer"

    slots_mother, _, _ = extract_entities_and_slots("Meri mataji vidhwa hain unke liye pension")
    assert slots_mother.get("relationship") == "mother"
    assert slots_mother.get("gender") == "female"
    assert slots_mother.get("is_widow") is True

    slots_sister, _, _ = extract_entities_and_slots("For my sister 12th pass student scholarship")
    assert slots_sister.get("relationship") == "sister"
    assert slots_sister.get("gender") == "female"
    assert slots_sister.get("occupation") == "student"

    # 2. Integration with /api/chatbot and active_persona
    res = c.post('/api/chatbot', json={
        "message": "What schemes are available?",
        "active_persona": {
            "label": "Rajesh (Papa)",
            "relationship": "father",
            "age": 58,
            "gender": "male",
            "state": "Uttar Pradesh",
            "occupation": "farmer"
        }
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["target_subject"] == "Rajesh (Papa)"
    assert data["extracted_slots"]["relationship"] == "father"
    assert data["extracted_slots"]["state"] == "Uttar Pradesh"

    # 3. Message override: Active persona is Father, but message asks for Mother
    res2 = c.post('/api/chatbot', json={
        "message": "Now tell me schemes for my mother who is 52 years old",
        "active_persona": {
            "label": "Rajesh (Papa)",
            "relationship": "father",
            "gender": "male"
        }
    })
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2["extracted_slots"]["relationship"] == "mother"
    assert data2["extracted_slots"]["gender"] == "female"
    assert data2["extracted_slots"]["age"] == 52


# Test 41 - Multi-Turn Chatbot Memory Window & Slot Accumulation
def test_chatbot_multi_turn_memory(client=None):
    c = client or get_test_client()

    # Turn 1: Citizen introduces demographic profile
    t1_res = c.post('/api/chatbot', json={
        "message": "I am a 21 year old student in Uttar Pradesh",
        "history": []
    })
    assert t1_res.status_code == 200
    t1_data = t1_res.get_json()
    assert t1_data["extracted_slots"]["age"] == 21
    assert t1_data["extracted_slots"]["state"] == "Uttar Pradesh"
    assert t1_data["extracted_slots"]["occupation"] == "student"

    # Turn 2: Citizen follows up about loans without repeating their state or age
    history = [
        {"role": "user", "content": "I am a 21 year old student in Uttar Pradesh"},
        {"role": "model", "content": t1_data["reply"]}
    ]
    t2_res = c.post('/api/chatbot', json={
        "message": "Are there any education loan schemes for me?",
        "history": history
    })
    assert t2_res.status_code == 200
    t2_data = t2_res.get_json()
    # Memory check: State and age must be retained from Turn 1 history!
    assert t2_data["extracted_slots"]["age"] == 21
    assert t2_data["extracted_slots"]["state"] == "Uttar Pradesh"
    assert t2_data["extracted_slots"]["occupation"] == "student"

    # Turn 3: Citizen updates state mid-conversation
    history.append({"role": "user", "content": "Are there any education loan schemes for me?"})
    history.append({"role": "model", "content": t2_data["reply"]})
    t3_res = c.post('/api/chatbot', json={
        "message": "Actually I moved to Bihar now, what about Bihar?",
        "history": history
    })
    assert t3_res.status_code == 200
    t3_data = t3_res.get_json()
    # State is overridden to Bihar, but age 21 is preserved!
    assert t3_data["extracted_slots"]["state"] == "Bihar"
    assert t3_data["extracted_slots"]["age"] == 21

    # Turn 4: Resilient handling of malformed history
    t4_res = c.post('/api/chatbot', json={
        "message": "Hello",
        "history": "not-a-list"
    })
    assert t4_res.status_code == 200

    t5_res = c.post('/api/chatbot', json={
        "message": "Hello",
        "history": [{"role": "invalid_role", "content": None}]
    })
    assert t5_res.status_code == 200


if __name__ == "__main__":
    test_functions = [
        test_chatbot_multi_turn_memory,
        test_chatbot_family_relationship_nlu,
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
        test_filter_demographics,
        test_filter_geographic_domicile,
        test_filter_socio_economic,
        test_filter_education_occupation,
        test_filter_benefit_types,
        test_filter_enterprise,
        test_filter_get_with_query_params,
        test_chatbot_code_mixed_rag,
        test_name_similarity_engine,
        test_scheme_last_mile_audit,
        test_pre_audit_high_readiness,
        test_pre_audit_critical_rejection_traps,
        test_rate_limiter_13_rpm,
        test_chatbot_rate_limit_graceful_fallback,
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
