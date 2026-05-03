# 🇮🇳 Saral Niti — Government Schemes Discovery Platform

Bridging the gap between citizens and government schemes 
through a simple, searchable platform.

Built by a team of 4 💗

---

## 🔗 Live App
🌐 https://saral-niti-backend.onrender.com

> ⚠️ Hosted on Render's free tier — may take ~50 seconds 
> to load on first visit after inactivity.

---

## 🧑‍💻 Team & Responsibilities

| Name | Role | Branch |
|------|------|--------|
| Dushyant Sharma | Frontend — HTML/CSS/JS/Bootstrap | `frontend` |
| Savita | Backend — Flask APIs | `backend` |
| Aryan Singhal | Database — MongoDB Atlas | `database` |
| Somya Maheshwari | Chatbot + Deployment | `deployment` |

---

## 🛠️ Tech Stack
- **Frontend:** HTML, CSS, Bootstrap 5, JavaScript
- **Backend:** Python, Flask, PyMongo, Gunicorn
- **Database:** MongoDB Atlas
- **AI:** Groq API (LLaMA 3.3 70B) — fake scheme detection
- **Deployment:** Render (full stack)

---

## ✨ Features
- 🔍 Search and filter government schemes by category
- 📋 Detailed scheme view with eligibility, benefits, 
  and apply link
- 🤖 Rule-based chatbot for scheme discovery
- 🛡️ AI-powered URL and document detector to identify 
  fake schemes
- 🌙 Dark mode support

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemes` | All schemes |
| GET | `/api/schemes/:id` | One scheme by ID |
| GET | `/api/search?q=` | Search schemes |
| GET | `/api/filter?category=` | Filter by category |
| POST | `/api/chatbot` | Chatbot reply |
| POST | `/api/detect-url` | Fake URL detector |
| POST | `/api/detect-file` | Fake document detector |

---
## 📁 Project Structure
```
Saral-Niti/
├── backend/
│   ├── data/            # JSON dataset
│   ├── models/          # Database schema
│   ├── routes/          # API route files
│   ├── scripts/         # Seed scripts
│   ├── static/          # CSS + JS files
│   ├── templates/       # HTML templates
│   ├── app.py           # Flask entry point
│   ├── Procfile         # Render deployment config
│   └── requirements.txt
├── docs/                # API docs + setup guide
├── .gitignore
├── LICENSE
└── README.md
```
---

## 📄 License
MIT License