"""Research evaluation script for Multimodal Duplicate Detection threshold & weight tuning."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.duplicates.detector import compute_text_similarity_matrix, haversine_meters


def evaluate_pairs(records: list[dict], threshold: float = 0.55) -> dict:
    texts = [r["text"] for r in records]
    text_sims, backend = compute_text_similarity_matrix(texts)
    tp = fp = fn = tn = 0

    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            r1, r2 = records[i], records[j]
            dist_m = haversine_meters(r1["lat"], r1["lon"], r2["lat"], r2["lon"])
            geo_score = math.exp(-dist_m / 120.0) if dist_m <= 1000.0 else 0.0
            time_h = abs(r1["hour"] - r2["hour"])
            time_score = math.exp(-time_h / 72.0)
            txt_score = float(text_sims[i, j])

            score = 0.40 * txt_score + 0.45 * geo_score + 0.15 * time_score
            pred_dup = score >= threshold
            true_dup = r1["cluster_id"] == r2["cluster_id"]

            if pred_dup and true_dup:
                tp += 1
            elif pred_dup and not true_dup:
                fp += 1
            elif not pred_dup and true_dup:
                fn += 1
            else:
                tn += 1

    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = (2 * precision * recall) / max(precision + recall, 1e-9)
    return {
        "text_backend": backend,
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate multimodal duplicate scoring.")
    parser.add_argument("--dataset-json", type=Path, help="JSON list with lat, lon, hour, text, cluster_id")
    parser.add_argument("--threshold", type=float, default=0.55)
    args = parser.parse_args()

    if args.dataset_json:
        records = json.loads(args.dataset_json.read_text(encoding="utf-8"))
    else:
        records = [
            {"lat": 28.61390, "lon": 77.20900, "hour": 10.0, "text": "Large pothole near college north gate", "cluster_id": 1},
            {"lat": 28.61395, "lon": 77.20904, "hour": 12.0, "text": "Deep road pothole outside college north entrance gate", "cluster_id": 1},
            {"lat": 28.62500, "lon": 77.22500, "hour": 14.0, "text": "Broken streetlight near metro parking lot", "cluster_id": 2},
            {"lat": 28.62502, "lon": 77.22503, "hour": 16.0, "text": "Streetlight not working at metro parking entrance", "cluster_id": 2},
        ]

    print(json.dumps(evaluate_pairs(records, threshold=args.threshold), indent=2))


if __name__ == "__main__":
    main()

