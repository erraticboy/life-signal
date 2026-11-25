"""Train and export a YOLOv8 infrastructure damage detector for LIFE SIGNAL.

Requires `pip install -r backend/requirements-ml.txt` (torch + ultralytics).
Outputs trained weights to `backend/weights/infrastructure_yolo.pt`.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def train_and_export(
    data_yaml: Path,
    *,
    base_weights: str = "yolov8n.pt",
    epochs: int = 50,
    imgsz: int = 640,
    batch: int = 16,
    export_path: Path = Path("../backend/weights/infrastructure_yolo.pt"),
) -> Path:
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError(
            "ultralytics is not installed. Run `pip install -r backend/requirements-ml.txt` first."
        ) from exc

    if not data_yaml.is_file():
        raise FileNotFoundError(f"dataset.yaml not found at {data_yaml}")

    model = YOLO(base_weights)
    results = model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project="runs/life_signal",
        name="infrastructure_yolo",
        exist_ok=True,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    if not best_weights.is_file():
        raise FileNotFoundError(f"Expected trained best.pt not found at {best_weights}")

    export_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_weights, export_path)
    print(f"Exported best weights to {export_path.resolve()}")
    return export_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train LIFE SIGNAL YOLOv8 damage detector.")
    parser.add_argument("--data", required=True, type=Path, help="Path to dataset.yaml")
    parser.add_argument("--weights", default="yolov8n.pt", help="Pretrained YOLO backbone")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--export", type=Path, default=Path("../backend/weights/infrastructure_yolo.pt"))
    args = parser.parse_args()

    train_and_export(
        args.data,
        base_weights=args.weights,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        export_path=args.export,
    )


if __name__ == "__main__":
    main()

