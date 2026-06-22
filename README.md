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
[![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=flat-square&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
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
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 📖 About the Project

India has 3,000+ central and state government welfare schemes — yet a large share of eligible citizens never discover them because existing portals are complex and hard to navigate.

**Saral Niti** (Hindi for *"Simple Policy"*) solves this by offering:
- A clean, searchable scheme browser
- Category-based filtering
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
`HTML5` · `CSS3` · `Bootstrap 5` · `Vanilla JavaScript`

**Backend**
`Python 3` · `Flask` · `Flask-Blueprints` · `Gunicorn`

**Database**
`MongoDB Atlas` · `PyMongo`

**AI / LLM**
`Groq API` — `LLaMA 3.3 70B`

**DevOps**
`GitHub Actions (CI)` · `Render` · `pytest`

---

## 🧑‍💻 Team & Responsibilities

| Name | Role | Branch | Key Contributions |
|---|---|---|---|
| **Savita** | Backend Developer | `backend` | Flask app, REST API routes, MongoDB connection |
| **Aryan Singhal** | Database Engineer | `database` | MongoDB schema design, seed script, data layer, unit tests, CI/CD pipeline |
| **Dushyant Sharma** | Frontend Developer | `frontend` | UI/UX, Bootstrap components, dark mode, fraud detector UI |
| **Somya Maheshwari** | Deployment & Integration | `deployment` | Chatbot, Render deployment, repo management |

---

## 📁 Project Structure

```
Saral-Niti/
├── .github/
│   └── workflows/
│       └── test.yml         # CI — runs pytest on every push
├── backend/
│   ├── data/                 # JSON dataset (local backup of schemes)
│   ├── models/                # Database schema definitions
│   ├── routes/                 # API route blueprints
│   ├── scripts/                 # DB seed scripts
│   ├── static/                  # CSS + JS assets
│   ├── templates/               # Jinja2 HTML templates
│   ├── tests/                   # pytest unit tests
│   ├── app.py                   # Flask entry point
│   ├── Procfile                 # Render start command
│   └── requirements.txt
├── docs/                     # API docs + setup guide
├── .gitignore
├── LICENSE
└── README.md
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schemes` | Get all schemes |
| `GET` | `/api/schemes/:id` | Get one scheme by ID |
| `GET` | `/api/search?q=` | Search schemes by keyword |
| `GET` | `/api/filter?category=` | Filter schemes by category |
| `POST` | `/api/chatbot` | Chatbot reply |
| `POST` | `/api/detect-url` | Fake URL detector |
| `POST` | `/api/detect-file` | Fake document detector |

---

## 🚀 Getting Started Locally

**1. Clone the repository**
```bash
git clone https://github.com/somyamaheshwari2612/Saral-Niti.git
cd Saral-Niti/backend
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Set up environment variables**

Create a `.env` file in the `backend/` folder:
```env
MONGO_URI=your_mongodb_atlas_connection_string
GROQ_API_KEY=your_groq_api_key
```

**4. Run the app**
```bash
python app.py
```

App will be live at `http://127.0.0.1:5000`

> 💡 If MongoDB connection fails, check that your network allows port `27017` — some college/office WiFi networks block it. Try a mobile hotspot or VPN.

---

## 🧪 Testing

Unit tests are written with **pytest** and run automatically via **GitHub Actions** on every push to `main`.

Run tests locally:
```bash
cd backend
python -m pytest tests/test_api.py -v
```

---

## 🗺️ Roadmap

- [ ] Expand database from 50 to 700+ schemes
- [ ] Live API integration (Data.gov.in)
- [ ] Multilingual support (Hindi + regional languages)
- [ ] Personalized eligibility checker
- [ ] React Native / Flutter mobile app
- [ ] State-level scheme coverage

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with 🧡 for the citizens of India

</div>
