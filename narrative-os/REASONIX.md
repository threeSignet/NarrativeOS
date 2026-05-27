# Reasonix project memory

Notes the user pinned via the `#` prompt prefix. The whole file is
loaded into the immutable system prefix every session — keep it terse.

- NarrativeOS infrastructure stack (local dev).
#
# All credentials come from ../.env.local (auto-loaded by docker compose
# when run via the root-level pnpm scripts that pass --env-file).

name: narrativeos

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: narrativeos-postgres
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      # Tune for dev workloads. Production tuning happens elsewhere.
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --locale=C.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "max_connections=100"
      - "-c"
      - "log_min_duration_statement=500"

  redis:
    image: redis:7.2-alpine
    container_name: narrativeos-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    command:
      - "redis-server"
      - "--requirepass"
      - "${REDIS_PASSWORD}"
      - "--maxmemory"
      - "256mb"
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--appendonly"
      - "yes"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "--no-auth-warning", "PING"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 5s

  minio:
    image: minio/minio:latest
    container_name: narrativeos-minio
    restart: unless-stopped
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: ["server", "/data", "--console-address", ":9001"]
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

volumes:
  postgres_data:
    name: narrativeos-postgres-data
  redis_data:
    name: narrativeos-redis-data
  minio_data:
    name: narrativeos-minio-data





# NarrativeOS production stack
# Differs from docker-compose.yml (dev) by:
#   - no published Postgres / Redis / MinIO ports（除非显式经 reverse proxy）
#   - adds the narrativeos-server service built from apps/server/Dockerfile
#   - explicit named network so reverse proxies can attach
#
# Run:
#   docker compose --env-file .env.production -f infra/docker-compose.prod.yml up -d --build
#
# 必须先准备 .env.production（参考 .env.example），并执行 migration：
#   pnpm db:migrate            # 在主机或一次性容器里

name: narrativeos-prod

networks:
  narrativeos:
    driver: bridge

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: narrativeos-postgres
    restart: unless-stopped
    networks: [narrativeos]
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --locale=C.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=512MB"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "log_min_duration_statement=200"

  redis:
    image: redis:7.2-alpine
    container_name: narrativeos-redis
    restart: unless-stopped
    networks: [narrativeos]
    command:
      - "redis-server"
      - "--requirepass"
      - "${REDIS_PASSWORD}"
      - "--maxmemory"
      - "1gb"
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--appendonly"
      - "yes"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "--no-auth-warning", "PING"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    container_name: narrativeos-minio
    restart: unless-stopped
    networks: [narrativeos]
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: ["server", "/data", "--console-address", ":9001"]
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 10

  server:
    build:
      context: ..
      dockerfile: apps/server/Dockerfile
    image: narrativeos/server:latest
    container_name: narrativeos-server
    restart: unless-stopped
    networks: [narrativeos]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      API_KEY: ${API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      LLM_PROVIDER: ${LLM_PROVIDER:-mock}
      LLM_API_KEY: ${LLM_API_KEY:-}
    ports:
      - "${SERVER_PORT:-3000}:3000"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))\""]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  postgres_data:
    name: narrativeos-postgres-data-prod
  redis_data:
    name: narrativeos-redis-data-prod
  minio_data:
    name: narrativeos-minio-data-prod
- ==================================================================
# NarrativeOS v3.0 — Local development credentials
# ==================================================================
# THIS FILE CONTAINS REAL SECRETS. DO NOT COMMIT.
# It is gitignored. To rotate credentials, regenerate with:
#   openssl rand -base64 24 | tr -d '/+=' | head -c 32
# and update both this file and docs/credentials.md.
# ==================================================================

# --- PostgreSQL 16 + pgvector ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=narrativeos
POSTGRES_PASSWORD=Tv7j1ACCEYhzEmySDO0rX4N1Tp4AFn
POSTGRES_DB=narrativeos
DATABASE_URL=postgresql://narrativeos:Tv7j1ACCEYhzEmySDO0rX4N1Tp4AFn@localhost:5432/narrativeos

# --- Redis 7.2 ---
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=ATT8834qWhvmcdT5cZboGHJYXRCOdE9r
REDIS_URL=redis://:ATT8834qWhvmcdT5cZboGHJYXRCOdE9r@localhost:6379

# --- MinIO (S3-compatible object storage) ---
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=narrativeos_admin
MINIO_ROOT_PASSWORD=wv99qbeSF4d4jh1s0okuqe10ikEqp0zN
MINIO_USE_SSL=false
MINIO_DEFAULT_BUCKET=narrativeos-assets

# --- Application secrets ---
# API key for service-to-service / CLI auth
API_KEY=dev-api-key-for-local-use
JWT_SECRET=Fiiknxai3oDAODelNSDtISFaB9OUSkJJsdPNQqHiLBXMXSmxXEsOpRDysvnxK9
NODE_ENV=development
LOG_LEVEL=debug

# --- LLM providers ---
DEEPSEEK_API_KEY=sk-e166794a3e6f4ce0b4a99dfa6e5fdb04
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-e166794a3e6f4ce0b4a99dfa6e5fdb04
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
USE_MOCK=false
MOCK_LLM=false
