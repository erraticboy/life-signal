"""Research experiment script for Uncertainty Calibration (ECE, Temperature Scaling, MC Dropout).

Loads validation logits & true labels from an .npz/.json file (or runs an explicit
controlled calibration benchmark when --benchmark-synthetic is passed) and outputs
pre- vs. post-temperature-scaling ECE, MCE, Brier score, and reliability bin metrics.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.uncertainty.ece import compute_calibration_metrics
from app.services.uncertainty.mc_dropout import compute_mc_uncertainty_from_samples
from app.services.uncertainty.temperature_scaling import apply_temperature_scaling, fit_temperature


def run_calibration_experiment(logits: np.ndarray, labels: np.ndarray) -> dict:
    raw_probs = apply_temperature_scaling(logits, temperature=1.0)
    raw_pred = np.argmax(raw_probs, axis=1)
    raw_conf = np.max(raw_probs, axis=1)
    correct = (raw_pred == labels).astype(int)

    before = compute_calibration_metrics(raw_conf, correct, n_bins=10)

    # Fit optimal temperature T on first half, evaluate on held-out second half
    mid = max(1, len(labels) // 2)
    opt_t = fit_temperature(logits[:mid], labels[:mid])

    cal_probs = apply_temperature_scaling(logits[mid:], temperature=opt_t)
    cal_pred = np.argmax(cal_probs, axis=1)
    cal_conf = np.max(cal_probs, axis=1)
    cal_correct = (cal_pred == labels[mid:]).astype(int)
    after = compute_calibration_metrics(cal_conf, cal_correct, n_bins=10)

    return {
        "optimal_temperature": opt_t,
        "before_calibration": {
            "ece": before.ece,
            "mce": before.mce,
            "brier_score": before.brier_score,
        },
        "after_temperature_scaling": {
            "ece": after.ece,
            "mce": after.mce,
            "brier_score": after.brier_score,
            "bins": [b.__dict__ for b in after.bins],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate ECE & Temperature Scaling calibration.")
    parser.add_argument("--logits-npz", type=Path, help="NPZ archive with 'logits' (N,C) and 'labels' (N,)")
    parser.add_argument(
        "--benchmark-synthetic",
        action="store_true",
        help="Run controlled overconfident logit benchmark for method validation",
    )
    parser.add_argument("--out", type=Path, help="Optional JSON output path")
    args = parser.parse_args()

    if args.logits_npz:
        data = np.load(args.logits_npz)
        logits, labels = data["logits"], data["labels"]
    elif args.benchmark_synthetic:
        rng = np.random.default_rng(42)
        labels = rng.integers(0, 5, size=500)
        logits = rng.normal(0.0, 1.5, size=(500, 5))
        # Simulate overconfident neural network logits (high temperature needed)
        logits[np.arange(500), labels] += 2.2
        logits *= 2.5
    else:
        raise SystemExit("Provide --logits-npz PATH or --benchmark-synthetic.")

    report = run_calibration_experiment(logits, labels)

    # Also verify MC Dropout uncertainty separation on an ambiguous vs. confident sample
    confident_mc = np.array([[0.90, 0.03, 0.03, 0.02, 0.02]] * 5)
    ambiguous_mc = np.array(
        [
            [0.55, 0.35, 0.05, 0.03, 0.02],
            [0.25, 0.60, 0.08, 0.04, 0.03],
            [0.45, 0.40, 0.08, 0.04, 0.03],
        ]
    )
    report["mc_dropout_diagnostics"] = {
        "confident_case": compute_mc_uncertainty_from_samples(confident_mc),
        "ambiguous_case": compute_mc_uncertainty_from_samples(ambiguous_mc),
    }

    output_str = json.dumps(report, indent=2)
    print(output_str)
    if args.out:
        args.out.write_text(output_str, encoding="utf-8")


if __name__ == "__main__":
    main()

