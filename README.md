<div align="center">

# 🇮🇳 Saral Niti
### Government Schemes Discovery Platform

**Bridging the gap between citizens and government schemes through a simple, searchable platform.**

[![Live App](https://img.shields.io/badge/Live%20App-Visit%20Now-FF6B00?style=for-the-badge)](https://saral-niti-backend.onrender.com)
[![Run Tests](https://github.com/somyamaheshwari2612/Saral-Niti/actions/workflows/test.yml/badge.svg)](https://github.com/somyamaheshwari2612/Saral-Niti/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Groq](https://img.shields.io/badge/Groq%20AI-F55036?style=flat-square&logo=lightning&logoColor=white)](https://groq.com/)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white)](https://render.com/)

Built with ❤️ by a team of 4 — GLA University, Mathura

</div>

---

## 📑 Table of Contents

- [About the Project](#-about-the-project)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Team & Responsibilities](#-team--responsibilities)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Getting Started Locally](#-getting-started-locally)
- [Deployment (Independent Frontend & Backend)](#-deployment-options)
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 📖 About the Project

India has 3,000+ central and state government welfare schemes — yet a large share of eligible citizens never discover them because existing portals are complex and hard to navigate.

**Saral Niti** (Hindi for *"Simple Policy"*) solves this by offering:
- A clean, searchable scheme browser
- Category-based filtering across 10 sectors
- A conversational chatbot for guided discovery
- An AI-powered tool to flag fake scheme URLs and documents

---

## 🌐 Live Demo

**🔗 [saral-niti-backend.onrender.com](https://saral-niti-backend.onrender.com)**

> ⚠️ Hosted on Render's free tier — the first request after a period of inactivity may take **~50 seconds** while the server spins up.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Search & Filter** | Real-time keyword search and 10-category filtering across 50+ schemes |
| 📋 **Scheme Details** | Eligibility, benefits, ministry, and direct apply links in a modal view |
| 🤖 **Chatbot** | Rule-based assistant that recommends schemes based on user intent |
| 🛡️ **Fraud Detector** | Groq (LLaMA 3.3 70B)-powered URL & document checker — flags REAL / FAKE / SUSPICIOUS |
| 🌙 **Dark Mode** | Toggle with preference saved across sessions |
| 📱 **Responsive UI** | Fully usable on mobile and desktop |

---

## 🛠️ Tech Stack

**Frontend**
`HTML5` · `Modular CSS3` · `Vanilla JavaScript (ES6+)`

**Backend**
`Python 3` · `Flask` · `Flask-CORS` · `Gunicorn`

**Database**
`MongoDB Atlas` · `PyMongo`

**AI / LLM**
`Groq API` — `LLaMA 3.3 70B`

**DevOps & CI/CD**
`GitHub Actions` · `Render` · `pytest`

---

## 🧑‍💻 Team & Responsibilities

| Name | Role | Branch | Key Contributions |
|---|---|---|---|
| **Savita** | Backend Developer | `backend` | Flask app, REST API routes, MongoDB connection |
| **Aryan Singhal** | Database Engineer | `database` | MongoDB schema design, seed script, data layer, unit tests, CI/CD pipeline |
| **Dushyant Sharma** | Frontend Developer | `frontend` | UI/UX, modular design system, dark mode, fraud detector UI |
| **Somya Maheshwari** | Deployment & Integration | `deployment` | Chatbot, Render deployment, repo management |

---

## 📁 Project Structure

```
Saral-Niti/
├── .github/
│   └── workflows/
│       └── test.yml         # CI — runs unit tests on every push
├── backend/
│   ├── data/                # JSON dataset (backup of schemes)
│   ├── models/              # Scheme data model & validation
│   ├── routes/              # API blueprints (schemes, search, filter, detector, chatbot)
│   ├── scripts/             # Database seed script (seed_db.py)
│   ├── static/              # CSS + JS assets (monolithic mode)
│   ├── templates/           # Jinja2 HTML templates
│   ├── tests/               # Unit test suite (mocked & offline-ready)
│   ├── app.py               # Flask entry point & REST API
│   ├── Procfile             # Render start command
│   └── requirements.txt
├── frontend/                # Standalone frontend (Vercel / Netlify / Cloudflare)
│   ├── css/                 # Modular CSS stylesheets
│   ├── js/                  # App logic & chatbot client
│   └── index.html           # Production-ready static client
├── docs/
│   ├── api-reference.md     # Full REST API documentation
│   └── setup-guide.md       # Step-by-step setup and deployment guide
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
| `GET` | `/api/schemes` | Get all active schemes |
| `GET` | `/api/schemes/:id` | Get scheme by MongoDB ObjectId |
| `GET` | `/api/search?q=` | Search schemes by keyword |
| `GET` | `/api/filter?category=` | Filter schemes by category |
| `POST` | `/api/chatbot` | Chatbot assistance query |
| `POST` | `/api/detect-url` | Scam URL detection (Groq LLaMA 3.3 70B) |
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

**2. Create virtual environment & install dependencies**
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r backend/requirements.txt
```

**3. Configure environment variables**
```bash
cp .env.example backend/.env
```
Fill in your `MONGO_URI` and `GROQ_API_KEY`.

**4. Seed the database**
```bash
python backend/scripts/seed_db.py
```

**5. Run the server**
```bash
python backend/app.py
```
App will be live at `http://127.0.0.1:5000`

---

## ☁️ Deployment Options

### Separate Deployment (Recommended)
- **Backend on Render:** Point root directory to `backend`, start command `gunicorn app:app`, and set `MONGO_URI` & `GROQ_API_KEY` in Render environment settings.
- **Frontend on Vercel / Netlify:** Point root directory to `frontend`, no build command needed. The frontend automatically routes API calls to the live backend.

### Unified Deployment (Monolithic)
- Point root directory to repo root or `backend`. Flask serves both the REST API and the integrated UI out of the box.

For detailed steps, refer to [docs/setup-guide.md](docs/setup-guide.md).

---

## 🧪 Testing

Unit tests run with in-memory database mocking so they execute deterministically offline and in GitHub Actions CI:

```bash
cd backend
python -m pytest tests/test_api.py -v
```

Or run directly without pytest:
```bash
python backend/tests/test_api.py
```

---

## 🗺️ Roadmap

- [ ] Expand database from 50 to 700+ schemes
- [ ] Multilingual support (Hindi + regional languages)
- [ ] Personalized eligibility calculator
- [ ] React Native / Flutter mobile app
- [ ] State-level scheme coverage

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with 🧡 for the citizens of India

</div>
