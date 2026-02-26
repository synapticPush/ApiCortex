import os
from datetime import datetime

import numpy as np
import pandas as pd

NUM_DAYS = 180
NUM_ROWS = NUM_DAYS * 24 * 60
START_TIME = "2024-01-01 00:00:00"
SEED = 42


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _calibrate_bias(logits: np.ndarray, target_rate: float) -> float:
    lo, hi = -10.0, 10.0
    for _ in range(60):
        mid = (lo + hi) / 2.0
        rate = _sigmoid(logits + mid).mean()
        if rate > target_rate:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2.0


def _daily_weekly_traffic(timestamps: pd.DatetimeIndex) -> np.ndarray:
    n = len(timestamps)
    minute_of_day = timestamps.hour.to_numpy() * 60 + timestamps.minute.to_numpy()
    day_wave = np.sin(2 * np.pi * minute_of_day / 1440 - np.pi / 2)
    week_wave = np.sin(2 * np.pi * np.arange(n) / (7 * 1440))
    weekend_factor = np.where(timestamps.dayofweek >= 5, 0.88, 1.0)
    base = 950 + 380 * day_wave + 120 * week_wave
    noise = np.random.normal(0, 55, n)
    traffic = (base + noise) * weekend_factor
    traffic = np.clip(traffic, 120, None)
    spike_start = np.where(np.random.rand(n) < 0.0008)[0]
    for idx in spike_start:
        width = np.random.randint(2, 8)
        end = min(n, idx + width)
        traffic[idx:end] *= np.random.uniform(1.35, 2.2)
    return traffic


def _deploy_flags(n: int, timestamps: pd.DatetimeIndex) -> np.ndarray:
    deploy = np.zeros(n, dtype=np.int8)
    day_index = pd.Series(timestamps).dt.floor("D")
    for day in day_index.unique():
        idx = np.where(day_index.values == day)[0]
        count = np.random.randint(1, 3)
        starts = np.random.choice(idx, size=count, replace=False)
        for s in starts:
            duration = np.random.randint(5, 31)
            e = min(n, s + duration)
            deploy[s:e] = 1
    return deploy


def _schema_activity(n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    add = np.zeros(n, dtype=np.int16)
    rem = np.zeros(n, dtype=np.int16)
    breaking = np.zeros(n, dtype=np.int8)
    entropy = np.zeros(n, dtype=np.float64)
    normal_change_starts = np.where(np.random.rand(n) < 0.0025)[0]
    for s in normal_change_starts:
        width = np.random.randint(1, 6)
        e = min(n, s + width)
        add[s:e] += np.random.choice([1, 2], p=[0.8, 0.2])
        if np.random.rand() < 0.25:
            rem[s:e] += 1
        entropy[s:e] += np.random.uniform(0.03, 0.2)
    breaking_starts = np.where(np.random.rand(n) < 0.00012)[0]
    for s in breaking_starts:
        width = np.random.randint(4, 18)
        e = min(n, s + width)
        breaking[s:e] = 1
        add[s:e] += np.random.randint(1, 4)
        rem[s:e] += np.random.randint(1, 3)
        entropy[s:e] += np.random.uniform(0.5, 1.8)
    return add, rem, breaking, entropy


def _enforce_quantiles(df: pd.DataFrame) -> None:
    df["p90_latency"] = np.maximum(df["p90_latency"], df["p50_latency"] * 1.15)
    df["p95_latency"] = np.maximum(df["p95_latency"], df["p90_latency"] * 1.18)


def generate_observability_data(num_rows: int = NUM_ROWS, start_time_str: str = START_TIME) -> pd.DataFrame:
    np.random.seed(SEED)
    timestamps = pd.date_range(pd.to_datetime(start_time_str), periods=num_rows, freq="min")
    df = pd.DataFrame({"timestamp": timestamps, "window_duration_minutes": 1})

    df["traffic_rps"] = _daily_weekly_traffic(timestamps)
    df["recent_deploy"] = _deploy_flags(num_rows, timestamps)
    add, rem, breaking, entropy_bump = _schema_activity(num_rows)
    df["schema_fields_added"] = add
    df["schema_fields_removed"] = rem
    df["schema_breaking_changes"] = breaking

    capacity = 2100 + np.random.normal(0, 90, num_rows)
    load = df["traffic_rps"].values / np.clip(capacity, 1400, None)
    df["p50_latency"] = 24 + 15 * np.power(np.clip(load, 0, None), 1.45) + np.random.normal(0, 2.5, num_rows)
    df["p90_latency"] = df["p50_latency"] * (1.82 + 0.22 * np.clip(load, 0, 2.0)) + np.random.normal(0, 4.5, num_rows)
    df["p95_latency"] = df["p90_latency"] * (1.21 + 0.14 * np.clip(load, 0, 2.0)) + np.random.normal(0, 5.5, num_rows)
    _enforce_quantiles(df)

    df["latency_variance"] = np.square(df["p95_latency"] - df["p50_latency"]) / 16 + np.random.normal(0, 4, num_rows)
    df["latency_variance"] = np.clip(df["latency_variance"], 1, None)

    schema_entropy_base = 1.4 + np.random.normal(0, 0.09, num_rows)
    df["schema_entropy"] = np.clip(schema_entropy_base + entropy_bump, 0.6, None)

    err = (
        0.0011
        + 0.0042 * np.clip(load - 0.55, 0, None)
        + 0.000045 * np.clip(df["p95_latency"].values - 120, 0, None)
        + 0.0021 * df["recent_deploy"].values
        + 0.009 * df["schema_breaking_changes"].values
        + np.random.normal(0, 0.001, num_rows)
    )
    df["error_rate"] = np.clip(err, 0, 1)

    traffic_delta_base = pd.Series(df["traffic_rps"]).diff().fillna(0).values
    p95_shift = pd.Series(df["p95_latency"]).shift(1)
    p95_roll_short = p95_shift.rolling(8, min_periods=3).mean().bfill()
    p95_roll_long = p95_shift.rolling(30, min_periods=8).mean().bfill()
    p95_trend = (p95_roll_short - p95_roll_long) / (p95_roll_long + 1.0)

    err_series = pd.Series(df["error_rate"])
    err_roll = err_series.shift(1).rolling(12, min_periods=4).mean().bfill()
    err_accel = err_series.diff().diff().shift(1).fillna(0)

    util_series = pd.Series(load)
    util_roll = util_series.shift(1).rolling(15, min_periods=5).mean().bfill()
    util_accel = util_series.diff().diff().shift(1).fillna(0)

    entropy_drift = pd.Series(df["schema_entropy"]).diff().shift(1).rolling(20, min_periods=6).mean().fillna(0)
    schema_activity = pd.Series(df["schema_fields_added"] + df["schema_fields_removed"] + 2 * df["schema_breaking_changes"])
    deploy_series = pd.Series(df["recent_deploy"])

    latent_risk = (
        2.35 * np.tanh(8.0 * p95_trend.values)
        + 2.45 * np.tanh(95.0 * err_accel.values)
        + 1.65 * np.maximum(util_roll.values - 0.70, 0) ** 1.75
        + 1.05 * np.tanh(38.0 * util_accel.values)
        + 1.25 * np.maximum(entropy_drift.values, 0) * np.log1p(schema_activity.values)
        + 1.05 * deploy_series.values * np.maximum(util_roll.values - 0.62, 0)
        + 0.55 * np.tanh(np.abs(traffic_delta_base) / 160.0)
        + 0.85 * np.tanh(52.0 * err_roll.values)
        + np.random.normal(0, 0.1, num_rows)
    )

    ar_component = pd.Series(latent_risk).shift(1).fillna(0).values
    logits = 1.2 * latent_risk + 1.0 * ar_component
    logits = 3.2 * logits

    target_rate = np.random.uniform(0.08, 0.10)
    bias = _calibrate_bias(logits, target_rate)
    risk_prob = _sigmoid(logits + bias)
    risk_prob_smooth = pd.Series(risk_prob).rolling(14, min_periods=4).mean().bfill().values

    label = np.zeros(num_rows, dtype=np.int8)
    start_intensity = np.clip(0.001 + 0.07 * risk_prob_smooth, 0, 0.2)
    min_idx, max_idx = 30, max(31, num_rows - 40)
    sampled_starts = np.where(np.random.rand(num_rows) < start_intensity)[0]
    sampled_starts = sampled_starts[(sampled_starts >= min_idx) & (sampled_starts < max_idx)]

    for s in sampled_starts:
        if np.random.rand() < min(0.98, 0.35 + risk_prob_smooth[s]):
            pre = np.random.randint(4, 16)
            fail = np.random.randint(8, 28)
            e = min(num_rows, s + pre + fail)
            label[s:e] = 1

    for i in range(1, num_rows):
        if label[i - 1] == 1 and np.random.rand() < 0.72:
            label[i] = 1
        elif label[i - 1] == 0 and label[i] == 1 and np.random.rand() < 0.25:
            label[i] = 0

    rate = float(label.mean())
    if rate < 0.01:
        need = int(np.ceil(0.01 * num_rows - label.sum()))
        if need > 0:
            idx0 = np.where(label == 0)[0]
            weight = risk_prob[idx0]
            weight = weight / weight.sum()
            chosen = np.random.choice(idx0, size=min(need, len(idx0)), replace=False, p=weight)
            label[chosen] = 1
    if rate > 0.11:
        excess = int(np.ceil(label.sum() - 0.11 * num_rows))
        if excess > 0:
            idx1 = np.where(label == 1)[0]
            keep_strength = risk_prob[idx1] + 1e-9
            drop_weight = (1.0 / keep_strength)
            drop_weight = drop_weight / drop_weight.sum()
            drop = np.random.choice(idx1, size=min(excess, len(idx1)), replace=False, p=drop_weight)
            label[drop] = 0

    starts = np.where((label == 1) & (np.concatenate(([0], label[:-1])) == 0))[0]
    for s in starts:
        if np.random.rand() < 0.72:
            lag = np.random.randint(0, 4)
        else:
            lag = 0
        duration = np.random.randint(8, 36)
        e = min(num_rows, s + lag + duration)
        ls = min(num_rows - 1, s + lag)
        r = e - ls
        if r <= 0:
            continue
        rise = np.linspace(0, 1, r)
        failure_type = np.random.choice([0, 1, 2, 3], p=[0.36, 0.24, 0.22, 0.18])

        if failure_type == 0:
            df.loc[ls:e - 1, "traffic_rps"] *= np.linspace(1.05, np.random.uniform(1.35, 1.8), r)
            df.loc[ls:e - 1, "p95_latency"] += 40 + 340 * rise
            df.loc[ls:e - 1, "latency_variance"] += 12 + 200 * rise
            df.loc[ls:e - 1, "error_rate"] += 0.005 + 0.15 * rise
        elif failure_type == 1:
            crash_gain = np.random.uniform(0.18, 0.42)
            df.loc[ls:e - 1, "traffic_rps"] *= np.random.uniform(0.2, 0.55)
            df.loc[ls:e - 1, "p95_latency"] += np.random.uniform(150, 420)
            df.loc[ls:e - 1, "latency_variance"] += np.random.uniform(80, 280)
            df.loc[ls:e - 1, "error_rate"] += crash_gain
        elif failure_type == 2:
            df.loc[ls:e - 1, "recent_deploy"] = 1
            if np.random.rand() < 0.7:
                df.loc[ls:e - 1, "schema_breaking_changes"] = 1
            df.loc[ls:e - 1, "schema_fields_added"] += np.random.randint(1, 4)
            df.loc[ls:e - 1, "schema_fields_removed"] += np.random.randint(0, 3)
            df.loc[ls:e - 1, "schema_entropy"] += 0.4 + np.linspace(0.0, 2.2, r)
            df.loc[ls:e - 1, "p95_latency"] += 35 + 300 * rise
            df.loc[ls:e - 1, "latency_variance"] += 15 + 180 * rise
            df.loc[ls:e - 1, "error_rate"] += 0.007 + 0.16 * rise
        else:
            df.loc[ls:e - 1, "schema_entropy"] += 0.5 + np.linspace(0.0, 2.5, r)
            df.loc[ls:e - 1, "schema_fields_added"] += np.random.randint(0, 3)
            df.loc[ls:e - 1, "schema_fields_removed"] += np.random.randint(0, 3)
            df.loc[ls:e - 1, "p95_latency"] += 30 + 260 * rise
            df.loc[ls:e - 1, "latency_variance"] += 18 + 220 * rise
            df.loc[ls:e - 1, "error_rate"] += 0.004 + 0.12 * rise

    _enforce_quantiles(df)
    df["p50_latency"] = np.clip(df["p50_latency"], 8, None)
    df["p90_latency"] = np.clip(df["p90_latency"], 12, None)
    df["p95_latency"] = np.clip(df["p95_latency"], 15, None)
    df["latency_variance"] = np.clip(df["latency_variance"], 1, None)
    df["error_rate"] = np.clip(df["error_rate"], 0, 1)
    df["schema_entropy"] = np.clip(df["schema_entropy"], 0.6, None)

    df["latency_delta"] = df["p95_latency"].diff().fillna(0)
    df["error_rate_delta"] = df["error_rate"].diff().fillna(0)
    df["traffic_delta"] = df["traffic_rps"].diff().fillna(0)
    df["schema_entropy_delta"] = df["schema_entropy"].diff().fillna(0)

    df["label"] = label.astype(np.int8)

    desired_columns = [
        "timestamp",
        "window_duration_minutes",
        "p50_latency",
        "p90_latency",
        "p95_latency",
        "latency_variance",
        "latency_delta",
        "error_rate",
        "error_rate_delta",
        "traffic_rps",
        "traffic_delta",
        "schema_fields_added",
        "schema_fields_removed",
        "schema_breaking_changes",
        "schema_entropy",
        "schema_entropy_delta",
        "recent_deploy",
        "label",
    ]
    return df[desired_columns]


def generate_pure_normal_test_data(num_rows: int = 15000, start_time_str: str = "2026-01-01 00:00:00") -> pd.DataFrame:
    np.random.seed(2026)
    timestamps = pd.date_range(pd.to_datetime(start_time_str), periods=num_rows, freq="min")
    traffic = np.clip(np.random.normal(1200, 250, num_rows), 600, 2600)
    p50 = np.clip(np.random.normal(42, 6, num_rows), 20, 90)
    p90 = np.maximum(p50 * np.random.uniform(1.7, 2.0, num_rows), p50 * 1.15)
    p95 = np.maximum(p90 * np.random.uniform(1.18, 1.35, num_rows), p90 * 1.18)
    var = np.clip(np.square(p95 - p50) / 20 + np.random.normal(0, 2, num_rows), 1, None)
    err = np.clip(np.random.uniform(0.001, 0.008, num_rows), 0, 1)
    ent = np.clip(np.random.normal(1.5, 0.12, num_rows), 0.7, None)

    df = pd.DataFrame(
        {
            "timestamp": timestamps,
            "window_duration_minutes": 1,
            "p50_latency": p50,
            "p90_latency": p90,
            "p95_latency": p95,
            "latency_variance": var,
            "error_rate": err,
            "traffic_rps": traffic,
            "schema_fields_added": np.random.choice([0, 1, 2], size=num_rows, p=[0.88, 0.1, 0.02]),
            "schema_fields_removed": np.random.choice([0, 1], size=num_rows, p=[0.96, 0.04]),
            "schema_breaking_changes": 0,
            "schema_entropy": ent,
            "recent_deploy": np.random.choice([0, 1], size=num_rows, p=[0.9, 0.1]),
            "label": 0,
        }
    )
    df["latency_delta"] = df["p95_latency"].diff().fillna(0)
    df["error_rate_delta"] = df["error_rate"].diff().fillna(0)
    df["traffic_delta"] = df["traffic_rps"].diff().fillna(0)
    df["schema_entropy_delta"] = df["schema_entropy"].diff().fillna(0)
    return df[
        [
            "timestamp",
            "window_duration_minutes",
            "p50_latency",
            "p90_latency",
            "p95_latency",
            "latency_variance",
            "latency_delta",
            "error_rate",
            "error_rate_delta",
            "traffic_rps",
            "traffic_delta",
            "schema_fields_added",
            "schema_fields_removed",
            "schema_breaking_changes",
            "schema_entropy",
            "schema_entropy_delta",
            "recent_deploy",
            "label",
        ]
    ]


def generate_pure_anomaly_test_data(num_rows: int = 15000, start_time_str: str = "2026-01-15 00:00:00") -> pd.DataFrame:
    np.random.seed(2027)
    timestamps = pd.date_range(pd.to_datetime(start_time_str), periods=num_rows, freq="min")
    t = np.arange(num_rows)
    traffic_base = 1450 + 420 * np.sin(2 * np.pi * t / 360)
    traffic = traffic_base + np.random.normal(0, 130, num_rows)
    crash_starts = np.where(np.random.rand(num_rows) < 0.0025)[0]
    for s in crash_starts:
        d = np.random.randint(18, 75)
        e = min(num_rows, s + d)
        traffic[s:e] *= np.linspace(1.0, np.random.uniform(0.15, 0.55), e - s)
    surge_starts = np.where(np.random.rand(num_rows) < 0.002)[0]
    for s in surge_starts:
        d = np.random.randint(10, 55)
        e = min(num_rows, s + d)
        traffic[s:e] *= np.linspace(1.0, np.random.uniform(1.4, 2.2), e - s)
    traffic = np.clip(traffic, 60, 6200)

    util = np.clip(traffic / 1900.0, 0, 3.2)
    p50 = 42 + 70 * np.power(util, 1.35) + np.random.normal(0, 7, num_rows)
    p90 = p50 * (1.9 + 0.28 * np.clip(util, 0, 2.4)) + np.random.normal(0, 14, num_rows)
    p95 = p90 * (1.27 + 0.14 * np.clip(util, 0, 2.4)) + np.random.normal(0, 18, num_rows)

    ramp_starts = np.where(np.random.rand(num_rows) < 0.0018)[0]
    for s in ramp_starts:
        d = np.random.randint(20, 110)
        e = min(num_rows, s + d)
        r = e - s
        p95[s:e] += np.linspace(20, np.random.uniform(180, 480), r)
        p90[s:e] += np.linspace(10, np.random.uniform(90, 240), r)

    p90 = np.maximum(p90, p50 * 1.2)
    p95 = np.maximum(p95, p90 * 1.18)
    var = np.clip(np.square(p95 - p50) / 11 + np.random.normal(0, 9, num_rows), 15, None)

    err = 0.018 + 0.018 * np.clip(util - 0.7, 0, None) + 0.00006 * np.clip(p95 - 170, 0, None)
    err += np.random.normal(0, 0.01, num_rows)
    err = np.clip(err, 0.01, 0.35)
    err_shocks = np.where(np.random.rand(num_rows) < 0.0022)[0]
    for s in err_shocks:
        d = np.random.randint(8, 42)
        e = min(num_rows, s + d)
        err[s:e] = np.clip(err[s:e] + np.linspace(0.02, np.random.uniform(0.08, 0.2), e - s), 0, 1)

    ent = 2.4 + np.random.normal(0, 0.5, num_rows)
    ent_burst = np.where(np.random.rand(num_rows) < 0.0017)[0]
    for s in ent_burst:
        d = np.random.randint(10, 50)
        e = min(num_rows, s + d)
        ent[s:e] += np.linspace(0.3, np.random.uniform(1.2, 2.8), e - s)
    ent = np.clip(ent, 1.2, None)

    df = pd.DataFrame(
        {
            "timestamp": timestamps,
            "window_duration_minutes": 1,
            "p50_latency": np.clip(p50, 40, 460),
            "p90_latency": np.clip(p90, 80, 980),
            "p95_latency": np.clip(p95, 120, 1600),
            "latency_variance": var,
            "error_rate": err,
            "traffic_rps": traffic,
            "schema_fields_added": np.random.choice([1, 2, 3, 4, 6], size=num_rows, p=[0.1, 0.24, 0.32, 0.24, 0.1]),
            "schema_fields_removed": np.random.choice([0, 1, 2, 3], size=num_rows, p=[0.2, 0.32, 0.3, 0.18]),
            "schema_breaking_changes": np.random.choice([0, 1], size=num_rows, p=[0.35, 0.65]),
            "schema_entropy": ent,
            "recent_deploy": np.random.choice([0, 1], size=num_rows, p=[0.68, 0.32]),
            "label": 1,
        }
    )
    df["latency_delta"] = df["p95_latency"].diff().fillna(0)
    df["error_rate_delta"] = df["error_rate"].diff().fillna(0)
    df["traffic_delta"] = df["traffic_rps"].diff().fillna(0)
    df["schema_entropy_delta"] = df["schema_entropy"].diff().fillna(0)
    return df[
        [
            "timestamp",
            "window_duration_minutes",
            "p50_latency",
            "p90_latency",
            "p95_latency",
            "latency_variance",
            "latency_delta",
            "error_rate",
            "error_rate_delta",
            "traffic_rps",
            "traffic_delta",
            "schema_fields_added",
            "schema_fields_removed",
            "schema_breaking_changes",
            "schema_entropy",
            "schema_entropy_delta",
            "recent_deploy",
            "label",
        ]
    ]


if __name__ == "__main__":
    start = datetime.now()
    out_dir = os.path.dirname(__file__)

    main_df = generate_observability_data()
    main_path = os.path.join(out_dir, "microservice_observability_data.csv")
    main_df.to_csv(main_path, index=False)

    normal_df = generate_pure_normal_test_data()
    normal_path = os.path.join(out_dir, "test_data_pure_normal.csv")
    normal_df.to_csv(normal_path, index=False)

    anomaly_df = generate_pure_anomaly_test_data()
    anomaly_path = os.path.join(out_dir, "test_data_pure_anomaly.csv")
    anomaly_df.to_csv(anomaly_path, index=False)

    label_rate = float(main_df["label"].mean() * 100)
    print("=" * 70)
    print(f"Saved: {main_path}")
    print(f"Rows: {len(main_df):,}")
    print(f"Downtime Rows: {int(main_df['label'].sum()):,} ({label_rate:.2f}%)")
    print(f"Saved: {normal_path}")
    print(f"Saved: {anomaly_path}")
    print(f"Completed in {(datetime.now() - start).total_seconds():.2f}s")
    print("=" * 70)