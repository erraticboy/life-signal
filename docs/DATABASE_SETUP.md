# PostgreSQL + PostGIS Setup Guide

LIFE SIGNAL stores all relational records and spatial coordinates in **PostgreSQL** with the **PostGIS** extension.

---

## Option A: Local Windows Installation (Recommended for Offline Dev)

1. Download **PostgreSQL 16** from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).
2. At the end of the installer, launch **Stack Builder** and install **Spatial Extensions → PostGIS 3.x**.
3. Create the database and enable PostGIS in `psql` or pgAdmin:

```sql
CREATE USER lifesignal WITH PASSWORD 'lifesignal_dev';
CREATE DATABASE lifesignal OWNER lifesignal;
\c lifesignal
CREATE EXTENSION IF NOT EXISTS postgis;
```

4. Set `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg2://lifesignal:lifesignal_dev@localhost:5432/lifesignal
```

---

## Option B: Free-Tier Cloud PostgreSQL + PostGIS (No Local Install Required)

Both **Neon** and **Supabase** offer generous free tiers with PostGIS support:

1. Create a free PostgreSQL database on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. Run `CREATE EXTENSION IF NOT EXISTS postgis;` in the provider's SQL Editor.
3. Copy the connection string into `backend/.env` using the `postgresql+psycopg2://` driver prefix and `?sslmode=require`.

---

## Apply Database Migrations

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

This creates:
- `users`
- `complaints` (with `Geography(POINT, 4326)` + GIST spatial index)
- `ai_analysis`
- `duplicate_groups`
- `complaint_documents`
- `complaint_history`
- `audit_logs`
- `complaint_number_seq`

