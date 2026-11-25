# LIFE SIGNAL — Setup & Architecture Guide

> **"Report Problems. Discover Patterns. Build Better Cities."**

LIFE SIGNAL is an AI-powered urban infrastructure intelligence platform built with **React + TypeScript + Tailwind CSS + Leaflet + Recharts**, **FastAPI + SQLAlchemy + Alembic**, **PostgreSQL + PostGIS**, **Firebase Authentication**, **ReportLab PDF + QR**, **SMTP**, and modular **CV / Uncertainty / DBSCAN / Predictive Maintenance** pipelines.

---

## Phased Build Status

- **Phase 1 (Complete):** Project architecture, Supabase PostgreSQL + PostGIS schema & Alembic migrations (`0001_initial_schema`), Firebase Google + Email/Password authentication, strict backend RBAC (`citizen` / `admin`), public pages, and local development JWT auth (`ENABLE_DEV_AUTH=true` in `APP_ENV=development` only).
- **Phase 2 (Complete):** Citizen complaint registration (`LS-YYYY-NNNNNN`), validated JPG/PNG photo upload, browser GPS + interactive Leaflet OpenStreetMap pin picker, PostGIS `Geography(POINT, 4326)` storage, automatic official ReportLab PDF acknowledgment with QR tracking code & embedded photo, protected PDF/image downloads, real SMTP email delivery with PDF attachment, Citizen complaint history/details, and Admin complaint status management.
- **Phase 3 (Complete):** Infrastructure damage Computer Vision (`ultralytics.YOLO` + clearly labeled OpenCV demo fallback), Uncertainty-Aware AI (Temperature Scaling, ECE, MC Dropout/TTA entropy, mandatory human verification flagging), and Multimodal Duplicate Detection (image descriptors + Sentence Transformers / TF-IDF + Haversine geo + temporal delta).
- **Phase 4 (Complete):** PostGIS + DBSCAN hotspot clustering, Interactive Infrastructure Map with multi-attribute filters & duplicate links, Explainable Complaint Prioritization Engine with factor breakdown & Admin review overrides, Conditional Random Forest / XGBoost Predictive Maintenance Analytics, and audit-logged CSV/JSON/PDF exports.
- **Phase 5 (Ready / Deployment & Hardening):** End-to-end automated backend suite (`pytest`), TypeScript/Vite build verification, and free-tier deployment guides below.

---

## Quick Start (Local Development)

### 1. Database (PostgreSQL + PostGIS)
Follow [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md). Set `DATABASE_URL` in `backend/.env` and apply migrations:
```powershell
cd backend
.\.venv\Scripts\alembic.exe upgrade head
```

### 2. Authentication (Firebase or Local Development Mode)
- **Real Google Sign-In:** Follow [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) to configure `frontend/.env` (`VITE_FIREBASE_*`) and `backend/.env` (`FIREBASE_PROJECT_ID` / `FIREBASE_SERVICE_ACCOUNT_PATH`).
- **Local Dev Testing:** Set `APP_ENV=development` and `ENABLE_DEV_AUTH=true` in `backend/.env` and `VITE_ENABLE_DEV_AUTH=true` in `frontend/.env`.

### 3. Gmail SMTP Setup (for Automatic PDF Email Delivery)
1. Enable 2-Step Verification on Google Account and create an App Password.
2. Configure `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USE_TLS=true`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL` in `backend/.env`.

### 4. Run Backend & Frontend
```powershell
# Terminal 1 — Backend (http://localhost:8000)
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

### 5. Run Verification Suites
```powershell
# Backend unit & integration tests
cd backend
.\.venv\Scripts\python.exe -m pytest -v

# Frontend typecheck & production bundle
cd frontend
npm run build
```

---

## Free-Tier Cloud Deployment Guide

1. **PostgreSQL + PostGIS:** Supabase or Neon free tier (`CREATE EXTENSION IF NOT EXISTS postgis;`, run `alembic upgrade head`).
2. **Backend (Render / Railway / Fly.io):**
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set `APP_ENV=production`, `ENABLE_DEV_AUTH=false`, `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CORS_ORIGINS=https://your-frontend.vercel.app`, `APP_BASE_URL=https://your-frontend.vercel.app`, and `SMTP_*`.
3. **Frontend (Vercel / Cloudflare Pages / Netlify):**
   - Root directory: `frontend`
   - Build command: `npm run build`, output directory: `dist`
   - Set `VITE_API_BASE_URL=https://your-backend.onrender.com`, `VITE_ENABLE_DEV_AUTH=false`, and `VITE_FIREBASE_*`.
   - Add your Vercel/Netlify domain to Firebase Console → Authentication → Settings → Authorized domains.
