# 🇮🇳 Saral Niti
### Government Schemes Discovery Platform

**Bridging the gap between citizens and government schemes through a simple, searchable platform.**

[![Run Tests](https://github.com/somyamaheshwari2612/Saral-Niti/actions/workflows/test.yml/badge.svg)](https://github.com/somyamaheshwari2612/Saral-Niti/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://aistudio.google.com/)

Built with ❤️ by a team of 4 — GLA University, Mathura

---

## 📑 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Data Sources & Attribution](#-data-sources--attribution)
- [Tech Stack](#️-tech-stack)
- [Team & Responsibilities](#-team--responsibilities)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Getting Started Locally](#-getting-started-locally)
- [Deployment Architecture](#-deployment-architecture)
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 📖 About the Project

India has 3,000+ central and state government welfare schemes — yet a large share of eligible citizens never discover them because existing portals are complex and hard to navigate.

**Saral Niti** (Hindi for *"Simple Policy"*) solves this by offering:
- A clean, lightning-fast scheme browser powered by **2,100+ verified schemes**
- Rules-first **Personalized Eligibility Calculator** with transparent matching criteria
- Sub-millisecond full-text search (SQLite FTS5)
- Category-based filtering across 10 vital sectors
- A conversational citizen assistant for guided discovery
- An AI-powered tool to flag fake scheme URLs and documents using Google Gemini

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Search & Filter** | Real-time keyword search and 10-category filtering across 2,100+ schemes |
| 🎯 **Eligibility Checker** | Transparent rules-first engine matching age, income, caste, state, and occupation |
| 📋 **Scheme Details** | Verified benefits, required documents, ministry, and direct official apply links |
| 🤖 **Chatbot** | Rule-based assistant that recommends schemes based on user intent |
| 🛡️ **Fraud Detector** | Google Gemini (Flash Lite)-powered URL & document checker — flags REAL / FAKE / SUSPICIOUS |
| 🌙 **Dark Mode** | Toggle with preference saved across sessions and zero white-flash (FOUC) |
| 📱 **Responsive UI** | Modern, clean layout fully optimized for mobile and desktop |

---

## 🏛️ Data Sources & Attribution

Saral Niti relies on officially licensed open government data and open-source civic technology contributions:

1. **Primary Official Source**:
   - **[myScheme Portal (myscheme.gov.in)](https://www.myscheme.gov.in/)**: National Citizen Welfare Scheme Discovery Platform, spearheaded by the **National e-Governance Division (NeGD)**, **Digital India Corporation (DIC)**, and the **Ministry of Electronics and Information Technology (MeitY)**, Government of India.
2. **Dataset Compilation & Curation**:
   - **[gov-myscheme-dataset](https://github.com/Aryan-Pardeshi/gov-myscheme-dataset)**: Open-source collection of 2,066 national and state welfare schemes curated by Aryan Pardeshi, licensed for informational and research applications.
3. **Open Government Data Framework**:
   - In alignment with the **Government Open Data License – India ([data.gov.in](https://data.gov.in/))**, promoting proactive public access to non-sensitive government information.
4. **Citizen Advisory & Disclaimer**:
   - *Saral Niti is an independent civic-tech portal created for public discovery. It is not an application submission gateway, does not charge fees, and does not guarantee eligibility approvals. Citizens are always directed to verify official deadlines, eligibility, and rules on respective official `.gov.in` / `.nic.in` portals before applying.*

---

## 🛠️ Tech Stack

**Frontend**
`HTML5` · `Modular CSS3` · `Vanilla JavaScript (ES6+)`

**Backend**
`Python 3` · `Flask` · `Flask-CORS` · `Gunicorn`

**Database & Search Engine**
`SQLite3 with FTS5` (Sub-millisecond Full-Text Search) · `Canonical JSON Dataset` (Git-tracked)

**AI / Security**
`Google Gemini REST API` (`gemini-2.5-flash-lite` / `gemini-3.5-flash-lite`)

**DevOps & CI/CD**
`GitHub Actions` · Automated Unit Test Suite

---

## 🧑‍💻 Team & Responsibilities

| Name | Role | Branch | Key Contributions |
|---|---|---|---|
| **Savita** | Backend Developer | `backend` | Flask app, REST API routes, data endpoints |
| **Aryan Singhal** | Database Engineer | `database` | Schema design, SQLite FTS5 query engine, data layer, unit tests |
| **Dushyant Sharma** | Frontend Developer | `frontend` | UI/UX, modular design system, dark mode, fraud detector UI |
| **Somya Maheshwari** | Deployment & Integration | `deployment` | Chatbot, recommendation engine, dataset normalization, repo management |

---

## 📁 Project Structure

```
Saral-Niti/
├── .github/
│   └── workflows/
│       └── test.yml         # CI — runs unit tests on every push
├── backend/
│   ├── data/
│   │   ├── schemes.json     # Canonical dataset (2,100+ verified schemes)
│   │   └── schemes.db       # High-speed SQLite + FTS5 database (auto-seeded)
│   ├── models/              # Scheme data model & validation
│   ├── routes/              # API blueprints (schemes, search, filter, recommend, detector, chatbot)
│   ├── scripts/             # Seeding & normalization tools
│   ├── static/              # CSS + JS assets (monolithic mode)
│   ├── templates/           # Jinja2 HTML templates
│   ├── tests/               # Unit test suite (mocked & offline-ready)
│   ├── app.py               # Flask entry point & REST API
│   ├── database.py          # SQLite FTS5 engine & collection adapter
│   ├── Procfile             # Cloud PaaS start command
│   └── requirements.txt
├── frontend/                # Standalone frontend (ready for Vercel / Netlify / Cloudflare)
│   ├── css/                 # Modular CSS stylesheets
│   ├── js/                  # App logic & chatbot client
│   └── index.html           # Production-ready static client
├── docs/
│   ├── api-reference.md     # Full REST API documentation
│   └── setup-guide.md       # Step-by-step setup and deployment guide
├── gov_myscheme_data.csv    # Raw 2,066 scheme source dataset
├── .env.example             # Template for environment variables
├── Procfile                 # Root start command for cloud PaaS
├── .gitignore
├── LICENSE
└── README.md
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schemes` | Get all active schemes (2,100+ records) |
| `GET` | `/api/schemes/:id` | Get scheme by ID or slug |
| `GET` | `/api/search?q=` | High-speed FTS5 keyword search (<1ms) |
| `GET` | `/api/filter?category=` | Filter schemes by category |
| `POST` | `/api/recommend` | Personalized multi-factor eligibility evaluation |
| `POST` | `/api/chatbot` | Citizen welfare assistant query |
| `POST` | `/api/detect-url` | Scam URL detection (Google Gemini Flash Lite) |
| `POST` | `/api/detect-file` | Document validator (PDF/TXT) |
| `GET` | `/api/live/schemes` | Live upstream scheme lookup |

See [docs/api-reference.md](docs/api-reference.md) for full request/response schemas.

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
Create `backend/.env` with your Gemini API key:
```env
GEMINI_API_KEY="your_google_gemini_api_key_here"
```

**5. Start the application**
```bash
python backend/app.py
```
Open **`http://127.0.0.1:5000`** in your browser. The database auto-seeds from `schemes.json` on first run in under 1 second. Zero database configuration required!

---

## 🧪 Testing

The automated test suite runs offline without external dependencies:

```bash
python backend/tests/test_api.py
```

All **25 unit tests** verify routes, input validation, search performance, and personalization rules.

---

## 🗺️ Roadmap

- [x] Expand database from 50 to 2,100+ central and state schemes
- [x] Implement rules-first personalized eligibility engine (`/api/recommend`)
- [x] Eliminate white flash (FOUC) on dark mode toggle
- [x] Build decoupled frontend distribution for independent hosting
- [ ] Multilingual support (Hindi + regional languages)
- [ ] React Native / Flutter mobile application

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**Made with 🧡 for the citizens of India 🇮🇳**
