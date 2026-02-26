import pandas as pd
import numpy as np
import scipy.stats as stats
import os

try:
    base_dir = os.path.dirname(__file__)
    csv_path = os.path.join(base_dir, 'microservice_observability_data.csv')
    df = pd.read_csv(csv_path)
    
    print("--- DATASET HEALTH REPORT ---")
    print(f"Total Rows: {len(df)}")
    print(f"Time Range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    
    train_df = df[df['label'].isin([0, 1])].copy()

    
    n_anomalies = int((train_df['label'] == 1).sum())
    pct_anomalies = (n_anomalies / len(train_df)) * 100
    print(f"\n[Label Distribution]")
    print(f"Rows: {len(train_df)}")
    print(f"Normal: {int((train_df['label'] == 0).sum())}")
    print(f"Downtime: {n_anomalies} ({pct_anomalies:.2f}%)")
    if pct_anomalies < 7 or pct_anomalies > 12:
        print("WARNING: Downtime rate is outside target range (7-12%).")
    else:
        print("STATUS: GOOD. Downtime rate is in target range (7-12%).")

    
    print(f"\n[Key Correlations]")
    corr = train_df[['traffic_rps', 'p95_latency', 'error_rate', 'label']].corr()
    print(corr['label'].sort_values(ascending=False))
    
    traffic_latency_corr = train_df['traffic_rps'].corr(train_df['p50_latency'])
    print(f"\nTraffic <-> P50 Latency Correlation: {traffic_latency_corr:.4f}")
    if traffic_latency_corr > 0.15:
        print("STATUS: GOOD. P50 latency coupled to load (queuing theory).")
    else:
        print("WARNING: P50 latency might not be sufficiently coupled to traffic load.")

    
    print(f"\n[Distribution Normality Checks]")
    
    p95_skew = train_df['p95_latency'].skew()
    print(f"P95 Latency Skew: {p95_skew:.2f} (Expected > 0 for log-normal)")
    
    
    print(f"\n[Low Variance Features]")
    non_feature_cols = ['timestamp', 'window_duration_minutes']
    low_var = []
    for col in train_df.columns:
        if col in non_feature_cols:
            continue
        if train_df[col].dtype in [np.float64, np.int64]:
            if train_df[col].std() == 0:
                low_var.append(col)
    if low_var:
        print(f"WARNING: Constant feature columns found: {low_var}")
    else:
        print("STATUS: GOOD. No constant feature columns.")
    print(f"  (window_duration_minutes excluded — intentional metadata column)")

except Exception as e:
    print(f"Analysis failed: {e}")
