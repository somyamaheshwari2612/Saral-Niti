# 🛠️ Saral Niti — Local Setup & Deployment Guide

This guide walks through setting up **Saral Niti** locally, auto-seeding the SQLite FTS5 search database from the unified `data/` directory, and deploying the frontend on **Vercel** and backend on **Render**.

---

## 📋 Prerequisites

- **Python 3.11+** (Tested on Python 3.11, 3.12, 3.14)
- **Local SQLite3** (Built into standard Python — zero cloud database accounts required)
- **Google Gemini API Key** (Free from [aistudio.google.com](https://aistudio.google.com/app/apikey)) for AI scheme verification and chatbot assistance

---

## 💻 1. Local Full-Stack Setup

In local mode, the Flask server hosts both the REST API and the citizen UI at `http://127.0.0.1:5000`.

### Step 1: Clone the Repository
```bash
git clone https://github.com/somyamaheshwari2612/Saral-Niti.git
cd Saral-Niti
```

### Step 2: Set Up Virtual Environment & Dependencies
```bash
python -m venv backend/venv

# Windows (PowerShell)
.\backend\venv\Scripts\Activate.ps1

# Linux / macOS
source backend/venv/bin/activate

pip install -r backend/requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` into `backend/.env`:
```bash
cp .env.example backend/.env
```
Open `backend/.env` and update:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
FLASK_ENV=development
PORT=5000
```

### Step 4: Seed the Local SQLite Database
Seed the 4,847 verified government schemes with FTS5 full-text indexing from `data/schemes.json`:
```bash
python backend/scripts/seed_db.py
```
*Note: If you run `python backend/app.py` directly, it will auto-seed the database automatically on startup if missing.*

### Step 5: Start the Development Server
```bash
python backend/app.py
```
Open `http://127.0.0.1:5000` in your web browser.

---

## 🧪 2. Running Automated Tests

The test suite runs 100% offline without external cloud dependencies:
```bash
python backend/tests/test_api.py
```
All **37 unit tests** verify search, filtering, eligibility calculation, voice chatbot NLU, and last-mile pre-verification diagnostics.

---

## 🚀 3. Decoupled Deployment Architecture

Saral Niti is architected for independent, zero-cost production hosting:

### A. Backend Deployment (Render)
- **Platform:** Render Web Service (Pre-configured via root `render.yaml`)
- **Root Directory:** `backend`
- **Runtime:** Python 3.11
- **Build Command:** `pip install -r requirements.txt && python scripts/seed_db.py`
- **Start Command:** `gunicorn app:app`
- **Environment Variables on Render:**
  - `GEMINI_API_KEY`: Your Google Gemini API key
  - `GEMINI_MODEL`: `gemini-3.5-flash-lite`

### B. Frontend Deployment (Vercel)
- **Platform:** Vercel (Pre-configured via `frontend/vercel.json`)
- **Root Directory:** `frontend`
- **Build Command:** None (pure static client)
- **Output Directory:** `.` (root of frontend folder)
- **API Connection:**
  Configure your Render backend URL in `frontend/index.html` via the `<meta name="backend-api" content="https://your-backend-api.onrender.com">` tag, or define `SARAL_API_BASE`.
