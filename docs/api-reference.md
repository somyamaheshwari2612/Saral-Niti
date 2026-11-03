# 📡 Saral Niti — REST API Reference

The Saral Niti backend provides high-performance RESTful endpoints for scheme discovery, FTS5 full-text search, multi-dimensional filtering, vernacular chatbot assistance, last-mile pre-flight audits, and AI fraud detection.

Base URL (Local): `http://127.0.0.1:5000`  
Base URL (Production): `https://<your-backend-domain>.onrender.com`

---

## 🏛️ Scheme Discovery Endpoints

### 1. Get All Schemes
Returns a list of verified welfare schemes stored in the local SQLite database.

- **URL:** `/api/schemes`
- **Method:** `GET`
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "count": 4847,
  "schemes": [
    {
      "_id": "1",
      "title": "PM Kisan Samman Nidhi",
      "slug": "pm-kisan",
      "description": "Financial support of ₹6,000 per year for all landholding farmer families.",
      "category": "agriculture",
      "benefits": "₹6,000 per year in three installments",
      "ministry": "Ministry of Agriculture & Farmers Welfare",
      "application_url": "https://pmkisan.gov.in",
      "launched_year": 2019,
      "level": "central",
      "eligibility": {
        "min_age": 18,
        "max_age": null,
        "gender": "all",
        "income_limit": null,
        "state": "all"
      },
      "tags": ["farmer", "income", "direct benefit transfer"],
      "documents_required": ["Aadhaar Card", "Bank Account Details", "Land Records"]
    }
  ]
}
```

---

### 2. Get Single Scheme by ID
Retrieves complete details for a specific scheme by ID or slug.

- **URL:** `/api/schemes/:id`
- **Method:** `GET`
- **URL Params:** `id=[string|number]`
- **Response:** `200 OK` (or `404 Not Found` if not present)

---

### 3. Full-Text Search (SQLite FTS5)
Sub-millisecond full-text search across scheme title, description, ministry, benefits, and tags using SQLite FTS5.

- **URL:** `/api/search`
- **Method:** `GET`
- **Query Params:** `q=[string]` (Max 100 characters)
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "query": "solar subsidy",
  "count": 12,
  "schemes": [...]
}
```

---

### 4. Category & Query Filter
Quick category filtering with pagination.

- **URL:** `/api/filter`
- **Method:** `GET`
- **Query Params:**
  - `category`: `all`, `agriculture`, `health`, `education`, `housing`, `employment`, `women`, `financial`, `elderly`, `youth`, `disability`
  - `state`: e.g. `Maharashtra`, `Uttar Pradesh`, `All India`
  - `gender`: `male`, `female`, `transgender`, `all`
  - `page`: default `1`
  - `page_size`: default `24`
- **Response:** `200 OK`

---

### 5. Multi-Dimensional Advanced Filter
Executes multi-dimensional filtering across all 6 civic and socio-economic dimensions.

- **URL:** `/api/filter`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "age": 25,
  "gender": "female",
  "social_category": "sc",
  "vulnerability": "widow",
  "location_type": "rural",
  "state": "Uttar Pradesh",
  "income_bracket": "under_1lakh",
  "ration_card": "bpl",
  "housing_status": "kutcha",
  "land_ownership": "marginal",
  "education_level": "10th_pass",
  "occupational_category": "farmer",
  "benefit_type": "dbt",
  "page": 1,
  "page_size": 24
}
```
- **Response:** `200 OK` (returns matched schemes, total count, and pagination info)

---

## 🎯 Eligibility Recommendation Engine

### 6. Transparent Eligibility Evaluation
Deterministically evaluates a citizen demographic and financial profile against all active welfare schemes, returning ranked recommendations with transparent matching criteria and zero hallucinations.

- **URL:** `/api/recommend`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "age": 24,
  "gender": "male",
  "state": "Maharashtra",
  "income": 200000,
  "caste": "obc",
  "occupation": "farmer"
}
```
- **Response:** `200 OK` (returns `recommendations` array with `match_score`, `status`, `reasons`, and `unmet_criteria`)

---

## 🛡️ Last-Mile Pre-Flight Verification Engine

### 7. Scheme-Specific Last-Mile Audit Checkpoints
Returns the scheme-specific departmental audit traps, failure modes, and pre-flight verification checkpoints (Aadhaar-NPCI bank mapping, spelling discrepancies, expired certificates, statutory tax exclusions).

- **URL:** `/api/schemes/:id/last-mile-audit`
- **Method:** `GET`
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "audit_spec": {
    "scheme_id": "1",
    "scheme_title": "PM Kisan Samman Nidhi",
    "is_dbt": true,
    "audit_risk_level": "HIGH_SCRUTINY",
    "checkpoints": [
      {
        "id": "npci_seeding",
        "dimension": "Aadhaar Payment Bridge System (APBS)",
        "title": "Aadhaar-NPCI Bank Seeding Mandate (आधार-बैंक एनपीसीआई मैपिंग)",
        "departmental_trap": "Over 68% of DBT failures result from unmapped or dormant bank accounts on the NPCI central mapper.",
        "verification_instruction": "Dial *99*99*1# from your registered mobile SIM or verify online at myaadhaar.uidai.gov.in.",
        "prevention_step": "If unseeded, submit the DBT Annexure-I mandate form at your home bank branch."
      }
    ]
  }
}
```

---

### 8. Citizen Pre-Flight Diagnostic & Clearance Slip
Evaluates a citizen's application inputs against departmental validation rules to identify rejection risks before submission.

- **URL:** `/api/pre-audit`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "scheme_id": "1",
  "aadhaar_name": "Ramesh Kumar Sharma",
  "bank_name": "Ramesh K Sharma",
  "npci_seeded": "yes",
  "income_cert_status": "valid_current_fy",
  "family_tax_filer": false,
  "aadhaar_mobile_active": true
}
```
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "readiness_score": 95,
  "readiness_level": "READY_FOR_SUBMISSION",
  "badge_text": "🟢 High Readiness (Ready to Apply)",
  "badge_class": "badge-success",
  "summary": "Your profile satisfies critical departmental validation rules. Very low risk of last-mile rejection.",
  "printable_slip": {
    "audit_id": "SN-AUDIT-1741123456",
    "readiness_score": 95
  }
}
```

---

## 🤖 Vernacular Voice & RAG Chatbot

### 9. Chat with Sahayak
Multilingual conversational welfare assistant supporting code-mixed Hinglish, dynamic slot extraction, SQLite FTS5 RAG retrieval, and Gemini 3.5 Flash Lite synthesis.

- **URL:** `/api/chatbot`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "message": "kisan ke liye fasal bima aur tractor loan"
}
```
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "reply": "Here are verified government schemes for farmers:\n1. PM-KISAN — ₹6,000/year income support\n2. PM Fasal Bima Yojana — Comprehensive crop damage insurance\n3. Kisan Credit Card — Low-interest institutional credit",
  "matched_schemes": [...],
  "extracted_slots": {"domain": "agriculture", "state": null},
  "suggested_followups": ["How to apply for PM-KISAN?", "Documents for Fasal Bima Yojana"]
}
```

---

## 🛡️ Scam & Fake Scheme Detector Endpoints

### 10. Verify Scheme URL
Analyzes a URL using Google Gemini (`gemini-3.5-flash-lite`) to identify phishing domains, spoofed portals, and fake government registrations.

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

---

### 11. Scan Scheme Document (PDF / TXT)
Scans uploaded notification text or PDF files (up to 5MB) to verify official authenticity.

- **URL:** `/api/detect-file`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Form Data:** `file=[PDF or TXT file]`
- **Response:** `200 OK`
