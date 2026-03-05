from pydantic import Field
from pydantic import field_validator
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ApiCortex Control Plane"
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    app_env: str = Field(default="dev", validation_alias="APP_ENV")
    debug: bool = Field(default=False, validation_alias="DEBUG")

    database_url: str = Field(default="", validation_alias="DATABASE")
    timescale_url: str = Field(default="", validation_alias="TIMESCALE_DATABASE")
    auto_create_tables: bool | None = Field(default=None, validation_alias="AUTO_CREATE_TABLES")

    jwt_algorithm: str = Field(default="RS256", validation_alias="JWT_ALGORITHM")
    jwt_private_key: str = Field(default="", validation_alias="JWT_PRIVATE_KEY")
    jwt_public_key: str = Field(default="", validation_alias="JWT_PUBLIC_KEY")
    jwt_private_key_path: str = Field(default="", validation_alias="JWT_PRIVATE_KEY_PATH")
    jwt_public_key_path: str = Field(default="", validation_alias="JWT_PUBLIC_KEY_PATH")
    jwt_secret_key: str = Field(default="", validation_alias="JWT_SECRET_KEY")
    access_token_exp_minutes: int = Field(default=15, validation_alias="ACCESS_TOKEN_EXP_MINUTES")
    refresh_token_exp_days: int = Field(default=7, validation_alias="REFRESH_TOKEN_EXP_DAYS")

    access_cookie_name: str = Field(default="acx_access", validation_alias="ACCESS_COOKIE_NAME")
    refresh_cookie_name: str = Field(default="acx_refresh", validation_alias="REFRESH_COOKIE_NAME")
    csrf_cookie_name: str = Field(default="acx_csrf", validation_alias="CSRF_COOKIE_NAME")
    csrf_header_name: str = Field(default="X-CSRF-Token", validation_alias="CSRF_HEADER_NAME")

    secure_cookies: bool | None = Field(default=None, validation_alias="SECURE_COOKIES")
    cookie_samesite: str = Field(default="lax", validation_alias="COOKIE_SAMESITE")
    cookie_domain: str | None = Field(default=None, validation_alias="COOKIE_DOMAIN")

    trusted_hosts: list[str] = Field(default_factory=lambda: ["*"], validation_alias="TRUSTED_HOSTS")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"], validation_alias="CORS_ORIGINS")

    rate_limit_per_minute: int = Field(default=120, validation_alias="RATE_LIMIT_PER_MINUTE")

    oauth_google_client_id: str = Field(default="", validation_alias="OAUTH_GOOGLE_CLIENT_ID")
    oauth_google_client_secret: str = Field(default="", validation_alias="OAUTH_GOOGLE_CLIENT_SECRET")
    oauth_github_client_id: str = Field(default="", validation_alias="OAUTH_GITHUB_CLIENT_ID")
    oauth_github_client_secret: str = Field(default="", validation_alias="OAUTH_GITHUB_CLIENT_SECRET")
    oauth_redirect_base_url: str = Field(default="http://localhost:8000", validation_alias="OAUTH_REDIRECT_BASE_URL")
    session_secret_key: str = Field(default="dev-session-secret-change-in-prod", validation_alias="SESSION_SECRET_KEY")

    @field_validator("app_env", mode="before")
    @classmethod
    def normalize_app_env(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized in {"production", "prod"}:
            return "prod"
        if normalized in {"development", "dev", "local"}:
            return "dev"
        return "dev"

    @field_validator("jwt_algorithm", mode="before")
    @classmethod
    def normalize_jwt_algorithm(cls, value: str) -> str:
        return str(value).strip().upper()

    @field_validator("cookie_samesite", mode="before")
    @classmethod
    def normalize_cookie_samesite(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized not in {"lax", "strict", "none"}:
            return "lax"
        return normalized

    @field_validator("trusted_hosts", "cors_origins", mode="before")
    @classmethod
    def parse_list_from_env(cls, value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                return []
            if trimmed.startswith("["):
                parsed = json.loads(trimmed)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [item.strip() for item in trimmed.split(",") if item.strip()]
        return value

    @field_validator("jwt_private_key", mode="after")
    @classmethod
    def load_private_key_from_path(cls, value: str, info) -> str:
        if value:
            return value.strip()
        path = str(info.data.get("jwt_private_key_path", "")).strip()
        if path:
            resolved = Path(path)
            if not resolved.is_absolute():
                resolved = Path(__file__).resolve().parents[3] / path
            if resolved.exists():
                return resolved.read_text(encoding="utf-8").strip()
        return value

    @field_validator("jwt_public_key", mode="after")
    @classmethod
    def load_public_key_from_path(cls, value: str, info) -> str:
        if value:
            return value.strip()
        path = str(info.data.get("jwt_public_key_path", "")).strip()
        if path:
            resolved = Path(path)
            if not resolved.is_absolute():
                resolved = Path(__file__).resolve().parents[3] / path
            if resolved.exists():
                return resolved.read_text(encoding="utf-8").strip()
        return value

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.app_env == "prod"

    @computed_field
    @property
    def should_auto_create_tables(self) -> bool:
        if self.auto_create_tables is not None:
            return self.auto_create_tables
        return self.app_env == "dev"

    @computed_field
    @property
    def use_secure_cookies(self) -> bool:
        if self.secure_cookies is not None:
            return self.secure_cookies
        return self.is_production

    @computed_field
    @property
    def effective_jwt_algorithm(self) -> str:
        if self.jwt_algorithm.startswith("RS") and not (self.jwt_private_key and self.jwt_public_key):
            if self.app_env == "dev":
                return "HS256"
        return self.jwt_algorithm

    @computed_field
    @property
    def effective_jwt_private_key(self) -> str:
        if self.effective_jwt_algorithm.startswith("RS") and self.jwt_private_key:
            return self.jwt_private_key
        if self.effective_jwt_algorithm.startswith("HS"):
            if self.jwt_secret_key:
                return self.jwt_secret_key
            return self.session_secret_key
        return ""

    @computed_field
    @property
    def effective_jwt_public_key(self) -> str:
        if self.effective_jwt_algorithm.startswith("RS") and self.jwt_public_key:
            return self.jwt_public_key
        if self.effective_jwt_algorithm.startswith("HS"):
            if self.jwt_secret_key:
                return self.jwt_secret_key
            return self.session_secret_key
        return ""

    @field_validator("database_url", "timescale_url", mode="before")
    @classmethod
    def normalize_sqlalchemy_db_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        normalized = value.strip().strip('"').strip("'")
        if normalized.startswith("postgres://"):
            return normalized.replace("postgres://", "postgresql+psycopg2://", 1)
        if normalized.startswith("postgresql://") and "+" not in normalized.split("://", 1)[0]:
            return normalized.replace("postgresql://", "postgresql+psycopg2://", 1)
        return normalized


settings = Settings()
