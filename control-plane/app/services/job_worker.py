import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.services.contract_service import ContractService
from app.services.job_service import JobService


class JobWorker:
    def __init__(self, poll_interval_seconds: float = 2.0, cleanup_interval_minutes: int = 60) -> None:
        self.poll_interval_seconds = poll_interval_seconds
        self.cleanup_interval = timedelta(minutes=cleanup_interval_minutes)
        self._last_cleanup = datetime.now(UTC)

    async def run(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            processed = False
            with SessionLocal() as db:
                job = JobService.claim_next_available_job(db)
                if job:
                    processed = True
                    try:
                        self._process_job(db, job.type, job.org_id, job.payload or {})
                        JobService.mark_job_completed(db, job)
                    except Exception:
                        JobService.mark_job_failed_with_backoff(db, job)
                now = datetime.now(UTC)
                if now - self._last_cleanup >= self.cleanup_interval:
                    JobService.delete_old_terminal_jobs(db)
                    self._last_cleanup = now

            if processed:
                continue

            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.poll_interval_seconds)
            except TimeoutError:
                pass

    def _process_job(self, db: Session, job_type: str, org_id: uuid.UUID, payload: dict) -> None:
        if job_type == "openapi_contract_sync":
            api_id = uuid.UUID(str(payload["api_id"]))
            spec_id = uuid.UUID(str(payload["spec_id"]))
            ContractService.sync_contracts_from_openapi(
                db=db,
                org_id=org_id,
                api_id=api_id,
                spec_id=spec_id,
            )
            return
        raise ValueError(f"Unsupported job type: {job_type}")
