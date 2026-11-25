"""Secure local storage and image validation helpers."""

from __future__ import annotations

import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings

ALLOWED_PIL_FORMATS: dict[str, str] = {
    "JPEG": ".jpg",
    "PNG": ".png",
}


def ensure_storage_dirs() -> tuple[Path, Path]:
    """Ensure upload and PDF directories exist inside configured STORAGE_ROOT."""
    root = get_settings().resolved_storage_root
    uploads_dir = root / "uploads"
    pdfs_dir = root / "pdfs"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    return uploads_dir, pdfs_dir


def resolve_storage_path(relative_path: str) -> Path:
    """Resolve a stored relative path while strictly preventing directory traversal."""
    root = get_settings().resolved_storage_root.resolve()
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage file reference.",
        ) from exc
    return candidate


async def validate_and_save_complaint_image(
    upload: UploadFile,
    complaint_number: str,
) -> str:
    """Validate genuine JPG/PNG image bytes, enforce size cap, and save safely."""
    settings = get_settings()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    raw_bytes = await upload.read(max_bytes + 1)
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image file is empty.",
        )
    if len(raw_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum allowed size of {settings.MAX_UPLOAD_MB} MB.",
        )

    try:
        with Image.open(BytesIO(raw_bytes)) as img:
            img.verify()
        with Image.open(BytesIO(raw_bytes)) as img_reopen:
            fmt = (img_reopen.format or "").upper()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid JPG or PNG image.",
        ) from exc

    ext = ALLOWED_PIL_FORMATS.get(fmt)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, JPEG, and PNG images are permitted.",
        )

    uploads_dir, _ = ensure_storage_dirs()
    safe_name = f"{complaint_number}_{uuid.uuid4().hex[:10]}{ext}"
    dest = uploads_dir / safe_name
    dest.write_bytes(raw_bytes)
    return f"uploads/{safe_name}"

