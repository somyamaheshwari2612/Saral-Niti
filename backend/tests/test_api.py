import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

# Test 1 - Homepage load hoti hai
def test_home(client):
    res = client.get('/')
    assert res.status_code == 200

# Test 2 - Schemes API kaam kar rahi hai
def test_get_schemes(client):
    res = client.get('/api/schemes')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'ok'
    assert len(data['schemes']) > 0

# Test 3 - Search kaam kar rahi hai
def test_search(client):
    res = client.get('/api/search?q=farmer')
    assert res.status_code == 200

# Test 4 - Filter kaam kar raha hai
def test_filter(client):
    res = client.get('/api/filter?category=health')
    assert res.status_code == 200

# Test 5 - Empty search handle hoti hai
def test_empty_search(client):
    res = client.get('/api/search?q=')
    assert res.status_code == 200