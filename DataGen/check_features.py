import pandas as pd
import numpy as np
import os

base_dir = os.path.dirname(__file__)
csv_path = os.path.join(base_dir, 'microservice_observability_data.csv')
df = pd.read_csv(csv_path)

print("="*70)
print("FEATURE DISTRIBUTION ANALYSIS")
print("="*70)

feature_cols = [
    'latency_delta', 'error_rate_delta', 'traffic_delta',
    'schema_fields_added', 'schema_fields_removed', 
    'schema_breaking_changes', 'schema_entropy_delta', 'recent_deploy'
]

warning = df['label'] == 1
normal = df['label'] == 0

print(
    f"\nDataset: {len(df):,} rows | normal={normal.sum():,} downtime={warning.sum():,}\n"
)

for feature in feature_cols:
    normal_vals = df.loc[normal, feature]
    anomaly_vals = df.loc[warning, feature]
    
    print(f"{feature}:")
    print(f"  Normal:  mean={normal_vals.mean():>10.4f} std={normal_vals.std():>10.4f} max={normal_vals.max():>10.2f}")
    print(f"  Anomaly: mean={anomaly_vals.mean():>10.4f} std={anomaly_vals.std():>10.4f} max={anomaly_vals.max():>10.2f}")
    print(f"  Non-zero: Normal={100*(normal_vals != 0).mean():.1f}% Anomaly={100*(anomaly_vals != 0).mean():.1f}%")
    print()

print("="*70)
print("DELTA FEATURES AT ANOMALY BOUNDARIES")
print("="*70)

anomaly_starts = df[(df['label'] == 1) & (df['label'].shift(1) != 1)].index
if len(anomaly_starts) > 0:
    sample_starts = np.random.choice(anomaly_starts, size=min(10, len(anomaly_starts)), replace=False)
    
    print(f"\nSampling {len(sample_starts)} anomaly start points:\n")
    for idx in sorted(sample_starts)[:5]:
        print(f"Index {idx}:")
        print(f"  latency_delta: {df.at[idx, 'latency_delta']:.2f}ms")
        print(f"  error_rate_delta: {df.at[idx, 'error_rate_delta']:.5f}")
        print(f"  traffic_delta: {df.at[idx, 'traffic_delta']:.0f} RPS")
        print(f"  schema_breaking_changes: {df.at[idx, 'schema_breaking_changes']}")
        print()
