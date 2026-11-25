"""FastAPI application entrypoint for LIFE SIGNAL."""

from __future__ import annotations

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.rate_limit import limiter


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title=f"{settings.APP_NAME} API",
        description="AI-Powered Urban Infrastructure Intelligence Platform",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    application.add_middleware(SlowAPIMiddleware)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @application.middleware("http")
    async def add_security_headers(request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response

    @application.get("/", tags=["System"])
    def api_root() -> dict[str, str]:
        return {
            "service": f"{settings.APP_NAME} API",
            "docs": "/docs",
            "health": f"{settings.API_V1_PREFIX}/health/ready",
            "frontend_url": settings.APP_BASE_URL,
        }

    @application.get("/favicon.ico", include_in_schema=False)
    def favicon_noop() -> Response:
        return Response(status_code=204)

    application.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return application


app = create_app()

