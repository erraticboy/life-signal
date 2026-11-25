"""Research benchmark script for Predictive Maintenance Demand Forecasting.

Compares RandomForestRegressor vs GradientBoostingRegressor / XGBRegressor using
TimeSeriesSplit cross-validation on real exported complaint history CSV or a
controlled seasonal benchmark (--benchmark-synthetic).
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import TimeSeriesSplit


def _build_features(counts: list[float], dates: list[datetime]) -> tuple[np.ndarray, np.ndarray]:
    X_rows, y_vals = [], []
    for idx in range(2, len(counts)):
        woy = dates[idx].isocalendar().week
        X_rows.append(
            [
                float(idx),
                counts[idx - 1],
                counts[idx - 2],
                float(np.mean(counts[max(0, idx - 3) : idx])),
                math.sin(2.0 * math.pi * woy / 52.0),
                math.cos(2.0 * math.pi * woy / 52.0),
            ]
        )
        y_vals.append(counts[idx])
    return np.array(X_rows, dtype=np.float64), np.array(y_vals, dtype=np.float64)


def evaluate_models(counts: list[float], dates: list[datetime]) -> dict:
    X, y = _build_features(counts, dates)
    tscv = TimeSeriesSplit(n_splits=min(4, max(2, len(y) // 6)))

    candidates = {
        "RandomForestRegressor": lambda: RandomForestRegressor(n_estimators=150, max_depth=6, random_state=42),
        "GradientBoostingRegressor": lambda: GradientBoostingRegressor(n_estimators=120, max_depth=3, random_state=42),
    }
    try:
        from xgboost import XGBRegressor

        candidates["XGBRegressor"] = lambda: XGBRegressor(
            n_estimators=100, max_depth=3, learning_rate=0.08, random_state=42, verbosity=0
        )
    except ImportError:
        pass

    results: dict[str, dict[str, float]] = {}
    for name, builder in candidates.items():
        preds, actuals = [], []
        for tr, te in tscv.split(X):
            model = builder()
            model.fit(X[tr], y[tr])
            preds.extend(model.predict(X[te]).tolist())
            actuals.extend(y[te].tolist())
        results[name] = {
            "cv_mae": round(float(mean_absolute_error(actuals, preds)), 4),
            "cv_rmse": round(float(root_mean_squared_error(actuals, preds)), 4),
        }

    return {"periods": len(counts), "models": results}


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Predictive Maintenance ML models.")
    parser.add_argument("--csv", type=Path, help="Exported complaints CSV with 'reported_at' column")
    parser.add_argument("--benchmark-synthetic", action="store_true")
    args = parser.parse_args()

    if args.csv:
        buckets: Counter[datetime] = Counter()
        with args.csv.open("r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                dt = datetime.fromisoformat(row["reported_at"])
                monday = (dt - timedelta(days=dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
                buckets[monday] += 1
        dates = sorted(buckets.keys())
        counts = [float(buckets[d]) for d in dates]
    elif args.benchmark_synthetic:
        rng = np.random.default_rng(42)
        start = datetime(2025, 1, 6, tzinfo=timezone.utc)
        dates = [start + timedelta(weeks=i) for i in range(40)]
        counts = [
            max(1.0, round(12.0 + 5.0 * math.sin(2.0 * math.pi * i / 26.0) + 0.15 * i + rng.normal(0, 1.5), 1))
            for i in range(40)
        ]
    else:
        raise SystemExit("Provide --csv PATH or --benchmark-synthetic.")

    print(json.dumps(evaluate_models(counts, dates), indent=2))


if __name__ == "__main__":
    main()

