import uuid

from sqlalchemy import text

from app.services.dashboard_service import timescale_engine


class TimescaleCleanupService:
    @staticmethod
    def delete_api_data(org_id: uuid.UUID, api_id: uuid.UUID) -> dict[str, int]:
        params = {"org_id": str(org_id), "api_id": str(api_id)}
        with timescale_engine.begin() as conn:
            predictions_result = conn.execute(
                text(
                    """
                    DELETE FROM api_failure_predictions
                    WHERE org_id = :org_id AND api_id = :api_id
                    """
                ),
                params,
            )
            telemetry_result = conn.execute(
                text(
                    """
                    DELETE FROM api_telemetry
                    WHERE org_id = :org_id AND api_id = :api_id
                    """
                ),
                params,
            )

        deleted_predictions = predictions_result.rowcount if predictions_result.rowcount and predictions_result.rowcount > 0 else 0
        deleted_telemetry = telemetry_result.rowcount if telemetry_result.rowcount and telemetry_result.rowcount > 0 else 0
        return {
            "predictions": deleted_predictions,
            "telemetry": deleted_telemetry,
        }
