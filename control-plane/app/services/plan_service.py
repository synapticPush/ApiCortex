import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.api import API
from app.models.feature_flag import FeatureFlag


class PlanService:
    limits = {
        "free": 1,
        "pro": 10,
        "business": None,
    }

    @classmethod
    def resolve_api_quota_limit(cls, db: Session, plan: str) -> int | None:
        normalized_plan = (plan or "free").lower()
        dynamic_limit = db.scalar(
            select(FeatureFlag.limit).where(
                FeatureFlag.plan == normalized_plan,
                FeatureFlag.feature_key == "api_quota",
                FeatureFlag.enabled.is_(True),
            )
        )
        if dynamic_limit is not None:
            return int(dynamic_limit)
        return cls.limits.get(normalized_plan, 1)

    @classmethod
    def check_api_quota(cls, db: Session, org_id: uuid.UUID, plan: str) -> bool:
        limit = cls.resolve_api_quota_limit(db, plan)
        if limit is None:
            return True
        count = db.scalar(select(func.count(API.id)).where(API.org_id == org_id)) or 0
        return count < limit
