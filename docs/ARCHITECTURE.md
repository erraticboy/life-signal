# LIFE SIGNAL — System Architecture

## 1. Security & Trust Boundaries

1. **Client never asserts identity or role:** The React frontend acquires a signed Firebase ID Token (`user.getIdToken()`) and sends it via `Authorization: Bearer <token>`.
2. **Backend cryptographic verification:** FastAPI verifies every token signature, issuer, audience, expiry, and revocation status using `firebase_admin.auth.verify_id_token(..., check_revoked=True)`.
3. **Fail-closed configuration:** If Firebase Admin SDK or PostgreSQL is not configured, protected endpoints return explicit `503 Service Unavailable` diagnostics instead of issuing fake sessions or dummy data.
4. **Strict RBAC:**
   - `citizen` role is assigned by default to all newly authenticated users.
   - `admin` role can only be granted via verified `ADMIN_BOOTSTRAP_EMAILS` on the server, the server-side CLI (`app.scripts.manage_roles`), or an existing authenticated `admin` calling `PATCH /api/v1/admin/users/{user_id}/role` (recorded in `audit_logs`).
   - Client-supplied `role` fields on profile updates or session sync are rejected/ignored.

## 2. Phased Module Layout

- `backend/app/core/`: Settings, SQLAlchemy engine, Firebase Admin verification, RBAC dependencies, rate limiter, audit logging.
- `backend/app/models/`: Normalized PostgreSQL + PostGIS models for all 7 tables.
- `backend/app/services/`: Clean domain boundaries for Phase 2 (`pdf`, `email`), Phase 3 (`ai_vision`, `duplicates`, `uncertainty`), and Phase 4 (`geospatial`, `maintenance`).
- `ml_research/`: Standalone dataset curation, YOLO training, confidence calibration (ECE), and predictive maintenance benchmarks.

