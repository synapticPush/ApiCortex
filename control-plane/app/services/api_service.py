import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.api import API
from app.models.endpoint import Endpoint
from app.schemas.api import APICreate, EndpointCreate


class APIService:
    @staticmethod
    def list_apis(db: Session, org_id: uuid.UUID) -> list[API]:
        return list(db.scalars(select(API).where(API.org_id == org_id).order_by(API.created_at.desc())).all())

    @staticmethod
    def create_api(db: Session, org_id: uuid.UUID, payload: APICreate) -> API:
        api = API(org_id=org_id, name=payload.name, base_url=str(payload.base_url))
        db.add(api)
        db.commit()
        db.refresh(api)
        return api

    @staticmethod
    def create_endpoint(db: Session, org_id: uuid.UUID, api_id: uuid.UUID, payload: EndpointCreate) -> Endpoint:
        api = db.scalar(select(API).where(API.id == api_id, API.org_id == org_id))
        if not api:
            raise ValueError("API not found")
        method = payload.method.upper()
        exists = db.scalar(
            select(Endpoint).where(
                Endpoint.api_id == api_id,
                Endpoint.path == payload.path,
                Endpoint.method == method,
                Endpoint.org_id == org_id,
            )
        )
        if exists:
            raise ValueError("Duplicate endpoint path + method for API")
        endpoint = Endpoint(api_id=api_id, org_id=org_id, path=payload.path, method=method)
        db.add(endpoint)
        db.commit()
        db.refresh(endpoint)
        return endpoint

    @staticmethod
    def list_endpoints(db: Session, org_id: uuid.UUID, api_id: uuid.UUID) -> list[Endpoint]:
        return list(
            db.scalars(select(Endpoint).where(Endpoint.org_id == org_id, Endpoint.api_id == api_id).order_by(Endpoint.created_at.desc())).all()
        )
