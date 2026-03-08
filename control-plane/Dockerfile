FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-compile -r requirements.txt && \
    find /opt/venv -type d -name "__pycache__" -prune -exec rm -rf {} + && \
    find /opt/venv -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

RUN groupadd --system appuser && \
    useradd --system --gid appuser --create-home --home-dir /home/appuser appuser

COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appuser app ./app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]