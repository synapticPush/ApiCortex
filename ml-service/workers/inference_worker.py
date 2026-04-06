from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

from confluent_kafka import Message

from app.config import Settings
from app.explainability.shap_explainer import ShapExplainer
from app.features.feature_engineering import FEATURE_COLUMNS, RollingFeatureEngineer
from app.inference.model_loader import load_model
from app.inference.predictor import Predictor
from app.kafka.consumer import KafkaBatchConsumer, RetryableKafkaError
from app.storage.timescale_writer import PredictionRecord, TimescaleWriter


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            payload.update(record.extra)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging(level: str) -> logging.Logger:
    logger = logging.getLogger("apicortex.ml-worker")
    logger.setLevel(level)
    logger.handlers.clear()
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.propagate = False
    return logger


@dataclass
class WorkerMetrics:
    batches_processed: int = 0
    events_processed: int = 0
    invalid_events: int = 0
    payload_corruption: int = 0
    telemetry_written: int = 0
    telemetry_write_failures: int = 0
    predictions_written: int = 0
    alerts_published: int = 0
    db_write_failures: int = 0
    alert_publish_failures: int = 0
    alert_delivery_errors: int = 0
    inference_errors: int = 0
    retries: int = 0
    dlq_messages: int = 0
    processing_dlq_messages: int = 0


@dataclass
class RetryConfig:
    max_retries: int = 3
    initial_backoff_seconds: float = 0.1
    max_backoff_seconds: float = 30.0
    backoff_multiplier: float = 2.0


class InferenceWorker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.logger = configure_logging(settings.log_level)

        model = load_model(settings.model_path)
        explainer = ShapExplainer(
            model=model,
            enabled=settings.enable_shap,
            top_k=settings.shap_top_k,
            logger=self.logger,
        )

        self.predictor = Predictor(model=model, explainer=explainer)
        self.feature_engineer = RollingFeatureEngineer(logger=self.logger)
        self.consumer = KafkaBatchConsumer(settings)
        self.writer = TimescaleWriter(settings)

        self.metrics = WorkerMetrics()
        self.retry_config = RetryConfig(max_retries=settings.processing_failure_max_retries)
        self._shutdown = asyncio.Event()
        self._db_executor = ThreadPoolExecutor(max_workers=max(1, settings.db_pool_max_connections))
        self._db_semaphore = asyncio.Semaphore(max(1, settings.db_pool_max_connections))
        self._message_failures: dict[tuple[str, int, int], int] = {}
        self._model_hash = self._compute_model_hash(settings.model_path)

    @staticmethod
    def _compute_model_hash(model_path: Path) -> str:
        sha = hashlib.sha256()
        with model_path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(65536), b""):
                sha.update(chunk)
        return sha.hexdigest()

    def request_shutdown(self) -> None:
        self._shutdown.set()

    async def _validate_uuids(self, org_id: str, api_id: str) -> bool:
        import uuid as uuid_module

        try:
            uuid_module.UUID(org_id)
            uuid_module.UUID(api_id)
            return True
        except (ValueError, AttributeError):
            return False

    async def _retry_with_backoff(self, func: Callable, *args, **kwargs) -> Any:
        backoff = self.retry_config.initial_backoff_seconds
        last_error = None

        for attempt in range(self.retry_config.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as exc:
                last_error = exc
                if attempt < self.retry_config.max_retries:
                    self.metrics.retries += 1
                    wait_seconds = min(backoff, self.retry_config.max_backoff_seconds)
                    await asyncio.sleep(wait_seconds)
                    backoff *= self.retry_config.backoff_multiplier
                    self.logger.warning(
                        f"Retry attempt {attempt + 1}/{self.retry_config.max_retries}",
                        extra={"extra": {"error": str(exc), "next_backoff_seconds": wait_seconds}},
                    )

        raise last_error or RuntimeError("Retry exhausted")

    async def run(self) -> None:
        self.logger.info(
            "ML inference worker started",
            extra={
                "extra": {
                    "alert_threshold": self.settings.alert_threshold,
                    "shap_min_risk": self.settings.shap_min_risk,
                    "kafka_topic_raw": self.settings.kafka_topic_raw,
                    "kafka_topic_alerts": self.settings.kafka_topic_alerts,
                    "enable_shap": self.settings.enable_shap,
                }
            },
        )

        while not self._shutdown.is_set():
            try:
                message = await asyncio.to_thread(self.consumer.poll_message, self.settings.kafka_poll_timeout_seconds)
            except RetryableKafkaError as exc:
                self.logger.warning(
                    "Kafka topic unavailable",
                    extra={"extra": {"error": str(exc), "topic": self.settings.kafka_topic_raw}},
                )
                await asyncio.sleep(max(1.0, self.settings.kafka_poll_timeout_seconds))
                continue
            except Exception as exc:
                self.metrics.inference_errors += 1
                self.logger.exception(
                    "Kafka poll failed",
                    extra={"extra": {"error": str(exc), "inference_errors": self.metrics.inference_errors}},
                )
                await asyncio.sleep(max(1.0, self.settings.kafka_poll_timeout_seconds))
                continue

            if message is None:
                continue

            try:
                await self._handle_message(message)
                self._message_failures.pop((message.topic(), message.partition(), message.offset()), None)
            except Exception as exc:
                self.metrics.inference_errors += 1
                self.logger.exception(
                    "Failed to process telemetry batch",
                    extra={
                        "extra": {
                            "error": str(exc),
                            "inference_errors": self.metrics.inference_errors,
                            "topic": message.topic(),
                            "partition": message.partition(),
                            "offset": message.offset(),
                        }
                    },
                )
                await self._handle_processing_failure(message, str(exc))

        await self._shutdown_cleanup()

    async def _handle_processing_failure(self, message: Message, reason: str) -> None:
        key = (message.topic(), message.partition(), message.offset())
        attempts = self._message_failures.get(key, 0) + 1
        self._message_failures[key] = attempts

        if attempts <= self.settings.processing_failure_max_retries:
            return

        try:
            await asyncio.to_thread(self.consumer.publish_processing_failure, message, reason)
            self.metrics.processing_dlq_messages += 1
            await asyncio.to_thread(self.consumer.commit_message, message)
            self._message_failures.pop(key, None)
        except Exception as exc:
            self.logger.exception(
                "Failed to publish processing failure to DLQ",
                extra={
                    "extra": {
                        "error": str(exc),
                        "topic": message.topic(),
                        "partition": message.partition(),
                        "offset": message.offset(),
                    }
                },
            )

    async def _handle_message(self, message: Message) -> None:
        started = time.perf_counter()
        kafka_lag = await asyncio.to_thread(self.consumer.lag_for_message, message)

        decode_result = await asyncio.to_thread(self.consumer.decode_message, message)
        self.metrics.payload_corruption += decode_result.payload_corruption_count

        for invalid in decode_result.invalid_payloads:
            self.metrics.invalid_events += 1
            self.metrics.dlq_messages += 1
            await asyncio.to_thread(
                self.consumer.publish_invalid_payload,
                invalid.get("original_payload"),
                invalid.get("reason", "Unknown error"),
                message.topic(),
                message.offset(),
            )

        if not decode_result.valid_events:
            await asyncio.to_thread(self.consumer.commit_message, message)
            return

        filtered_events = []
        for event in decode_result.valid_events:
            if await self._validate_uuids(event.org_id, event.api_id):
                filtered_events.append(event)
                continue
            self.metrics.invalid_events += 1
            self.metrics.dlq_messages += 1
            await asyncio.to_thread(
                self.consumer.publish_invalid_payload,
                {
                    "timestamp": event.timestamp.isoformat(),
                    "org_id": event.org_id,
                    "api_id": event.api_id,
                    "endpoint": event.endpoint,
                    "method": event.method,
                },
                f"Invalid UUID format: org_id={event.org_id}, api_id={event.api_id}",
                message.topic(),
                message.offset(),
            )

        if not filtered_events:
            await asyncio.to_thread(self.consumer.commit_message, message)
            return

        try:
            await self._retry_with_backoff(self._write_telemetry_async, filtered_events)
            self.metrics.telemetry_written += len(filtered_events)
        except Exception as exc:
            self.metrics.telemetry_write_failures += 1
            raise RuntimeError(f"telemetry write failed: {exc}") from exc

        feature_rows = self.feature_engineer.ingest(filtered_events)
        prediction_records: list[PredictionRecord] = []
        alerts_to_publish: list[dict[str, Any]] = []
        risk_scores: list[float] = []
        warmed_up_rows = 0
        cold_start_rows = 0

        for feature_row in feature_rows:
            if feature_row.is_warmed_up:
                warmed_up_rows += 1
            else:
                cold_start_rows += 1

            result = self.predictor.predict(
                feature_row.features,
                explain=feature_row.is_warmed_up,
                explain_min_risk=self.settings.shap_min_risk,
            )
            risk_scores.append(result.risk_score)
            prediction_records.append(
                PredictionRecord(
                    time=feature_row.time,
                    org_id=feature_row.org_id,
                    api_id=feature_row.api_id,
                    endpoint=feature_row.endpoint,
                    method=feature_row.method,
                    risk_score=result.risk_score,
                    prediction=result.prediction,
                    confidence=result.confidence,
                    top_features=result.top_features,
                    feature_values={name: float(feature_row.features.get(name, 0.0)) for name in FEATURE_COLUMNS},
                    model_hash=self._model_hash,
                    is_warmed_up=feature_row.is_warmed_up,
                )
            )

            if result.risk_score >= self.settings.alert_threshold:
                alerts_to_publish.append(
                    {
                        "org_id": feature_row.org_id,
                        "api_id": feature_row.api_id,
                        "endpoint": feature_row.endpoint,
                        "method": feature_row.method,
                        "risk_score": result.risk_score,
                        "prediction": result.prediction,
                        "severity": "high",
                        "timestamp": feature_row.time.isoformat(),
                    }
                )

        if prediction_records:
            try:
                await self._retry_with_backoff(self._write_predictions_async, prediction_records)
            except Exception as exc:
                self.metrics.db_write_failures += 1
                raise RuntimeError(f"prediction write failed: {exc}") from exc

        for alert in alerts_to_publish:
            try:
                await self._retry_with_backoff(self._publish_alert_async, alert)
            except Exception as exc:
                self.metrics.alert_publish_failures += 1
                raise RuntimeError(f"alert publish failed: {exc}") from exc

        if alerts_to_publish:
            delivered = await asyncio.to_thread(
                self.consumer.wait_for_pending_alerts,
                self.settings.kafka_alert_delivery_timeout_seconds,
            )
            delivery_errors = await asyncio.to_thread(self.consumer.get_and_clear_delivery_errors)
            if (not delivered) or delivery_errors:
                self.metrics.alert_delivery_errors += len(delivery_errors) + (0 if delivered else 1)
                reason = "alert delivery confirmation failed"
                if delivery_errors:
                    reason = f"alert delivery confirmation failed: {delivery_errors[0]}"
                raise RuntimeError(reason)
            self.metrics.alerts_published += len(alerts_to_publish)

        await asyncio.to_thread(self.consumer.commit_message, message)

        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        self.metrics.batches_processed += 1
        self.metrics.events_processed += len(filtered_events)
        self.metrics.predictions_written += len(prediction_records)
        risk_min = min(risk_scores) if risk_scores else 0.0
        risk_max = max(risk_scores) if risk_scores else 0.0
        risk_avg = (sum(risk_scores) / len(risk_scores)) if risk_scores else 0.0
        above_threshold_count = sum(1 for score in risk_scores if score >= self.settings.alert_threshold)

        self.logger.info(
            "Processed telemetry batch",
            extra={
                "extra": {
                    "events_processed": len(filtered_events),
                    "telemetry_written": len(filtered_events),
                    "predictions_written": len(prediction_records),
                    "alerts_published": len(alerts_to_publish),
                    "alert_threshold": self.settings.alert_threshold,
                    "risk_score_min": round(risk_min, 6),
                    "risk_score_max": round(risk_max, 6),
                    "risk_score_avg": round(risk_avg, 6),
                    "above_threshold_count": above_threshold_count,
                    "warmed_up_predictions": warmed_up_rows,
                    "cold_start_predictions": cold_start_rows,
                    "invalid_events": len(decode_result.invalid_payloads),
                    "payload_corruption": decode_result.payload_corruption_count,
                    "prediction_latency_ms": duration_ms,
                    "kafka_lag": kafka_lag,
                    "totals": {
                        "batches": self.metrics.batches_processed,
                        "events": self.metrics.events_processed,
                        "predictions": self.metrics.predictions_written,
                        "alerts_published": self.metrics.alerts_published,
                        "inference_errors": self.metrics.inference_errors,
                        "invalid_events": self.metrics.invalid_events,
                        "dlq_messages": self.metrics.dlq_messages,
                        "processing_dlq_messages": self.metrics.processing_dlq_messages,
                    },
                }
            },
        )

    async def _run_db_call(self, fn: Callable, *args) -> None:
        async with self._db_semaphore:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(self._db_executor, fn, *args)

    async def _write_telemetry_async(self, events) -> None:
        await self._run_db_call(self.writer.write_telemetry, events)

    async def _write_predictions_async(self, records: list[PredictionRecord]) -> None:
        await self._run_db_call(self.writer.write_predictions, records)

    async def _publish_alert_async(self, alert: dict[str, Any]) -> None:
        await asyncio.to_thread(self.consumer.publish_alert, alert)

    async def _shutdown_cleanup(self) -> None:
        self.logger.info("Shutting down ML inference worker")
        try:
            await asyncio.wait_for(
                asyncio.to_thread(self.consumer.wait_for_pending_alerts, self.settings.kafka_alert_delivery_timeout_seconds),
                timeout=self.settings.shutdown_timeout_seconds,
            )
        except Exception:
            pass

        try:
            await asyncio.wait_for(
                asyncio.to_thread(self.consumer.flush_producer, self.settings.kafka_alert_delivery_timeout_seconds),
                timeout=self.settings.shutdown_timeout_seconds,
            )
        except Exception:
            pass

        try:
            await asyncio.wait_for(
                self._run_db_call(self.writer.close),
                timeout=self.settings.shutdown_timeout_seconds,
            )
        except Exception:
            pass

        try:
            await asyncio.wait_for(
                asyncio.to_thread(self.consumer.close),
                timeout=self.settings.shutdown_timeout_seconds,
            )
        except Exception:
            pass

        self._db_executor.shutdown(wait=False, cancel_futures=True)


def install_signal_handlers(worker: InferenceWorker) -> None:
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, worker.request_shutdown)
        except NotImplementedError:
            signal.signal(sig, lambda _signo, _frame: worker.request_shutdown())
