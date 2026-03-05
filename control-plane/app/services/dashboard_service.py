import uuid

from sqlalchemy import create_engine, text

from app.core.config import settings


timescale_engine = create_engine(settings.timescale_url, pool_pre_ping=True)


class DashboardService:
    @staticmethod
    def summary(org_id: uuid.UUID, window_hours: int = 24) -> dict:
        query = text(
            """
            SELECT
                COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) AS p95_latency_ms,
                COALESCE(AVG(CASE WHEN status >= 500 THEN 1.0 ELSE 0.0 END), 0) AS error_rate,
                COALESCE(COUNT(*), 0) AS request_count
            FROM api_telemetry
            WHERE org_id = :org_id
              AND time >= now() - make_interval(hours => :window_hours)
            """
        )
        with timescale_engine.connect() as conn:
            row = conn.execute(query, {"org_id": str(org_id), "window_hours": window_hours}).mappings().first()
        if not row:
            return {"p95_latency_ms": 0.0, "error_rate": 0.0, "request_count": 0}
        return {
            "p95_latency_ms": float(row["p95_latency_ms"] or 0.0),
            "error_rate": float(row["error_rate"] or 0.0),
            "request_count": int(row["request_count"] or 0),
        }
