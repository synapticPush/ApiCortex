import pandas as pd
import numpy as np
import os

try:
    print("Loading dataset...")
    base_dir = os.path.dirname(__file__)
    csv_path = os.path.join(base_dir, 'microservice_observability_data.csv')
    df = pd.read_csv(csv_path)
    
    total_rows = len(df)
    anomalies = df[df['label'] == 1].index
    
    print(f"Total Rows: {total_rows}")
    print(f"Total Anomalies: {len(anomalies)} ({len(anomalies)/total_rows*100:.2f}%)")
    
    
    print("\n--- DATASET INFO ---")
    df.info()
    
    
    
    
    if len(anomalies) == 0:
        print("WARNING: No anomalies found!")
    else:
        
        print("\nAnomaly Distribution per 10% chunk:")
        chunk_size = total_rows // 10
        for i in range(10):
            start = i * chunk_size
            end = (i + 1) * chunk_size
            count = df.iloc[start:end]['label'].sum()
            print(f"Chunk {i+1} ({start}-{end}): {count} anomalies")
            
        
        max_gap = np.diff(anomalies).max()
        print(f"\nMax gap between anomaly starts: {max_gap} rows")
        
        if max_gap > total_rows * 0.1:
            print("WARNING: Large gap detected! Anomalies might be clustered.")
        else:
            print("STATUS: GOOD. Anomalies appear distributed.")

except Exception as e:
    print(f"Verification failed: {e}")
