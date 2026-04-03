import json
import logging
import threading
import time

import httpx
from confluent_kafka import Consumer, KafkaError
from confluent_kafka.admin import AdminClient, NewTopic

from app.core.config import Settings


class AlertSubscriber:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._logger = logging.getLogger("apicortex.alert-subscriber")
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._consumer: Consumer | None = None
        self._last_missing_topic_log_at = 0.0

    def start(self) -> None:
        if not self._settings.alert_subscriber_enabled:
            return

        config: dict[str, object] = {
            "bootstrap.servers": ",".join(self._settings.kafka_brokers),
            "group.id": self._settings.kafka_alerts_group_id,
            "auto.offset.reset": "latest",
            "enable.auto.commit": False,
        }

        if self._settings.kafka_ca_cert and self._settings.kafka_service_cert and self._settings.kafka_service_key:
            config.update(
                {
                    "security.protocol": "ssl",
                    "ssl.ca.pem": self._settings.kafka_ca_cert,
                    "ssl.certificate.pem": self._settings.kafka_service_cert,
                    "ssl.key.pem": self._settings.kafka_service_key,
                }
            )

        self._ensure_topic(config)

        self._consumer = Consumer(config)
        self._consumer.subscribe([self._settings.kafka_topic_alerts])
        self._thread = threading.Thread(target=self._run, name="alert-subscriber", daemon=True)
        self._thread.start()

    def _ensure_topic(self, config: dict[str, object]) -> None:
        topic = self._settings.kafka_topic_alerts
        admin_config: dict[str, object] = {
            "bootstrap.servers": config["bootstrap.servers"],
        }

        if "security.protocol" in config:
            admin_config["security.protocol"] = config["security.protocol"]
        if "ssl.ca.pem" in config:
            admin_config["ssl.ca.pem"] = config["ssl.ca.pem"]
        if "ssl.certificate.pem" in config:
            admin_config["ssl.certificate.pem"] = config["ssl.certificate.pem"]
        if "ssl.key.pem" in config:
            admin_config["ssl.key.pem"] = config["ssl.key.pem"]

        admin = AdminClient(admin_config)

        try:
            metadata = admin.list_topics(timeout=10)
            if topic in metadata.topics and metadata.topics[topic].error is None:
                return
        except Exception as exc:
            self._logger.warning("Kafka metadata check failed for topic %s: %s", topic, exc)

        futures = admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=1)])
        future = futures.get(topic)
        if future is None:
            return

        try:
            future.result(10)
            self._logger.info("Kafka topic ensured: %s", topic)
        except Exception as exc:
            if "TOPIC_ALREADY_EXISTS" not in str(exc):
                self._logger.warning("Kafka topic ensure failed for %s: %s", topic, exc)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        if self._consumer:
            self._consumer.close()

    def _run(self) -> None:
        while not self._stop_event.is_set():
            if not self._consumer:
                return
            message = self._consumer.poll(self._settings.alert_poll_timeout_seconds)
            if message is None:
                continue
            if message.error():
                if message.error().code() == KafkaError._PARTITION_EOF:
                    continue
                unknown_topic_code = getattr(KafkaError, "UNKNOWN_TOPIC_OR_PART", None)
                if unknown_topic_code is not None and message.error().code() == unknown_topic_code:
                    now = time.monotonic()
                    if now-self._last_missing_topic_log_at >= 10:
                        self._logger.warning(
                            "Alert topic unavailable: %s. Waiting for topic to exist.",
                            self._settings.kafka_topic_alerts,
                        )
                        self._last_missing_topic_log_at = now
                    continue
                self._logger.error("Alert topic consume error: %s", message.error())
                continue
            try:
                payload = json.loads((message.value() or b"{}").decode("utf-8"))
            except Exception as exc:
                self._logger.error("Invalid alert payload: %s", exc)
                self._consumer.commit(message=message, asynchronous=False)
                continue

            self._dispatch(payload)
            self._consumer.commit(message=message, asynchronous=False)

    def _dispatch(self, payload: dict) -> None:
        if not self._settings.alert_webhook_url:
            self._logger.warning("Alert received with no webhook configured: %s", json.dumps(payload, ensure_ascii=True))
            return
        try:
            response = httpx.post(self._settings.alert_webhook_url, json=payload, timeout=5.0)
            if response.status_code >= 400:
                self._logger.error("Alert webhook failed: status=%s body=%s", response.status_code, response.text)
        except Exception as exc:
            self._logger.error("Alert webhook delivery error: %s", exc)
