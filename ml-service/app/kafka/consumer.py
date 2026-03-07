from __future__ import annotations

import gzip
import json
from typing import Any

from confluent_kafka import Consumer, KafkaError, Message, Producer, TopicPartition

from app.config import Settings
from app.schemas.telemetry_event import TelemetryEvent


class RetryableKafkaError(RuntimeError):
    """Represents Kafka errors that should not terminate the worker loop."""


class KafkaBatchConsumer:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._consumer = Consumer(settings.consumer_config)
        self._consumer.subscribe([settings.kafka_topic_raw])
        self._producer = Producer(settings.producer_config)

    def poll_message(self, timeout_seconds: float) -> Message | None:
        message = self._consumer.poll(timeout_seconds)
        if message is None:
            return None
        if message.error():
            code = message.error().code()
            if code == KafkaError._PARTITION_EOF:
                return None
            unknown_topic_code = getattr(KafkaError, "UNKNOWN_TOPIC_OR_PART", None)
            if unknown_topic_code is not None and code == unknown_topic_code:
                raise RetryableKafkaError(
                    f"Kafka topic unavailable: {self._settings.kafka_topic_raw}: {message.error()}"
                )
            raise RuntimeError(f"Kafka consume error: {message.error()}")
        return message

    def decode_message(self, message: Message) -> list[TelemetryEvent]:
        payload = message.value()
        if payload is None:
            return []

        payload = self._decompress_if_needed(payload, message.headers())

        data = json.loads(payload.decode("utf-8"))
        if not isinstance(data, list):
            raise ValueError("telemetry.raw payload must be a JSON array")

        return [TelemetryEvent.model_validate(item) for item in data]

    @staticmethod
    def _decompress_if_needed(payload: bytes, headers: list[tuple[str, bytes]] | None) -> bytes:
        header_map: dict[str, str] = {}
        if headers:
            header_map = {
                key.lower(): (value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value))
                for key, value in headers
            }

        content_encoding = header_map.get("content-encoding", "").lower()
        if content_encoding == "gzip" or payload[:2] == b"\x1f\x8b":
            return gzip.decompress(payload)

        if content_encoding == "snappy":
            try:
                import snappy

                return snappy.decompress(payload)
            except Exception as exc:
                raise RuntimeError(f"snappy decode failed: {exc}") from exc

        return payload

    def lag_for_message(self, message: Message) -> int:
        topic_partition = TopicPartition(message.topic(), message.partition())
        low, high = self._consumer.get_watermark_offsets(
            topic_partition,
            timeout=1.0,
            cached=False,
        )
        return max(0, high - message.offset() - 1)

    def commit_message(self, message: Message) -> None:
        self._consumer.commit(message=message, asynchronous=False)

    def publish_alert(self, alert: dict[str, Any]) -> None:
        payload = json.dumps(alert, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        self._producer.produce(
            topic=self._settings.kafka_topic_alerts,
            value=payload,
            headers={"content-type": "application/json", "schema": "alerts.failure-risk.v1"},
        )
        self._producer.poll(0)

    def close(self) -> None:
        self._producer.flush(5)
        self._consumer.close()
