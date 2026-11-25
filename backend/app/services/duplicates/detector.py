"""Multimodal duplicate complaint detection (image + text + Haversine geo + temporal delta)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.complaint import Complaint
from app.models.duplicate import DuplicateGroup, DuplicateReviewStatus
from app.services.storage import resolve_storage_path

_SENTENCE_MODEL_CACHE: dict[str, Any] = {}


@dataclass(frozen=True)
class DuplicateCandidateMatch:
    primary_complaint_id: object
    related_complaint_id: object
    similarity_score: float
    image_similarity: float | None
    text_similarity: float
    distance_meters: float
    time_diff_hours: float
    text_backend: str
    image_backend: str


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance between two WGS84 coordinates in meters."""
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def _get_sentence_transformer() -> Any | None:
    if "model" in _SENTENCE_MODEL_CACHE:
        return _SENTENCE_MODEL_CACHE["model"]
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        _SENTENCE_MODEL_CACHE["model"] = model
        return model
    except Exception:
        _SENTENCE_MODEL_CACHE["model"] = None
        return None


def compute_text_similarity_matrix(texts: list[str]) -> tuple[np.ndarray, str]:
    """Compute pairwise cosine similarity using cached Sentence Transformers or TF-IDF fallback."""
    if len(texts) < 2:
        return np.ones((len(texts), len(texts)), dtype=np.float64), "none"

    st_model = _get_sentence_transformer()
    if st_model is not None:
        embeddings = st_model.encode(texts, normalize_embeddings=True)
        sim = np.clip(np.matmul(embeddings, embeddings.T), 0.0, 1.0)
        return sim, "sentence-transformers:all-MiniLM-L6-v2"

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    try:
        tfidf = vectorizer.fit_transform(texts)
        sim = np.clip(cosine_similarity(tfidf), 0.0, 1.0)
    except ValueError:
        # Fallback if vocabulary is empty (e.g., all stop words)
        sim = np.eye(len(texts), dtype=np.float64)
    return sim, "sklearn-tfidf-cosine"


def extract_image_descriptor(image_path: Path) -> np.ndarray | None:
    """Extract an L2-normalized 64-D OpenCV HSV + Sobel structural descriptor vector."""
    img = cv2.imread(str(image_path))
    if img is None:
        return None

    resized = cv2.resize(img, (128, 128))
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [16], [0, 180]).flatten()
    hist_s = cv2.calcHist([hsv], [1], None, [16], [0, 256]).flatten()
    hist_v = cv2.calcHist([hsv], [2], None, [16], [0, 256]).flatten()

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    edge_hist, _ = np.histogram(ang, bins=16, range=(0, 360), weights=mag)

    vec = np.concatenate([hist_h, hist_s, hist_v, edge_hist]).astype(np.float64)
    norm = float(np.linalg.norm(vec))
    return (vec / norm) if norm > 1e-12 else None


def scan_duplicate_candidates(
    db: Session,
    *,
    threshold: float | None = None,
) -> tuple[list[DuplicateGroup], dict[str, str]]:
    """
    Score pairs of complaints across image, text, geographic, and temporal dimensions.
    Persist candidate pairs above threshold without deleting any complaint records.
    """
    settings = get_settings()
    cutoff = threshold if threshold is not None else settings.DUPLICATE_THRESHOLD

    complaints = db.execute(select(Complaint).order_by(Complaint.created_at.asc())).scalars().all()
    if len(complaints) < 2:
        return [], {"text_backend": "none", "image_backend": "none"}

    texts = [
        f"{c.title} {c.description} {c.category.value.replace('_', ' ')} {c.address}"
        for c in complaints
    ]
    text_sim_matrix, text_backend = compute_text_similarity_matrix(texts)

    img_vectors: list[np.ndarray | None] = []
    for c in complaints:
        if c.image_path:
            disk_path = resolve_storage_path(c.image_path)
            img_vectors.append(extract_image_descriptor(disk_path) if disk_path.is_file() else None)
        else:
            img_vectors.append(None)

    image_backend = "opencv-hsv-edge-descriptor"
    w_img = settings.DUPLICATE_WEIGHT_IMAGE
    w_txt = settings.DUPLICATE_WEIGHT_TEXT
    w_geo = settings.DUPLICATE_WEIGHT_GEO
    w_time = settings.DUPLICATE_WEIGHT_TIME

    matches: list[DuplicateCandidateMatch] = []
    for i in range(len(complaints)):
        for j in range(i + 1, len(complaints)):
            c1, c2 = complaints[i], complaints[j]
            dist_m = haversine_meters(c1.latitude, c1.longitude, c2.latitude, c2.longitude)
            if dist_m > settings.DUPLICATE_MAX_RADIUS_METERS:
                continue

            geo_score = math.exp(-dist_m / 120.0)
            time_hours = abs((c2.created_at - c1.created_at).total_seconds()) / 3600.0
            time_score = math.exp(-time_hours / 72.0)
            text_score = float(text_sim_matrix[i, j])

            v1, v2 = img_vectors[i], img_vectors[j]
            if v1 is not None and v2 is not None:
                img_score: float | None = float(np.clip(np.dot(v1, v2), 0.0, 1.0))
                total_w = w_img + w_txt + w_geo + w_time
                combined = (w_img * img_score + w_txt * text_score + w_geo * geo_score + w_time * time_score) / max(
                    total_w, 1e-6
                )
            else:
                img_score = None
                total_w = w_txt + w_geo + w_time
                combined = (w_txt * text_score + w_geo * geo_score + w_time * time_score) / max(total_w, 1e-6)

            if combined >= cutoff:
                matches.append(
                    DuplicateCandidateMatch(
                        primary_complaint_id=c1.id,
                        related_complaint_id=c2.id,
                        similarity_score=round(combined, 4),
                        image_similarity=round(img_score, 4) if img_score is not None else None,
                        text_similarity=round(text_score, 4),
                        distance_meters=round(dist_m, 2),
                        time_diff_hours=round(time_hours, 2),
                        text_backend=text_backend,
                        image_backend=image_backend,
                    )
                )

    persisted: list[DuplicateGroup] = []
    for m in matches:
        existing = db.execute(
            select(DuplicateGroup).where(
                DuplicateGroup.primary_complaint_id == m.primary_complaint_id,
                DuplicateGroup.related_complaint_id == m.related_complaint_id,
            )
        ).scalar_one_or_none()

        if existing is None:
            group = DuplicateGroup(
                primary_complaint_id=m.primary_complaint_id,
                related_complaint_id=m.related_complaint_id,
                similarity_score=m.similarity_score,
                image_similarity=m.image_similarity,
                text_similarity=m.text_similarity,
                distance_meters=m.distance_meters,
                time_diff_hours=m.time_diff_hours,
                review_status=DuplicateReviewStatus.PENDING,
            )
            db.add(group)
            persisted.append(group)
        else:
            existing.similarity_score = m.similarity_score
            existing.image_similarity = m.image_similarity
            existing.text_similarity = m.text_similarity
            existing.distance_meters = m.distance_meters
            existing.time_diff_hours = m.time_diff_hours
            persisted.append(existing)

    db.commit()
    for grp in persisted:
        db.refresh(grp)

    return persisted, {"text_backend": text_backend, "image_backend": image_backend}

