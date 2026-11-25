"""Dataset preparation & validation utility for YOLO urban infrastructure damage detection.

Prepares YOLO-format train/val/test splits for the 5 core damage classes:
0: Pothole
1: Longitudinal crack
2: Transverse crack
3: Alligator crack
4: Other road damage
"""

from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

CLASSES = [
    "Pothole",
    "Longitudinal crack",
    "Transverse crack",
    "Alligator crack",
    "Other road damage",
]


def prepare_yolo_dataset(
    source_images_dir: Path,
    source_labels_dir: Path,
    output_dir: Path,
    *,
    train_ratio: float = 0.7,
    val_ratio: float = 0.2,
    seed: int = 42,
) -> dict[str, int]:
    if not source_images_dir.is_dir():
        raise FileNotFoundError(f"Source images directory not found: {source_images_dir}")

    image_files = sorted(
        [
            p
            for p in source_images_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ]
    )
    if not image_files:
        raise ValueError(f"No JPG/PNG images found in {source_images_dir}")

    rng = random.Random(seed)
    rng.shuffle(image_files)

    n = len(image_files)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    splits = {
        "train": image_files[:n_train],
        "val": image_files[n_train : n_train + n_val],
        "test": image_files[n_train + n_val :],
    }

    counts: dict[str, int] = {}
    for split_name, files in splits.items():
        img_out = output_dir / "images" / split_name
        lbl_out = output_dir / "labels" / split_name
        img_out.mkdir(parents=True, exist_ok=True)
        lbl_out.mkdir(parents=True, exist_ok=True)

        copied = 0
        for img_path in files:
            shutil.copy2(img_path, img_out / img_path.name)
            label_path = source_labels_dir / f"{img_path.stem}.txt"
            if label_path.is_file():
                shutil.copy2(label_path, lbl_out / label_path.name)
            else:
                (lbl_out / f"{img_path.stem}.txt").write_text("", encoding="utf-8")
            copied += 1
        counts[split_name] = copied

    yaml_lines = [
        f"path: {output_dir.resolve()}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "",
        "names:",
    ]
    for idx, cls_name in enumerate(CLASSES):
        yaml_lines.append(f"  {idx}: {cls_name}")
    (output_dir / "dataset.yaml").write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare YOLO split & dataset.yaml for LIFE SIGNAL.")
    parser.add_argument("--images", required=True, type=Path, help="Folder of source images")
    parser.add_argument("--labels", required=True, type=Path, help="Folder of YOLO .txt annotation files")
    parser.add_argument("--out", required=True, type=Path, help="Output YOLO dataset directory")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    counts = prepare_yolo_dataset(args.images, args.labels, args.out, seed=args.seed)
    print("Dataset prepared:", counts)


if __name__ == "__main__":
    main()

