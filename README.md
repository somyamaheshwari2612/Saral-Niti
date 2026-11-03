# 🇮🇳 Saral Niti
### Government Schemes Discovery Platform

**Bridging the gap between citizens and government welfare schemes through a fast, transparent, and voice-enabled discovery platform.**

[![Run Tests](https://github.com/somyamaheshwari2612/Saral-Niti/actions/workflows/test.yml/badge.svg)](https://github.com/somyamaheshwari2612/Saral-Niti/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white)](https://render.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://aistudio.google.com/)

Built with ❤️ by a team of 4 — GLA University, Mathura

---

## 📑 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Data Sources & Attribution](#-data-sources--attribution)
- [Tech Stack](#️-tech-stack)
- [Architecture & Deployment](#-architecture--deployment)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Getting Started Locally](#-getting-started-locally)
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 📖 About the Project

India provides thousands of central and state government welfare schemes — yet millions of eligible citizens miss out on critical benefits because official portals can be fragmented and complex to navigate.

**Saral Niti** (Hindi for *"Simple Policy"*) solves this challenge by providing:
- A searchable database of **4,847+ deduplicated, verified schemes** across all 36 States & Union Territories
- A **Multi-Dimensional Filter Engine** spanning demographics, geography, socio-economic standing, education, trades, benefit types, and MSME sectors
- A **Voice-Enabled Vernacular RAG Chatbot** supporting speech recognition, speech synthesis, code-mixed Hinglish queries, and verified official citations
- A rules-first **Personalized Eligibility Calculator** explaining exactly why a citizen qualifies or which criteria remain unmet
- An AI-powered **Scam & Fraud Detector** analyzing suspicious URLs and documents via Google Gemini

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔍 **High-Speed Scheme Explorer** | Sub-millisecond keyword search (SQLite FTS5) with batch pagination (24 cards/page) |
| 🎛️ **Multi-Dimensional Filters** | Interactive 6-card drawer filtering age, social categories (SC/ST/OBC/Minority/DNT), vulnerabilities, location, ration card, education, and trades |
| 🎙️ **Voice-First Vernacular Chatbot** | Browser-native Speech-to-Text and Text-to-Speech in Hindi/English, code-mixed NLU, and SQLite FTS5 RAG grounding |
| 🎯 **Personalized Eligibility Calculator** | Multi-factor questionnaire assessing citizen profile with transparent reasons and zero hallucinations |
| 🛡️ **Last-Mile Pre-Flight Audit** | Proactive diagnostic engine preventing departmental failure traps (Aadhaar-NPCI bank mapping, passbook spelling discrepancies, expired certificates, statutory tax exclusions) |
| 🛡️ **Scam & Fake Scheme Detector** | URL and PDF/document validator powered by Google Gemini (`gemini-3.5-flash-lite`) |
| 🌙 **Theme & Accessibility** | Dark mode with persistent session state and zero flash of unstyled content (FOUC) |
| 🚀 **Decoupled Deployment** | Pure static client ready for **Vercel**; lightweight Python REST backend ready for **Render** |

---

## 🏛️ Data Sources & Attribution

Saral Niti consolidates all civic and governmental datasets into a unified directory (`data/`), attributing all official authorities, civic researchers, and open data contributors:

### 1. Official Platform & System of Record
* **[myScheme Portal (myscheme.gov.in)](https://www.myscheme.gov.in/)**: The national citizen welfare discovery platform developed by the **National e-Governance Division (NeGD)**, **Digital India Corporation (DIC)**, and the **Ministry of Electronics and Information Technology (MeitY)**, Government of India.
* **[data.gov.in (Open Government Data)](https://www.data.gov.in/)**: Supplementary datasets and APIs aligned with the **Government Open Data License – India (GODL-India)**.

### 2. Verified Datasets & Retrieval Corpora (`data/`)
* **[Indian Government Schemes Data – July 2026](https://www.kaggle.com/datasets/ojaashampiholi/indian-government-schemes-data)** (`data/structured.csv`):
  * **Curator**: Ojaas Hampiholi (Kaggle)
  * **Scope**: 3,534 schemes (488 central, 3,046 state/UT) with 19 structured columns including section-wise eligibility, benefits, application process, documents, references, and FAQs. Current as of July 27, 2026.
* **[BharatSchemes v1](https://huggingface.co/datasets/Banothuarpitha/bharatschemes-v1)** (`data/train.jsonl`):
  * **Curator**: Banothu Arpitha (Hugging Face)
  * **Scope**: 2,029 persona-driven, instruction-following citizen Q&A pairs used for few-shot prompt tuning, vernacular conversational evaluation, and RAG answer quality benchmarks.
* **[MyScheme Welfare Schemes & FAQs](https://www.kaggle.com/datasets/elchemist/myscheme-india-govt-welfare-schemes)** (`data/schemes.csv` & `data/schemes_faqs.csv`):
  * **Curator**: Elchemist (Kaggle)
  * **Scope**: 4,670 central and state welfare schemes plus 51,435 official FAQ question-answer pairs for deep question-to-scheme retrieval.
* **[gov-myscheme-dataset](https://github.com/Aryan-Pardeshi/gov-myscheme-dataset)** (`data/gov_myscheme_data.csv`):
  * **Curator**: Aryan Pardeshi (GitHub)
  * **Scope**: Cleaned dataset of 2,066 schemes used for cross-dataset schema reconciliation and URL verification.
* **Canonical Production Seed** (`data/schemes.json`):
  * Deduplicated, normalized master dataset of **4,847 verified schemes** powering the local SQLite + FTS5 database engine.

### 3. Legal Compliance & Terms of Use
* In strict adherence with [myScheme's Terms of Use](https://www.myscheme.gov.in/terms-of-use), Saral Niti does not employ automated recurring scrapers or unauthorized crawling. All data is managed through verified open snapshots, attributed to official sources, and accompanied by direct official `.gov.in` / `.nic.in` application links.
* *Saral Niti is an independent civic-tech portal for informational discovery. It does not collect sensitive citizen Aadhaar information, charge fees, or claim guaranteed eligibility approvals.*

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Modular CSS3, Vanilla JavaScript (ES6+), Web Speech API (`SpeechRecognition` & `speechSynthesis`)
* **Backend**: Python 3.11+, Flask, Flask-CORS, Gunicorn, Requests, PDFPlumber
* **Database & Search**: SQLite3 with FTS5 Full-Text Search (zero cloud DB dependencies, sub-millisecond queries)
* **AI & Grounding**: Google Gemini REST API (`gemini-3.5-flash-lite`)
* **Hosting**:
  * **Frontend**: Vercel (`frontend/vercel.json`)
  * **Backend**: Render (`render.yaml`)

---

## 🌐 Architecture & Deployment

Saral Niti is cleanly decoupled into two independent deployment units:

```
+------------------------------------+          +------------------------------------+
|         FRONTEND (Vercel)          |          |          BACKEND (Render)          |
|  - Static HTML, CSS, Vanilla JS    |  HTTPS   |  - Flask REST API                  |
|  - Web Speech ASR & TTS            | -------> |  - SQLite FTS5 Engine (4,847 rows) |
|  - vercel.json rewrite routing     |          |  - Gemini 3.5 Flash Lite RAG       |
+------------------------------------+          +------------------------------------+
```

### Deploy Frontend on Vercel
1. In Vercel, import the repository and select **`frontend`** as the Root Directory.
2. Under Environment Variables (or in `frontend/index.html` `<meta name="backend-api" content="...">`), specify your Render backend URL:
   ```
   SARAL_API_BASE=https://your-backend.onrender.com
   ```
3. Deploy! Vercel handles global edge CDN delivery and routing via `vercel.json`.

### Deploy Backend on Render
1. In Render, select **New > Blueprint** and link your repository (or create a Web Service using `render.yaml`).
2. Set Root Directory to **`backend`**.
3. Environment variables:
   * `PYTHON_VERSION`: `3.11.9`
   * `GEMINI_MODEL`: `gemini-3.5-flash-lite`
   * `GEMINI_API_KEY`: Your Google Gemini API Key
4. Render runs `pip install -r requirements.txt && python scripts/seed_db.py` to auto-seed SQLite FTS5 in ~0.25 seconds, then launches via `gunicorn app:app`.

---

## 📁 Project Structure

```
Saral-Niti/
├── .github/
│   └── workflows/
│       └── test.yml           # GitHub Actions CI automated testing
├── backend/
│   ├── data/
│   │   ├── schemes.json       # Canonical dataset (4,847 verified schemes)
│   │   └── schemes.db         # Local SQLite + FTS5 search index (auto-generated)
│   ├── routes/
│   │   ├── chatbot.py         # Vernacular NLU, Speech RAG & Gemini synthesizer
│   │   ├── detector.py        # Fraud & scam detector (Gemini 3.5 Flash Lite)
│   │   ├── filter.py          # Multi-dimensional 6-category filtering engine
│   │   ├── recommend.py       # Deterministic rules-first eligibility calculator
│   │   └── schemes.py         # Scheme lookup and search endpoints
│   ├── scripts/
│   │   ├── build_frontend.py  # Synchronizes standalone frontend distribution
│   │   └── seed_db.py         # Fast database seeder
│   ├── static/                # Monolithic assets (CSS, JS)
│   ├── templates/             # Jinja2 templates (Schemes explorer, Modals)
│   ├── tests/
│   │   └── test_api.py        # Comprehensive test suite (33 unit tests)
│   ├── app.py                 # Flask REST application entry point
│   ├── database.py            # SQLite FTS5 thread-local database manager
│   └── requirements.txt       # Production dependencies (pure Flask, no MongoDB)
├── frontend/                  # Standalone decoupled frontend (for Vercel)
│   ├── css/                   # Modular CSS stylesheets
│   ├── js/                    # Main client & voice chatbot scripts
│   ├── index.html             # Production-ready static client
│   └── vercel.json            # Vercel deployment and routing configuration
├── data/                      # Unified data repository (schemes, FAQs, instruction sets)
│   ├── schemes.json           # Canonical master dataset (4,847 verified schemes)
│   ├── structured.csv         # July 2026 Kaggle dataset (3,534 schemes with section fields)
│   ├── train.jsonl            # BharatSchemes v1 instruction dataset (2,029 Q&A pairs)
│   ├── schemes_faqs.csv       # MyScheme 51,435 official question-answer pairs
│   ├── gov_myscheme_data.csv  # Curated secondary dataset (2,066 schemes)
│   └── README.md              # Dataset catalog and schema dictionary
├── docs/                      # Documentation
├── render.yaml                # Render Blueprint deployment configuration
├── .env.example               # Environment variables template
├── .gitignore
├── LICENSE
└── README.md
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schemes` | Returns active verified schemes |
| `GET` | `/api/schemes/:id` | Returns single scheme record by ID or slug |
| `GET` | `/api/search?q=` | High-speed SQLite FTS5 keyword search (<5ms) |
| `GET` | `/api/filter` | Category or query-param filtering with pagination |
| `POST` | `/api/filter` | Multi-dimensional filtering across all 6 categories |
| `POST` | `/api/recommend` | Personalized multi-factor eligibility evaluation |
| `POST` | `/api/chatbot` | Vernacular code-mixed NLU & RAG welfare assistant |
| `GET` | `/api/schemes/:id/last-mile-audit` | Departmental failure modes, audit traps, and verification checkpoints |
| `POST` | `/api/pre-audit` | Last-mile citizen diagnostic scoring readiness (0–100%) and clearance slip |
| `POST` | `/api/detect-url` | Scam URL detection (Google Gemini Flash Lite) |
| `POST` | `/api/detect-file` | Document validator (PDF/TXT) |

---

## 🚀 Getting Started Locally

**1. Clone the repository**
```bash
git clone https://github.com/somyamaheshwari2612/Saral-Niti.git
cd Saral-Niti
```

**2. Create and activate a virtual environment**
```bash
python -m venv backend/venv
# Windows:
backend\venv\Scripts\activate
# Linux/macOS:
source backend/venv/bin/activate
```

**3. Install dependencies**
```bash
pip install -r backend/requirements.txt
```

**4. Set up environment variables**
Copy `.env.example` to `backend/.env`:
```env
GEMINI_API_KEY="your_google_gemini_api_key_here"
GEMINI_MODEL="gemini-3.5-flash-lite"
```

**5. Start the application**
```bash
python backend/app.py
```
Open **`http://127.0.0.1:5000`** in your browser. The database auto-seeds in under 1 second!

---

## 🧪 Testing

The automated test suite runs completely offline without external cloud dependencies:

```bash
python backend/tests/test_api.py
```

All **37 unit tests** verify API routes, input sanitization, multi-dimensional filters, Hinglish NLU, last-mile pre-verification diagnostics, and eligibility evaluation.

---

## 🗺️ Roadmap

- [x] Merge Kaggle & GitHub datasets into 4,847 verified schemes
- [x] Migrate to high-speed local SQLite FTS5 search
- [x] Implement multi-dimensional 6-category filtering engine
- [x] Build voice-enabled vernacular RAG chatbot (Web Speech API + Gemini 3.5 Flash Lite)
- [x] Last-Mile Pre-Flight Verification & Diagnostic Engine (NPCI bank mapping, name concordance, certificate freshness)
- [x] Decouple frontend for independent Vercel hosting
- [ ] Add conversational accessibility co-pilot mode with quick-tap slot chips (see `for_future/`)
- [ ] Direct WhatsApp bot interface for rural citizen outreach

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**Made with 🧡 for the citizens of India 🇮🇳**
