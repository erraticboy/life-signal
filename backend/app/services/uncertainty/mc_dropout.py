"""MC Dropout, deep ensemble predictive entropy, and verification policy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.config import get_settings
from app.services.uncertainty.temperature_scaling import calibrate_scalar_confidence


@dataclass(frozen=True)
class UncertaintyEstimate:
    raw_confidence: float
    calibrated_confidence: float
    uncertainty_score: float
    predictive_entropy: float
    epistemic_uncertainty: float
    requires_human_verification: bool
    verification_reasons: list[str]


def enable_mc_dropout_layers(model: Any) -> int:
    """
    Activate Dropout layers during PyTorch inference for Monte Carlo sampling
    while keeping BatchNorm layers in eval() mode.
    """
    enabled_count = 0
    for module in model.modules():
        cls_name = type(module).__name__.lower()
        if "dropout" in cls_name:
            module.train()
            enabled_count += 1
    return enabled_count


def compute_mc_uncertainty_from_samples(prob_samples: np.ndarray) -> dict[str, float]:
    """
    Compute predictive mean, normalized predictive entropy, and BALD epistemic
    uncertainty from shape (T, C) stochastic probability samples (MC Dropout or Ensemble).
    """
    samples = np.clip(np.asarray(prob_samples, dtype=np.float64), 1e-12, 1.0)
    if samples.ndim != 2 or samples.shape[0] < 1 or samples.shape[1] < 2:
        raise ValueError("prob_samples must have shape (T >= 1, C >= 2).")

    samples = samples / np.sum(samples, axis=1, keepdims=True)
    mean_probs = np.mean(samples, axis=0)
    num_classes = samples.shape[1]
    max_entropy = float(np.log(num_classes))

    predictive_entropy = float(-np.sum(mean_probs * np.log(mean_probs)))
    expected_entropy = float(-np.mean(np.sum(samples * np.log(samples), axis=1)))
    epistemic_mi = max(0.0, predictive_entropy - expected_entropy)

    norm_entropy = float(np.clip(predictive_entropy / max_entropy, 0.0, 1.0))
    norm_epistemic = float(np.clip(epistemic_mi / max_entropy, 0.0, 1.0))
    top_confidence = float(np.max(mean_probs))
    top_class_idx = int(np.argmax(mean_probs))

    return {
        "top_class_idx": top_class_idx,
        "raw_confidence": round(top_confidence, 4),
        "predictive_entropy": round(norm_entropy, 4),
        "epistemic_uncertainty": round(norm_epistemic, 4),
        "uncertainty_score": round(float(np.clip(0.65 * norm_entropy + 0.35 * norm_epistemic, 0.0, 1.0)), 4),
    }


def assess_prediction_uncertainty(
    *,
    raw_confidence: float,
    prob_samples: np.ndarray | None = None,
    is_demo_mode: bool = False,
) -> UncertaintyEstimate:
    """
    Separate raw confidence from calibrated confidence and uncertainty estimates,
    and determine whether human verification is mandatory.
    """
    settings = get_settings()
    clamped_raw = round(float(np.clip(raw_confidence, 0.0, 1.0)), 4)

    if prob_samples is not None and prob_samples.shape[0] >= 2:
        mc_stats = compute_mc_uncertainty_from_samples(prob_samples)
        predictive_entropy = mc_stats["predictive_entropy"]
        epistemic_uncertainty = mc_stats["epistemic_uncertainty"]
        uncertainty_score = mc_stats["uncertainty_score"]
    else:
        # Binary Shannon entropy approximation from single-pass confidence
        p = float(np.clip(clamped_raw, 1e-6, 1.0 - 1e-6))
        binary_entropy = float(-(p * np.log2(p) + (1.0 - p) * np.log2(1.0 - p)))
        predictive_entropy = round(float(np.clip(binary_entropy, 0.0, 1.0)), 4)
        epistemic_uncertainty = 0.0
        uncertainty_score = round(float(np.clip(0.5 * predictive_entropy + 0.5 * (1.0 - clamped_raw), 0.0, 1.0)), 4)

    calibrated_confidence = calibrate_scalar_confidence(
        clamped_raw,
        temperature=settings.AI_TEMPERATURE_SCALE,
    )

    reasons: list[str] = []
    if is_demo_mode:
        reasons.append("Prediction generated in OpenCV demo fallback mode (not trained YOLO weights).")
    if uncertainty_score >= settings.AI_UNCERTAINTY_THRESHOLD:
        reasons.append(
            f"Uncertainty score ({uncertainty_score:.2f}) exceeds verification threshold ({settings.AI_UNCERTAINTY_THRESHOLD:.2f})."
        )
    if calibrated_confidence < settings.AI_CONFIDENCE_THRESHOLD:
        reasons.append(
            f"Calibrated confidence ({calibrated_confidence:.2f}) is below threshold ({settings.AI_CONFIDENCE_THRESHOLD:.2f})."
        )

    return UncertaintyEstimate(
        raw_confidence=clamped_raw,
        calibrated_confidence=calibrated_confidence,
        uncertainty_score=uncertainty_score,
        predictive_entropy=predictive_entropy,
        epistemic_uncertainty=epistemic_uncertainty,
        requires_human_verification=len(reasons) > 0,
        verification_reasons=reasons,
    )

