# 🇮🇳 Saral Niti — Government Schemes Discovery Platform

Bridging the gap between citizens and government schemes through a simple, searchable platform.

> Similar to [myscheme.gov.in](https://myscheme.gov.in) — built by a team of 4.

---

## 🔗 Live Links
- **Frontend:** (GitHub Pages link — would be added later)
- **Backend API:** (Render link — would be added later)

---

## 🧑‍💻 Team & Responsibilities

| Person | Role | Branch |
|--------|------|--------|
| Dushyant Sharma | Frontend — HTML/CSS/JS | `frontend` |
| Savita | Backend — Flask APIs | `backend` |
| Aryan Singhal | Database — MongoDB Atlas | `database` |
| Somya Maheshwari | Live API + Chatbot + Deploy | `deployment` |

---

## 🛠️ Tech Stack
- **Frontend:** HTML, CSS, Bootstrap 5, JavaScript
- **Backend:** Python, Flask, PyMongo
- **Database:** MongoDB Atlas
- **Deployment:** GitHub Pages (frontend) + Render (backend)

---

## 🚀 How to Run Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # Fill in your MongoDB URI
python app.py
```

### Frontend
Just open `frontend/index.html` in your browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemes` | All schemes |
| GET | `/api/schemes/:id` | One scheme by ID |
| GET | `/api/search?q=` | Search schemes |
| GET | `/api/live/schemes?q=` | Live from MyScheme API |
| POST | `/api/chatbot` | Chatbot reply |

---

## 📁 Project Structure
```
saral-niti/
├── frontend/        # HTML pages + CSS + JS
├── backend/         # Flask app + routes
│   ├── routes/      # API route files
│   ├── models/      # Database schema
│   └── data/        # JSON dataset
└── docs/            # API docs + setup guide
```