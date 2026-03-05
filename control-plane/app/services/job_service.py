import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.job import Job


class JobService:
	@staticmethod
	def enqueue_job(db: Session, org_id: uuid.UUID, job_type: str, payload: dict) -> Job:
		job = Job(org_id=org_id, type=job_type, payload=payload, status="pending", attempts=0, run_at=datetime.now(UTC))
		db.add(job)
		db.commit()
		db.refresh(job)
		return job

	@staticmethod
	def claim_next_job(db: Session, org_id: uuid.UUID) -> Job | None:
		stmt = text(
			"""
			SELECT id FROM jobs
			WHERE org_id = :org_id AND status = 'pending' AND run_at <= now()
			ORDER BY run_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
			"""
		)
		row = db.execute(stmt, {"org_id": str(org_id)}).first()
		if not row:
			return None
		job = db.get(Job, row[0])
		if not job:
			return None
		job.status = "running"
		job.attempts += 1
		db.add(job)
		db.commit()
		db.refresh(job)
		return job

	@staticmethod
	def mark_job_failed_with_backoff(db: Session, job: Job, max_attempts: int = 5) -> Job:
		if job.attempts >= max_attempts:
			job.status = "failed"
		else:
			job.status = "pending"
			delay_seconds = 2 ** job.attempts
			job.run_at = datetime.now(UTC) + timedelta(seconds=delay_seconds)
		db.add(job)
		db.commit()
		db.refresh(job)
		return job

	@staticmethod
	def mark_job_completed(db: Session, job: Job) -> Job:
		job.status = "completed"
		db.add(job)
		db.commit()
		db.refresh(job)
		return job
