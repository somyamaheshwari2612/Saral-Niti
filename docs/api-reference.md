# 📡 Saral Niti — REST API Reference

The Saral Niti backend provides high-performance RESTful endpoints for scheme discovery, FTS5 full-text search, multi-dimensional filtering, vernacular chatbot assistance, last-mile pre-flight audits, and AI fraud detection.

Base URL (Local): `http://127.0.0.1:5000`  
Base URL (Production): `https://<your-backend-domain>.onrender.com`

---

## 🏛️ Scheme Discovery Endpoints

### 1. Get Schemes (Paginated)
Returns a list of verified welfare schemes stored in the local SQLite database with server-side pagination.

- **URL:** `/api/schemes`
- **Method:** `GET`
- **Query Params (Optional):**
  - `page=[integer]` (default: `1`)
  - `limit=[integer]` (default: `50`, max: `100`; set `limit=0` or `all=true` for full bulk export)
  - `category=[string]` (optional, e.g. `agriculture`, `health`, `education`)
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "total": 4847,
  "count": 50,
  "page": 1,
  "limit": 50,
  "total_pages": 97,
  "has_more": true,
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
  "occupation": "farmer",
  "active_persona": {
    "label": "Rajesh (Papa)",
    "relationship": "father"
  }
}
```
> **High-Performance SQLite Pre-Filtering & Clean Evaluation:**
> - Evaluates schemes with native SQLite `json_extract` pre-filtering on `state`, `gender`, `min_age`, `max_age`, and `income_limit`, pruning disqualified rows at the database engine level.
> - Omits trivial reasons (such as `0–No upper limit` or universal caste matches), highlighting only genuine demographic qualifications and affirmative welfare reservations.

- **Response:** `200 OK`
```json
{
  "status": "ok",
  "total_evaluated": 670,
  "matched_count": 8,
  "target_subject": "father",
  "persona_label": "Rajesh (Papa)",
  "profile": {
    "age": 24,
    "gender": "male",
    "state": "Maharashtra",
    "income": 200000,
    "caste": "obc",
    "occupation": "farmer"
  },
  "recommendations": [
    {
      "scheme": { ... },
      "match_score": 100,
      "status": "eligible",
      "reasons": [
        "Open to all States and Union Territories (including Maharashtra).",
        "Age 24 meets minimum age requirement (≥ 18 years).",
        "Occupation match: Farmer."
      ],
      "unmet_criteria": []
    }
  ]
}
```

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
Multilingual conversational welfare assistant supporting code-mixed Hinglish, dynamic slot extraction, household persona context, SQLite FTS5 RAG retrieval, and Gemini 3.5 Flash Lite synthesis.

- **URL:** `/api/chatbot`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "message": "Are there any education loan schemes for me?",
  "history": [
    {
      "role": "user",
      "content": "I am a 21 year old student in Uttar Pradesh"
    },
    {
      "role": "model",
      "content": "Namaste! For a 21-year-old student in Uttar Pradesh, there are several scholarship and skill development programs available..."
    }
  ],
  "active_persona": {
    "label": "Rajesh (Papa)",
    "relationship": "father",
    "age": 58,
    "gender": "male",
    "state": "Uttar Pradesh",
    "occupation": "farmer"
  }
}
```
> **Multi-Turn Memory & Slot Accumulation:**
> - `history` *(optional, array)*: A client-maintained sliding window of prior turns (`[{ role: "user" | "model", content: string }]`), capped automatically by the backend to the most recent 6 turns.
> - **3-Tier Slot Accumulation Waterfall:** When answering a follow-up, slots are resolved in priority order:
>   1. Active Household Persona (`active_persona`) establishes base demographic defaults.
>   2. Historical User Turns (`history`) backfill previously stated attributes (e.g. state, age, category).
>   3. Current User Message (`message`) overrides any prior slots if the citizen changes context (e.g. *"Actually I moved to Bihar"*).

- **Response:** `200 OK`
```json
{
  "status": "ok",
  "reply": "Here are verified education loan and student welfare schemes in Uttar Pradesh for you:\n1. Vidya Lakshmi Education Loan Portal — Centralized portal for government-subsidized education loans\n2. UP Post-Matric Scholarship — Tuition reimbursement for UP college students...",
  "matched_schemes": [...],
  "extracted_slots": {
    "age": 21,
    "state": "Uttar Pradesh",
    "occupation": "student",
    "target_subject": "Myself"
  },
  "target_subject": "Myself",
  "inferred_relationship": "self",
  "suggested_followups": ["How to apply for Vidya Lakshmi?", "Income eligibility for UP scholarship"]
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

---

## 👨‍👩‍👧‍👦 Client-Side Household Persona Vault (Saral Parivar)

The frontend includes `SaralFamilyVault` (`js/family_vault.js`), a zero-knowledge, DPDP-compliant client-side dossier enabling citizens (acting as family anchors) to discover and track welfare benefits for themselves and their relatives (farming parents, student siblings, elderly grandparents) without storing PII on the backend server.

### Global Methods (`window.SaralFamilyVault`)

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `getMembers()` | None | `Array<Object>` | Retrieves all family member personas in the vault (defaults to primary "Self" persona). |
| `getMemberById(id)` | `id: string` | `Object \| null` | Finds a specific member persona by ID. |
| `getActiveMember()` | None | `Object` | Returns the currently active member persona. |
| `setActiveMember(id)` | `id: string` | `Object \| null` | Switches the active persona across the platform and dispatches `saral:active_persona_changed`. |
| `addMember(data)` | `data: Object` | `Object` | Validates, generates ID, saves new persona, and dispatches `saral:family_vault_updated`. |
| `updateMember(id, updates)` | `id: string, updates: Object` | `Object \| null` | Partially updates a persona and syncs active context. |
| `deleteMember(id)` | `id: string` | `boolean` | Deletes a non-primary relative persona (primary persona is protected). |
| `toChatbotContext([member])` | `member?: Object` | `Object` | Serializes member attributes into a clean demographic dictionary for `/api/chatbot` and `/api/recommend`. |
| `getHouseholdSummary()` | None | `Object` | Computes aggregate household statistics (total members, farmers, students, seniors, women). |
| `exportVaultJSON()` | None | `string` | Exports the full household roster as a portable backup JSON string. |
| `importVaultJSON(jsonStr)` | `jsonStr: string` | `boolean` | Validates and restores an imported household roster. |

### DOM Events Dispatched

- `saral:active_persona_changed`: Fired when the citizen switches the active member persona (detail: `{ member, previousId }`).
- `saral:family_vault_updated`: Fired when members are added, updated, deleted, or imported (detail: `{ action, member, roster }`).

### UI Components

- **Chat Widget Header Strip (`#chat-persona-bar`):** Horizontally scrollable chips (`[ 👤 Myself ] [ 🌾 Father ] [ ➕ Add ]`) embedded beneath the chat title bar. Switching personas dynamically updates the advising context and alerts the assistant.
- **Eligibility Modal Persona Strip (`#eligibilityPersonaStrip`):** Located above the recommendation questionnaire. Tapping any persona chip auto-populates age, gender, state, occupation, income, and vulnerability checkboxes.
- **Add / Edit Family Member Modal (`#familyMemberOverlay`):** Accessible from both the chatbot and recommendation views, providing relationship presets (Father, Mother, Student sibling, Grandparent, Spouse) with smart defaults.
