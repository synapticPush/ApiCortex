from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from statistics import mean
from typing import Deque

import numpy as np

from app.schemas.telemetry_event import TelemetryEvent


WINDOW_1M = timedelta(minutes=1)
WINDOW_5M = timedelta(minutes=5)
WINDOW_15M = timedelta(minutes=15)

FEATURE_COLUMNS = [
    "latency_mean",
    "latency_p95",
    "latency_variance",
    "latency_delta",
    "error_rate",
    "error_rate_delta",
    "traffic_rps",
    "traffic_delta",
    "schema_fields_added",
    "schema_fields_removed",
    "schema_breaking_changes",
]


@dataclass(frozen=True)
class EventKey:
    org_id: str
    api_id: str
    endpoint: str
    method: str


@dataclass(frozen=True)
class EventSnapshot:
    timestamp: datetime
    status: int
    latency_ms: int
    schema_hash: str | None


@dataclass
class FeatureRow:
    time: datetime
    org_id: str
    api_id: str
    endpoint: str
    features: dict[str, float]


class RollingFeatureEngineer:
    """Maintains per-endpoint rolling state and computes model features."""

    def __init__(self) -> None:
        self._history: dict[EventKey, Deque[EventSnapshot]] = defaultdict(deque)

    def ingest(self, events: list[TelemetryEvent]) -> list[FeatureRow]:
        if not events:
            return []

        touched_keys: set[EventKey] = set()

        for event in sorted(events, key=lambda e: e.timestamp):
            key = EventKey(
                org_id=event.org_id,
                api_id=event.api_id,
                endpoint=event.endpoint,
                method=event.method,
            )
            snapshot = EventSnapshot(
                timestamp=event.timestamp.astimezone(UTC),
                status=event.status,
                latency_ms=event.latency_ms,
                schema_hash=event.schema_hash,
            )
            self._history[key].append(snapshot)
            touched_keys.add(key)
            self._prune_old(key, snapshot.timestamp)

        rows: list[FeatureRow] = []
        for key in touched_keys:
            latest_ts = self._history[key][-1].timestamp
            rows.append(
                FeatureRow(
                    time=latest_ts,
                    org_id=key.org_id,
                    api_id=key.api_id,
                    endpoint=key.endpoint,
                    features=self._compute_features(key, latest_ts),
                )
            )
        return rows

    def _prune_old(self, key: EventKey, now: datetime) -> None:
        cutoff = now - WINDOW_15M
        queue = self._history[key]
        while queue and queue[0].timestamp < cutoff:
            queue.popleft()

    def _events_in_window(self, key: EventKey, now: datetime, window: timedelta) -> list[EventSnapshot]:
        cutoff = now - window
        return [event for event in self._history[key] if event.timestamp >= cutoff]

    def _compute_features(self, key: EventKey, now: datetime) -> dict[str, float]:
        events_1m = self._events_in_window(key, now, WINDOW_1M)
        events_5m = self._events_in_window(key, now, WINDOW_5M)
        events_15m = self._events_in_window(key, now, WINDOW_15M)

        latencies_1m = [float(e.latency_ms) for e in events_1m]
        latencies_5m = [float(e.latency_ms) for e in events_5m]

        latency_mean = mean(latencies_1m) if latencies_1m else 0.0
        latency_p95 = float(np.percentile(latencies_1m, 95)) if latencies_1m else 0.0
        latency_variance = float(np.var(latencies_1m)) if len(latencies_1m) > 1 else 0.0

        latency_5m_mean = mean(latencies_5m) if latencies_5m else latency_mean
        latency_delta = latency_mean - latency_5m_mean

        error_rate_1m = self._error_rate(events_1m)
        error_rate_5m = self._error_rate(events_5m)
        error_rate_delta = error_rate_1m - error_rate_5m

        traffic_rps_1m = len(events_1m) / 60.0
        traffic_rps_5m = len(events_5m) / 300.0
        traffic_delta = traffic_rps_1m - traffic_rps_5m

        schema_fields_added, schema_fields_removed, schema_breaking_changes = self._schema_change_features(events_15m)

        features = {
            "latency_mean": latency_mean,
            "latency_p95": latency_p95,
            "latency_variance": latency_variance,
            "latency_delta": latency_delta,
            "error_rate": error_rate_1m,
            "error_rate_delta": error_rate_delta,
            "traffic_rps": traffic_rps_1m,
            "traffic_delta": traffic_delta,
            "schema_fields_added": schema_fields_added,
            "schema_fields_removed": schema_fields_removed,
            "schema_breaking_changes": schema_breaking_changes,
        }

        
        return {name: float(np.nan_to_num(value, nan=0.0, posinf=0.0, neginf=0.0)) for name, value in features.items()}

    @staticmethod
    def _error_rate(events: list[EventSnapshot]) -> float:
        if not events:
            return 0.0
        error_count = sum(1 for event in events if event.status >= 500)
        return error_count / float(len(events))

    @staticmethod
    def _schema_change_features(events: list[EventSnapshot]) -> tuple[float, float, float]:
        if len(events) < 2:
            return 0.0, 0.0, 0.0

        changes = 0
        breaking = 0
        previous_hash = events[0].schema_hash

        for event in events[1:]:
            if previous_hash and event.schema_hash and previous_hash != event.schema_hash:
                changes += 1
                if event.status >= 500:
                    breaking = 1
            previous_hash = event.schema_hash

        fields_added = float(changes)
        fields_removed = float(max(0, changes - 1))
        return fields_added, fields_removed, float(breaking)
