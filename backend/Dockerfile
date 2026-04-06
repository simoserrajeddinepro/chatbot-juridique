# ============================================
# Backend Dockerfile - FastAPI (Multi-stage)
# Build context: project root
# ============================================

# --- Stage 1: Base with Python dependencies ---
FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: Development (hot reload via uvicorn) ---
FROM base AS dev

COPY backend/ /app/backend/

RUN mkdir -p /app/documents_juridiques && \
    ln -sf /app/documents_juridiques /app/backend/documents_juridiques

RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- Stage 3: Production (gunicorn + uvicorn workers) ---
FROM base AS production

COPY backend/ /app/backend/

RUN mkdir -p /app/documents_juridiques && \
    ln -sf /app/documents_juridiques /app/backend/documents_juridiques

RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

WORKDIR /app/backend
EXPOSE 8000

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120"]
