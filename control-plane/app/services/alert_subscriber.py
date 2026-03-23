import json
import logging
import threading

import httpx
from confluent_kafka import Consumer, KafkaError

from app.core.config import Settings


class AlertSubscriber:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._logger = logging.getLogger("apicortex.alert-subscriber")
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._consumer: Consumer | None = None

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

        self._consumer = Consumer(config)
        self._consumer.subscribe([self._settings.kafka_topic_alerts])
        self._thread = threading.Thread(target=self._run, name="alert-subscriber", daemon=True)
        self._thread.start()

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
