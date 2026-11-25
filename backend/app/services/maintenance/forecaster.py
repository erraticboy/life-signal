"""Historical infrastructure analytics and honest ML predictive maintenance forecasting."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint, ComplaintStatus

MIN_COMPLAINTS_FOR_FORECAST = 10
MIN_PERIODS_FOR_FORECAST = 4


@dataclass(frozen=True)
class MaintenanceAnalyticsOutput:
    # Actual historical statistics (never fabricated)
    total_complaints: int
    category_distribution: list[dict[str, Any]]
    status_distribution: list[dict[str, Any]]
    priority_distribution: list[dict[str, Any]]
    recurring_locations: list[dict[str, Any]]
    historical_weekly_series: list[dict[str, Any]]
    avg_resolution_hours: float | None

    # Conditional ML forecast (only produced when sufficient history exists)
    forecast_available: bool
    forecast_detail: str
    model_name: str | None
    cv_mae: float | None
    cv_rmse: float | None
    forecast_horizon_weeks: list[dict[str, Any]]


def _week_bucket_start(dt: datetime) -> datetime:
    utc_dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    monday = utc_dt - timedelta(days=utc_dt.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _train_and_forecast_weekly(
    weekly_counts: list[tuple[datetime, int]],
    horizon: int = 4,
) -> tuple[str, float | None, float | None, list[dict[str, Any]]]:
    """
    Train RandomForestRegressor (or XGBRegressor when available) on real weekly
    complaint counts using lag & seasonal features, evaluate via TimeSeriesSplit,
    and forecast the next `horizon` weeks deterministically.
    """
    counts = [float(c) for _, c in weekly_counts]
    dates = [d for d, _ in weekly_counts]

    X_rows: list[list[float]] = []
    y_vals: list[float] = []
    for idx in range(2, len(counts)):
        week_of_year = dates[idx].isocalendar().week
        lag1 = counts[idx - 1]
        lag2 = counts[idx - 2]
        rolling3 = float(np.mean(counts[max(0, idx - 3) : idx]))
        sin_w = math.sin(2.0 * math.pi * week_of_year / 52.0)
        cos_w = math.cos(2.0 * math.pi * week_of_year / 52.0)
        X_rows.append([float(idx), lag1, lag2, rolling3, sin_w, cos_w])
        y_vals.append(counts[idx])

    X = np.array(X_rows, dtype=np.float64)
    y = np.array(y_vals, dtype=np.float64)

    def _make_regressor():
        try:
            from xgboost import XGBRegressor

            return (
                XGBRegressor(
                    n_estimators=80,
                    max_depth=3,
                    learning_rate=0.08,
                    random_state=42,
                    verbosity=0,
                ),
                "XGBoost Regressor",
            )
        except ImportError:
            return (
                RandomForestRegressor(n_estimators=120, max_depth=5, random_state=42),
                "Random Forest Regressor",
            )

    cv_mae: float | None = None
    cv_rmse: float | None = None
    if len(y) >= 4:
        n_splits = min(3, len(y) - 1)
        tscv = TimeSeriesSplit(n_splits=n_splits)
        preds_all: list[float] = []
        actual_all: list[float] = []
        for train_idx, test_idx in tscv.split(X):
            reg, _ = _make_regressor()
            reg.fit(X[train_idx], y[train_idx])
            p = reg.predict(X[test_idx])
            preds_all.extend(p.tolist())
            actual_all.extend(y[test_idx].tolist())
        cv_mae = round(float(mean_absolute_error(actual_all, preds_all)), 3)
        cv_rmse = round(float(root_mean_squared_error(actual_all, preds_all)), 3)

    final_model, model_name = _make_regressor()
    final_model.fit(X, y)

    # Autoregressive multi-step forecast
    history_buf = list(counts)
    last_date = dates[-1]
    forecasts: list[dict[str, Any]] = []
    for step in range(1, horizon + 1):
        target_date = last_date + timedelta(weeks=step)
        idx = len(history_buf)
        week_of_year = target_date.isocalendar().week
        lag1 = history_buf[-1]
        lag2 = history_buf[-2]
        rolling3 = float(np.mean(history_buf[-3:]))
        sin_w = math.sin(2.0 * math.pi * week_of_year / 52.0)
        cos_w = math.cos(2.0 * math.pi * week_of_year / 52.0)

        x_next = np.array([[float(idx), lag1, lag2, rolling3, sin_w, cos_w]], dtype=np.float64)
        pred = max(0.0, float(final_model.predict(x_next)[0]))
        history_buf.append(pred)
        forecasts.append(
            {
                "period_start": target_date.date().isoformat(),
                "predicted_complaints": round(pred, 2),
                "is_forecast": True,
            }
        )

    return model_name, cv_mae, cv_rmse, forecasts


def compute_maintenance_analytics(db: Session) -> MaintenanceAnalyticsOutput:
    """
    Compute actual historical statistics from PostgreSQL complaints and train
    the demand forecaster ONLY when sufficient historical periods exist.
    """
    complaints = db.execute(select(Complaint).order_by(Complaint.reported_at.asc())).scalars().all()
    total = len(complaints)

    cat_counts = Counter(c.category.value for c in complaints)
    status_counts = Counter(c.status.value for c in complaints)
    prio_counts = Counter(c.priority_level.value if c.priority_level else "unscored" for c in complaints)

    category_distribution = [
        {"category": k.replace("_", " ").title(), "raw_category": k, "count": v}
        for k, v in cat_counts.most_common()
    ]
    status_distribution = [
        {"status": k.replace("_", " ").title(), "raw_status": k, "count": v}
        for k, v in status_counts.most_common()
    ]
    priority_distribution = [
        {"priority": k.title(), "count": v} for k, v in prio_counts.most_common()
    ]

    # Recurring spatial/address locations (>= 2 reports)
    addr_groups: dict[str, list[Complaint]] = defaultdict(list)
    for c in complaints:
        addr_groups[c.address.strip().lower()].append(c)

    recurring_locations = []
    for norm_addr, group in sorted(addr_groups.items(), key=lambda kv: len(kv[1]), reverse=True):
        if len(group) < 2:
            continue
        top_cat = Counter(g.category.value for g in group).most_common(1)[0][0]
        recurring_locations.append(
            {
                "address": group[0].address,
                "report_count": len(group),
                "dominant_category": top_cat.replace("_", " ").title(),
                "latest_reported_at": max(g.reported_at for g in group).isoformat(),
            }
        )

    # Average resolution time for genuinely resolved complaints
    resolution_hours: list[float] = []
    for c in complaints:
        if c.status == ComplaintStatus.RESOLVED:
            rep = c.reported_at.replace(tzinfo=timezone.utc) if c.reported_at.tzinfo is None else c.reported_at
            upd = c.updated_at.replace(tzinfo=timezone.utc) if c.updated_at.tzinfo is None else c.updated_at
            diff_h = max(0.0, (upd - rep).total_seconds() / 3600.0)
            resolution_hours.append(diff_h)
    avg_res_h = round(float(np.mean(resolution_hours)), 2) if resolution_hours else None

    # Build chronological contiguous weekly series from first to last report
    weekly_series_items: list[dict[str, Any]] = []
    weekly_tuples: list[tuple[datetime, int]] = []
    if complaints:
        bucket_counts: Counter[datetime] = Counter(_week_bucket_start(c.reported_at) for c in complaints)
        first_week = min(bucket_counts.keys())
        last_week = max(bucket_counts.keys())
        cursor = first_week
        while cursor <= last_week:
            cnt = int(bucket_counts.get(cursor, 0))
            weekly_tuples.append((cursor, cnt))
            weekly_series_items.append(
                {
                    "period_start": cursor.date().isoformat(),
                    "actual_complaints": cnt,
                    "is_forecast": False,
                }
            )
            cursor += timedelta(weeks=1)

    distinct_active_weeks = sum(1 for _, c in weekly_tuples if c > 0)
    if total < MIN_COMPLAINTS_FOR_FORECAST or len(weekly_tuples) < MIN_PERIODS_FOR_FORECAST or distinct_active_weeks < 3:
        return MaintenanceAnalyticsOutput(
            total_complaints=total,
            category_distribution=category_distribution,
            status_distribution=status_distribution,
            priority_distribution=priority_distribution,
            recurring_locations=recurring_locations[:10],
            historical_weekly_series=weekly_series_items,
            avg_resolution_hours=avg_res_h,
            forecast_available=False,
            forecast_detail=(
                f"Insufficient historical data for ML demand forecasting ({total} complaint(s) across "
                f"{distinct_active_weeks} active week(s)). At least {MIN_COMPLAINTS_FOR_FORECAST} complaints "
                f"spanning {MIN_PERIODS_FOR_FORECAST}+ weekly periods are required so forecasts are never fabricated."
            ),
            model_name=None,
            cv_mae=None,
            cv_rmse=None,
            forecast_horizon_weeks=[],
        )

    model_name, cv_mae, cv_rmse, forecasts = _train_and_forecast_weekly(weekly_tuples, horizon=4)
    return MaintenanceAnalyticsOutput(
        total_complaints=total,
        category_distribution=category_distribution,
        status_distribution=status_distribution,
        priority_distribution=priority_distribution,
        recurring_locations=recurring_locations[:10],
        historical_weekly_series=weekly_series_items,
        avg_resolution_hours=avg_res_h,
        forecast_available=True,
        forecast_detail=(
            f"Trained {model_name} on {len(weekly_tuples)} historical weekly periods "
            "(autoregressive lags + seasonal encoding)."
        ),
        model_name=model_name,
        cv_mae=cv_mae,
        cv_rmse=cv_rmse,
        forecast_horizon_weeks=forecasts,
    )

