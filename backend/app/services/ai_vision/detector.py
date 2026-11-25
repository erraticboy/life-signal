"""Infrastructure damage detection module (Ultralytics YOLO + explicit OpenCV Demo Fallback)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.core.config import get_settings
from app.services.uncertainty.mc_dropout import assess_prediction_uncertainty

DAMAGE_CATEGORIES = [
    "Pothole",
    "Longitudinal crack",
    "Transverse crack",
    "Alligator crack",
    "Other road damage",
]

_YOLO_MODEL_CACHE: dict[str, Any] = {}


@dataclass(frozen=True)
class VisionAnalysisOutput:
    status: str  # "completed" | "model_unavailable"
    predicted_category: str | None
    raw_confidence: float | None
    calibrated_confidence: float | None
    uncertainty_score: float | None
    predictive_entropy: float | None
    epistemic_uncertainty: float | None
    requires_human_verification: bool
    verification_reasons: list[str]
    bounding_boxes: list[dict[str, Any]]
    is_demo_mode: bool
    model_version: str
    processing_time: float
    detail: str


def _load_yolo_model(weights_path: Path) -> Any | None:
    cache_key = str(weights_path)
    if cache_key in _YOLO_MODEL_CACHE:
        return _YOLO_MODEL_CACHE[cache_key]
    if not weights_path.is_file():
        return None
    try:
        from ultralytics import YOLO
    except ImportError:
        return None

    model = YOLO(str(weights_path))
    _YOLO_MODEL_CACHE[cache_key] = model
    return model


def _map_yolo_label(raw_label: str) -> str:
    norm = raw_label.strip().lower().replace("_", " ").replace("-", " ")
    if "pothole" in norm:
        return "Pothole"
    if "longitudinal" in norm:
        return "Longitudinal crack"
    if "transverse" in norm:
        return "Transverse crack"
    if "alligator" in norm:
        return "Alligator crack"
    return "Other road damage"


def _run_ultralytics_yolo(model: Any, image_path: Path, weights_name: str) -> VisionAnalysisOutput:
    t0 = time.perf_counter()
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError("Unable to decode complaint image file.")
    h, w = img.shape[:2]

    # Run primary inference plus horizontal-flip TTA pass to measure prediction consistency
    flipped = cv2.flip(img, 1)
    primary_results = model.predict(source=img, verbose=False)
    tta_results = model.predict(source=flipped, verbose=False)

    boxes_out: list[dict[str, Any]] = []
    class_scores_primary = np.full(len(DAMAGE_CATEGORIES), 0.02, dtype=np.float64)
    class_scores_tta = np.full(len(DAMAGE_CATEGORIES), 0.02, dtype=np.float64)

    names = getattr(model, "names", {})
    if primary_results and len(primary_results[0].boxes) > 0:
        for box in primary_results[0].boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            raw_name = str(names.get(cls_id, "Other road damage")) if isinstance(names, dict) else str(cls_id)
            mapped = _map_yolo_label(raw_name)
            idx = DAMAGE_CATEGORIES.index(mapped)
            class_scores_primary[idx] = max(class_scores_primary[idx], conf)
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            boxes_out.append(
                {
                    "label": mapped,
                    "confidence": round(conf, 4),
                    "x1": round(x1 / max(w, 1), 4),
                    "y1": round(y1 / max(h, 1), 4),
                    "x2": round(x2 / max(w, 1), 4),
                    "y2": round(y2 / max(h, 1), 4),
                }
            )

    if tta_results and len(tta_results[0].boxes) > 0:
        for box in tta_results[0].boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            raw_name = str(names.get(cls_id, "Other road damage")) if isinstance(names, dict) else str(cls_id)
            mapped = _map_yolo_label(raw_name)
            idx = DAMAGE_CATEGORIES.index(mapped)
            class_scores_tta[idx] = max(class_scores_tta[idx], conf)

    prob_samples = np.vstack([class_scores_primary, class_scores_tta])
    if boxes_out:
        top_box = max(boxes_out, key=lambda b: b["confidence"])
        predicted_category = top_box["label"]
        raw_conf = float(top_box["confidence"])
    else:
        predicted_category = "Other road damage"
        raw_conf = 0.25

    uncertainty = assess_prediction_uncertainty(
        raw_confidence=raw_conf,
        prob_samples=prob_samples,
        is_demo_mode=False,
    )
    elapsed = round(time.perf_counter() - t0, 4)

    return VisionAnalysisOutput(
        status="completed",
        predicted_category=predicted_category,
        raw_confidence=uncertainty.raw_confidence,
        calibrated_confidence=uncertainty.calibrated_confidence,
        uncertainty_score=uncertainty.uncertainty_score,
        predictive_entropy=uncertainty.predictive_entropy,
        epistemic_uncertainty=uncertainty.epistemic_uncertainty,
        requires_human_verification=uncertainty.requires_human_verification,
        verification_reasons=uncertainty.verification_reasons,
        bounding_boxes=boxes_out,
        is_demo_mode=False,
        model_version=f"yolo-{weights_name}",
        processing_time=elapsed,
        detail="Trained YOLO inference completed.",
    )


def _run_opencv_demo_heuristic(image_path: Path) -> VisionAnalysisOutput:
    """
    Deterministic OpenCV structural heuristic fallback used ONLY when ENABLE_AI_DEMO_FALLBACK=true
    and trained YOLO weights are unavailable. Explicitly flagged as is_demo_mode=True and
    always marks requires_human_verification=True.
    """
    t0 = time.perf_counter()
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError("Unable to decode complaint image file.")

    resized = cv2.resize(img, (320, 240))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 60, 160)
    edge_density = float(np.mean(edges > 0))

    sobel_x = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=3)
    grad_x = float(np.mean(np.abs(sobel_x)))
    grad_y = float(np.mean(np.abs(sobel_y)))

    # Locate prominent dark/high-contrast structural anomalies for demo bounding box visualization
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 7
    )
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = resized.shape[:2]
    candidate_boxes: list[dict[str, Any]] = []

    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:12]:
        area = cv2.contourArea(cnt)
        if area < (h * w * 0.015) or area > (h * w * 0.75):
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        aspect = bw / max(bh, 1)
        # Heuristic classification strictly for demo inspection
        if area > (h * w * 0.08) and 0.45 <= aspect <= 2.3:
            label = "Pothole"
        elif aspect > 2.3 and grad_y >= grad_x:
            label = "Transverse crack"
        elif aspect < 0.45 and grad_x > grad_y:
            label = "Longitudinal crack"
        elif edge_density > 0.14:
            label = "Alligator crack"
        else:
            label = "Other road damage"

        score = float(np.clip(0.38 + min(edge_density, 0.25) + min(area / (h * w), 0.25), 0.35, 0.78))
        candidate_boxes.append(
            {
                "label": label,
                "confidence": round(score, 4),
                "x1": round(x / w, 4),
                "y1": round(y / h, 4),
                "x2": round((x + bw) / w, 4),
                "y2": round((y + bh) / h, 4),
            }
        )
        if len(candidate_boxes) >= 3:
            break

    if candidate_boxes:
        predicted_category = candidate_boxes[0]["label"]
        raw_conf = float(candidate_boxes[0]["confidence"])
    else:
        if edge_density > 0.12:
            predicted_category = "Alligator crack"
            raw_conf = 0.52
        elif grad_x > grad_y * 1.15:
            predicted_category = "Longitudinal crack"
            raw_conf = 0.49
        elif grad_y > grad_x * 1.15:
            predicted_category = "Transverse crack"
            raw_conf = 0.49
        else:
            predicted_category = "Other road damage"
            raw_conf = 0.44

    # Construct conservative multi-class distribution for uncertainty estimation
    class_probs = np.full((3, len(DAMAGE_CATEGORIES)), 0.08, dtype=np.float64)
    idx = DAMAGE_CATEGORIES.index(predicted_category)
    class_probs[0, idx] = raw_conf
    class_probs[1, idx] = max(0.25, raw_conf - 0.08)
    class_probs[2, idx] = min(0.85, raw_conf + 0.05)

    uncertainty = assess_prediction_uncertainty(
        raw_confidence=raw_conf,
        prob_samples=class_probs,
        is_demo_mode=True,
    )
    elapsed = round(time.perf_counter() - t0, 4)

    return VisionAnalysisOutput(
        status="completed",
        predicted_category=predicted_category,
        raw_confidence=uncertainty.raw_confidence,
        calibrated_confidence=uncertainty.calibrated_confidence,
        uncertainty_score=uncertainty.uncertainty_score,
        predictive_entropy=uncertainty.predictive_entropy,
        epistemic_uncertainty=uncertainty.epistemic_uncertainty,
        requires_human_verification=True,
        verification_reasons=uncertainty.verification_reasons,
        bounding_boxes=candidate_boxes,
        is_demo_mode=True,
        model_version="opencv-demo-heuristic-v1",
        processing_time=elapsed,
        detail=(
            "DEMO MODE: Trained YOLO weights are not configured; OpenCV structural heuristic ran for "
            "evaluation only. Do not treat as trained model inference."
        ),
    )


def analyze_infrastructure_image(image_path: Path) -> VisionAnalysisOutput:
    """
    Analyze an infrastructure photograph using trained YOLO weights if available,
    or fall back ONLY if ENABLE_AI_DEMO_FALLBACK=true (never disguising demo output as real AI).
    """
    settings = get_settings()
    weights_path = settings.resolved_yolo_model_path
    yolo_model = _load_yolo_model(weights_path)
    if yolo_model is not None:
        return _run_ultralytics_yolo(yolo_model, image_path, weights_path.name)

    if settings.ENABLE_AI_DEMO_FALLBACK:
        return _run_opencv_demo_heuristic(image_path)

    return VisionAnalysisOutput(
        status="model_unavailable",
        predicted_category=None,
        raw_confidence=None,
        calibrated_confidence=None,
        uncertainty_score=None,
        predictive_entropy=None,
        epistemic_uncertainty=None,
        requires_human_verification=True,
        verification_reasons=[
            f"Trained YOLO model weights not found at '{weights_path}' or ultralytics is not installed."
        ],
        bounding_boxes=[],
        is_demo_mode=False,
        model_version="unconfigured",
        processing_time=0.0,
        detail=(
            "Trained YOLO model unavailable. Train/place weights at YOLO_MODEL_PATH (see ml_research/train_yolo.py) "
            "or set ENABLE_AI_DEMO_FALLBACK=true for clearly labeled OpenCV demo inspection."
        ),
    )

