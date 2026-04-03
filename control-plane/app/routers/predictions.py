import uuid
from typing import Any

from fastapi import APIRouter, Request
from sqlalchemy import text

from app.schemas.prediction import PredictionRecordOut
from app.services.dashboard_service import timescale_engine

router = APIRouter()


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_top_features(raw: Any) -> list[dict[str, float | str]]:
    if not isinstance(raw, list):
        return []

    normalized: list[dict[str, float | str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            name = str(item.get("feature") or "unknown")
        contribution = _to_float(item.get("contribution"), 0.0)
        value = _to_float(item.get("value"), abs(contribution))
        normalized.append(
            {
                "name": name,
                "value": value,
                "contribution": abs(contribution),
            }
        )
    return normalized

@router.get("", response_model=list[PredictionRecordOut])
@router.get("/", response_model=list[PredictionRecordOut])
def get_predictions(request: Request, limit: int = 50):
    org_id = uuid.UUID(str(request.state.org_id))
    limit = max(1, min(limit, 100))

    query = text(
        """
        SELECT
            time, api_id, endpoint, risk_score, prediction, confidence, top_features
        FROM api_failure_predictions
        WHERE org_id = :org_id
        ORDER BY time DESC
        LIMIT :limit
        """
    )
    with timescale_engine.connect() as conn:
        rows = conn.execute(query, {"org_id": str(org_id), "limit": limit}).mappings().all()

    return [
        PredictionRecordOut(
            time=row["time"],
            api_id=row["api_id"],
            endpoint=row["endpoint"],
            risk_score=float(row["risk_score"]),
            prediction=row["prediction"],
            confidence=float(row["confidence"]),
            top_features=_normalize_top_features(row["top_features"]),
        )
        for row in rows
    ]
