import pytest
from app import app
from routes.detector import parse_verdict

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

# Test 1 - Homepage loads successfully
def test_home(client):
    res = client.get('/')
    assert res.status_code == 200
    assert b"Saral Niti" in res.data

# Test 2 - Dedicated routes render base template
def test_schemes_page(client):
    res = client.get('/schemes')
    assert res.status_code == 200

def test_project_page(client):
    res = client.get('/project')
    assert res.status_code == 200

# Test 3 - Schemes API responds with status ok
def test_get_schemes(client):
    res = client.get('/api/schemes')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "schemes" in data
    assert "count" in data

# Test 4 - Search responds properly
def test_search(client):
    res = client.get('/api/search?q=farmer')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["query"] == "farmer"

# Test 5 - Empty search returns empty list
def test_empty_search(client):
    res = client.get('/api/search?q=')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["count"] == 0

# Test 6 - Query too long triggers 400 validation error
def test_search_too_long(client):
    long_query = "a" * 101
    res = client.get(f'/api/search?q={long_query}')
    assert res.status_code == 400

# Test 7 - Invalid category triggers 400 validation error
def test_filter_invalid_category(client):
    res = client.get('/api/filter?category=non_existent_category_123')
    assert res.status_code == 400

# Test 8 - Filter valid category responds ok
def test_filter_valid_category(client):
    res = client.get('/api/filter?category=agriculture')
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["category"] == "agriculture"

# Test 9 - Chatbot responds to messages
def test_chatbot(client):
    res = client.post('/api/chatbot', json={"message": "farmer"})
    assert res.status_code == 200
    data = res.get_json()
    assert "PM-KISAN" in data["reply"]

# Test 10 - Detector rejects invalid URLs
def test_detect_url_invalid(client):
    res = client.post('/api/detect-url', json={"url": "not-a-valid-url"})
    assert res.status_code == 400

# Test 11 - Detector verdict parser correctly distinguishes real vs fake
def test_parse_verdict():
    real_sample = "Analysis:\nResult: REAL\nRisk Level: LOW\nScheme Targeted: PM Kisan\nCitizen Advisory: Safe"
    assert parse_verdict(real_sample) == "real"

    fake_sample = "Analysis:\nResult: FAKE\nRisk Level: HIGH\nScheme Targeted: PM Kisan\nRed Flags: Fake domain"
    assert parse_verdict(fake_sample) == "fake"

    # Test that explanation mentioning 'fake' doesn't cause false positive if Result is REAL
    tricky_real = "Result: REAL\nReason: This is the official portal. Do not fall for fake websites."
    assert parse_verdict(tricky_real) == "real"