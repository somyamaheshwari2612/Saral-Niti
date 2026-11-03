# 📡 Saral Niti — REST API Reference

The Saral Niti backend provides RESTful endpoints for scheme discovery, keyword search, sector filtering, rule-based chatbot assistance, and AI fraud detection.

Base URL (Production): `https://saral-niti-backend.onrender.com`  
Base URL (Local): `http://127.0.0.1:5000`

---

## 🏛️ Schemes Endpoints

### 1. Get All Schemes
Returns a list of all active welfare schemes stored in the database.

- **URL:** `/api/schemes`
- **Method:** `GET`
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "count": 50,
  "schemes": [
    {
      "_id": "673f8e...",
      "title": "PM Kisan Samman Nidhi",
      "slug": "pm-kisan",
      "description": "Financial support of ₹6,000 per year for all landholding farmer families.",
      "category": "agriculture",
      "benefits": "₹6,000 per year in three installments",
      "ministry": "Ministry of Agriculture & Farmers Welfare",
      "application_url": "https://pmkisan.gov.in",
      "launched_year": 2019,
      "eligibility": {
        "min_age": 18,
        "max_age": null,
        "gender": "all",
        "income_limit": null,
        "state": "all"
      },
      "tags": ["farmer", "income", "direct benefit transfer"]
    }
  ]
}
```

---

### 2. Get Single Scheme by ID
Retrieves complete details for a specific scheme by MongoDB ObjectId.

- **URL:** `/api/schemes/:id`
- **Method:** `GET`
- **URL Params:** `id=[string]` (Valid 24-character hex ObjectId)
- **Response:** `200 OK` (or `400 Bad Request` if invalid format, `404 Not Found` if not present)

---

### 3. Search Schemes
Full-text regex search across scheme title, description, ministry, and tags.

- **URL:** `/api/search`
- **Method:** `GET`
- **Query Params:** `q=[string]` (Max 100 characters)
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "query": "farmer",
  "count": 5,
  "schemes": [...]
}
```

---

### 4. Filter Schemes by Category
Filter schemes by target sector/demographic category.

- **URL:** `/api/filter`
- **Method:** `GET`
- **Query Params:** `category=[string]`
- **Supported Categories:**
  `all`, `agriculture`, `health`, `education`, `housing`, `employment`, `women`, `financial`, `elderly`, `youth`, `disability`
- **Response:** `200 OK`

---

## 🤖 Chatbot Assistant Endpoint

### 5. Chat with Sahayak
Rule-based conversational scheme assistant supporting word-boundary token matching.

- **URL:** `/api/chatbot`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "message": "schemes for farmers"
}
```
- **Response:** `200 OK`
```json
{
  "reply": "Here are some schemes for farmers:\n1. PM-KISAN — ₹6000/year income support\n2. Pradhan Mantri Fasal Bima Yojana — crop insurance\n3. Kisan Credit Card — easy credit access",
  "bot": "Saral Niti Bot"
}
```

---

## 🛡️ AI Fraud Detector Endpoints

### 6. Verify Scheme URL
Analyzes a URL using Google Gemini (Flash Lite) to identify phishing domains and fraudulent government scheme portals.

- **URL:** `/api/detect-url`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "url": "https://pmkisan.gov.in"
}
```
- **Response:** `200 OK`
```json
{
  "result": "Result: REAL\nRisk Level: LOW\nScheme Targeted: PM Kisan\nDomain Check: .gov.in official\nProtocol Check: HTTPS\nReason:\n- Official domain registered under NIC\nCitizen Advisory: Safe to use official portal",
  "verdict": "real"
}
```

---

### 7. Scan Scheme Document (PDF / TXT)
Scans uploaded circulars, PDFs, or notification texts up to 5MB to determine authenticity.

- **URL:** `/api/detect-file`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Form Data:** `file=[PDF or TXT file]` (Max 5MB)
- **Response:** `200 OK`
```json
{
  "result": "Result: REAL or FAKE\nReason: ...",
  "verdict": "real"
}
```

---

## 🔌 Live Integration (External Upstream)

- **GET `/api/live/schemes?q=`**: Queries live public scheme APIs with graceful 503 fallback if upstream service is unreachable.
- **GET `/api/live/scheme/:scheme_id`**: Fetches upstream details for a specific live scheme ID.

