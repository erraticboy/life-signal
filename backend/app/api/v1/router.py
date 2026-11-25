"""Version 1 API router aggregation."""

from fastapi import APIRouter

from app.api.v1 import admin, ai, auth, citizen, complaints, health, intelligence

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(citizen.router)
api_router.include_router(complaints.router)
api_router.include_router(admin.router)
api_router.include_router(ai.router)
api_router.include_router(intelligence.router)
