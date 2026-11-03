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
| 🛡️ **Scam & Fake Scheme Detector** | URL and PDF/document validator powered by Google Gemini (`gemini-3.5-flash-lite`) |
| 🌙 **Theme & Accessibility** | Dark mode with persistent session state and zero flash of unstyled content (FOUC) |
| 🚀 **Decoupled Deployment** | Pure static client ready for **Vercel**; lightweight Python REST backend ready for **Render** |

---

## 🏛️ Data Sources & Attribution

Saral Niti relies on officially licensed open government data and open-source civic technology contributions:

1. **Primary Official Reference**:
   - **[myScheme Portal (myscheme.gov.in)](https://www.myscheme.gov.in/)**: National Citizen Welfare Scheme Discovery Platform by the **National e-Governance Division (NeGD)**, **Digital India Corporation (DIC)**, and **MeitY**, Government of India.
2. **Dataset Compilation & Normalization**:
   - Merged and normalized **4,847 verified schemes** from the Kaggle myScheme Open Dataset and the curated GitHub `gov-myscheme-dataset`, deduplicated via title, ministry, and canonical slugs.
3. **Open Government Data Framework**:
   - Aligned with the **Government Open Data License – India ([data.gov.in](https://data.gov.in/))** promoting proactive public access to civic information.
4. **Citizen Advisory & Disclaimer**:
   - *Saral Niti is an independent, non-commercial civic-tech portal for public informational discovery. It does not collect user Aadhaar data, charge fees, or guarantee official approvals. Citizens are always linked directly to official `.gov.in` / `.nic.in` portals.*

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

All **33 unit tests** verify API routes, input sanitization, multi-dimensional filters, Hinglish NLU, and eligibility evaluation.

---

## 🗺️ Roadmap

- [x] Merge Kaggle & GitHub datasets into 4,847 verified schemes
- [x] Migrate to high-speed local SQLite FTS5 search
- [x] Implement multi-dimensional 6-category filtering engine
- [x] Build voice-enabled vernacular RAG chatbot (Web Speech API + Gemini 3.5 Flash Lite)
- [x] Decouple frontend for independent Vercel hosting
- [ ] Add conversational accessibility co-pilot mode with quick-tap slot chips (see `for_future/`)
- [ ] Direct WhatsApp bot interface for rural citizen outreach

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**Made with 🧡 for the citizens of India 🇮🇳**
