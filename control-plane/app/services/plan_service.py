import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.api import API


class PlanService:
    limits = {
        "free": 1,
        "pro": 10,
        "business": None,
    }

    @classmethod
    def check_api_quota(cls, db: Session, org_id: uuid.UUID, plan: str) -> bool:
        limit = cls.limits.get((plan or "free").lower(), 1)
        if limit is None:
            return True
        count = db.scalar(select(func.count(API.id)).where(API.org_id == org_id)) or 0
        return count < limit
