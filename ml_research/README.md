# LIFE SIGNAL — ML & Research Workspace

Standalone training, calibration, and evaluation scripts for Phases 3–5.

## Scripts

- **`prepare_dataset.py`**: Splits annotated JPG/PNG images and YOLO `.txt` labels into `train/val/test` and writes `dataset.yaml` for the 5 damage classes (`Pothole`, `Longitudinal crack`, `Transverse crack`, `Alligator crack`, `Other road damage`).
- **`train_yolo.py`**: Fine-tunes Ultralytics YOLOv8 (`pip install -r ../backend/requirements-ml.txt`) and exports weights to `backend/weights/infrastructure_yolo.pt`.
- **`evaluate_uncertainty.py`**: Computes pre- and post-Temperature-Scaling Expected Calibration Error (ECE), MCE, Brier score, reliability bins, and MC Dropout epistemic uncertainty diagnostics (`python evaluate_uncertainty.py --benchmark-synthetic`).
- **`evaluate_duplicates.py`**: Evaluates precision, recall, and F1 across multimodal duplicate thresholds (`python evaluate_duplicates.py`).
- **`train_predictive_maintenance.py`**: Benchmarks Random Forest vs. Gradient Boosting / XGBoost demand forecasting with `TimeSeriesSplit` cross-validation (`python train_predictive_maintenance.py --benchmark-synthetic` or `--csv exported.csv`).
