"""Post-hoc Temperature Scaling for probability confidence calibration."""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize_scalar


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exp_vals = np.exp(shifted)
    return exp_vals / np.sum(exp_vals, axis=-1, keepdims=True)


def apply_temperature_scaling(logits: np.ndarray, temperature: float) -> np.ndarray:
    """Scale model logits by temperature T > 0 and return calibrated probabilities."""
    safe_temp = max(float(temperature), 1e-3)
    return _softmax(np.asarray(logits, dtype=np.float64) / safe_temp)


def fit_temperature(validation_logits: np.ndarray, validation_labels: np.ndarray) -> float:
    """
    Find optimal scalar temperature T minimizing Negative Log-Likelihood (NLL)
    on held-out validation logits.
    """
    logits = np.asarray(validation_logits, dtype=np.float64)
    labels = np.asarray(validation_labels, dtype=np.int64)
    if logits.ndim != 2 or labels.ndim != 1 or logits.shape[0] != labels.shape[0]:
        raise ValueError("Expected logits of shape (N, C) and labels of shape (N,).")

    def nll_loss(temp: float) -> float:
        probs = apply_temperature_scaling(logits, temp)
        chosen = np.clip(probs[np.arange(labels.size), labels], 1e-12, 1.0)
        return float(-np.mean(np.log(chosen)))

    res = minimize_scalar(nll_loss, bounds=(0.1, 10.0), method="bounded")
    return round(float(res.x), 4)


def calibrate_scalar_confidence(raw_confidence: float, temperature: float = 1.25) -> float:
    """
    Apply logit-space temperature scaling to a binary/top-1 confidence score.
    T > 1.0 tempers overconfident neural detections toward calibrated probabilities.
    """
    p = float(np.clip(raw_confidence, 1e-4, 1.0 - 1e-4))
    logit = np.log(p / (1.0 - p))
    safe_temp = max(float(temperature), 1e-3)
    calibrated = 1.0 / (1.0 + np.exp(-logit / safe_temp))
    return round(float(np.clip(calibrated, 0.0, 1.0)), 4)

