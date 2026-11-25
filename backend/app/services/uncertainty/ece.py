"""Expected Calibration Error (ECE), MCE, Brier score, and reliability diagram binning."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class ReliabilityBin:
    bin_index: int
    bin_lower: float
    bin_upper: float
    count: int
    avg_confidence: float
    accuracy: float
    gap: float


@dataclass(frozen=True)
class CalibrationReport:
    ece: float
    mce: float
    brier_score: float
    sample_count: int
    bins: list[ReliabilityBin]


def compute_calibration_metrics(
    confidences: list[float] | np.ndarray,
    correct_flags: list[int | bool] | np.ndarray,
    *,
    n_bins: int = 10,
) -> CalibrationReport:
    """
    Compute Expected Calibration Error (ECE), Maximum Calibration Error (MCE),
    Brier score, and per-bin reliability metrics (Guo et al., 2017).
    """
    conf_arr = np.clip(np.asarray(confidences, dtype=np.float64), 0.0, 1.0)
    corr_arr = np.asarray(correct_flags, dtype=np.float64)

    if conf_arr.shape != corr_arr.shape:
        raise ValueError("confidences and correct_flags must have matching shapes.")
    if conf_arr.size == 0:
        raise ValueError("Cannot compute calibration metrics on an empty array.")

    n = conf_arr.size
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    mce = 0.0
    bins: list[ReliabilityBin] = []

    for idx in range(n_bins):
        low = float(bin_edges[idx])
        high = float(bin_edges[idx + 1])
        if idx == 0:
            mask = (conf_arr >= low) & (conf_arr <= high)
        else:
            mask = (conf_arr > low) & (conf_arr <= high)

        count = int(np.sum(mask))
        if count > 0:
            avg_conf = float(np.mean(conf_arr[mask]))
            acc = float(np.mean(corr_arr[mask]))
            gap = abs(acc - avg_conf)
            ece += (count / n) * gap
            mce = max(mce, gap)
        else:
            avg_conf = 0.0
            acc = 0.0
            gap = 0.0

        bins.append(
            ReliabilityBin(
                bin_index=idx,
                bin_lower=round(low, 4),
                bin_upper=round(high, 4),
                count=count,
                avg_confidence=round(avg_conf, 6),
                accuracy=round(acc, 6),
                gap=round(gap, 6),
            )
        )

    brier = float(np.mean((conf_arr - corr_arr) ** 2))
    return CalibrationReport(
        ece=round(float(ece), 6),
        mce=round(float(mce), 6),
        brier_score=round(brier, 6),
        sample_count=int(n),
        bins=bins,
    )

