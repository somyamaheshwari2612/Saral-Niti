# 🛠️ Saral Niti — Local Setup & Deployment Guide

This guide walks through setting up **Saral Niti** locally, seeding the database, and deploying the backend and frontend separately or as a unified app.

---

## 📋 Prerequisites

- **Python 3.10+** (Tested on Python 3.11, 3.12, 3.14)
- **MongoDB Atlas** account (or local MongoDB server on `localhost:27017`)
- **Google Gemini API Key** (Free from [aistudio.google.com](https://aistudio.google.com/app/apikey)) for AI scam detection

---

## 💻 1. Local Full-Stack Setup (Monolithic)

In monolithic mode, the Flask server hosts both the REST API and the citizen UI at `http://127.0.0.1:5000`.

### Step 1: Clone the Repository
```bash
git clone https://github.com/somyamaheshwari2612/Saral-Niti.git
cd Saral-Niti
```

### Step 2: Set Up Virtual Environment & Dependencies
```bash
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Linux / macOS
source venv/bin/activate

pip install -r backend/requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` into `backend/.env`:
```bash
cp .env.example backend/.env
```
Open `backend/.env` and update:
```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/saral_niti_db?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
FLASK_ENV=development
PORT=5000
```

### Step 4: Seed the Database
Populate the 50 government schemes into your MongoDB Atlas cluster:
```bash
python backend/scripts/seed_db.py
```

### Step 5: Start the Development Server
```bash
python backend/app.py
```
Open `http://127.0.0.1:5000` in your web browser.

---

## 🧪 2. Running Tests

Unit tests run without requiring a live database connection thanks to built-in mocking:
```bash
# Via pytest
cd backend
python -m pytest tests/test_api.py -v

# Or directly via Python
python tests/test_api.py
```

---

## 🚀 3. Separate Deployment Architecture

Saral Niti is engineered to deploy the backend API and the frontend client independently.

### A. Backend Deployment (Render / Railway)
- **Platform:** Render Web Service (or Railway)
- **Root Directory:** `backend` (or repo root with `render.yaml`)
- **Runtime:** Python 3
- **Build Command:** `pip install -r requirements.txt && python scripts/seed_db.py`
- **Start Command:** `gunicorn app:app`
- **Environment Variables on Render:**
  - `GEMINI_API_KEY`: Your Google Gemini API key
  - `GEMINI_MODEL`: `gemini-3.5-flash-lite`

### B. Frontend Deployment (Vercel / Netlify)
- **Platform:** Vercel or Netlify (Pre-configured via `frontend/vercel.json` and `frontend/netlify.toml`)
- **Root Directory:** `frontend`
- **Build Command:** None (static assets)
- **Output Directory:** `.` (root of frontend folder)
- **API Connection:**
  Set your deployed backend URL in `frontend/index.html` via the `<meta name="backend-api" content="https://your-backend-api.onrender.com">` tag, or set:
  ```html
  <script>window.SARAL_API_BASE = "https://your-backend-api.onrender.com";</script>
  ```

