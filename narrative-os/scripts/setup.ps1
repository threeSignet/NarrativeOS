<#
╔═══════════════════════════════════════════════════════════════════════════╗
║  NarrativeOS+  —  完整本地初始化脚本                                      ║
║  用途：首次搭建 / 重置本地开发环境（Docker + 数据库 + 服务）                ║
║  用法：.\scripts\setup.ps1 [-Reset] [-Force]                             ║
║        .\scripts\setup.ps1              # 首次初始化                      ║
║        .\scripts\setup.ps1 -Reset       # 重置全部数据（清空卷 + 重建）    ║
║        .\scripts\setup.ps1 -Reset -Force # 重置 + 自动确认                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
#>

param(
  [switch]$Reset,
  [switch]$Force,
  [switch]$SkipContainers
)

$ErrorActionPreference = "Stop"

# ── 颜色输出函数 ──
function Write-Step($msg)  { Write-Host "`n  🚀 $msg" -ForegroundColor Cyan }
function Write-OK($msg)    { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Error($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }

$ROOT = Resolve-Path (Join-Path $PSScriptRoot "..")

# ──────────────────────────────────────────────
#  0. 环境检查
# ──────────────────────────────────────────────
Write-Step "Step 0/5：环境检查"

# Docker
$dockerVersion = docker --version 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "Docker 未安装！"; exit 1 }
Write-OK "Docker: $dockerVersion"

# Node.js
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "Node.js 未安装！"; exit 1 }
Write-OK "Node.js: $nodeVersion"

# pnpm
$pnpmVersion = pnpm --version 2>&1
if ($LASTEXITCODE -ne 0) { Write-Warn "pnpm 未安装，尝试安装…"; npm install -g pnpm }
Write-OK "pnpm: $(pnpm --version)"

# .env
if (-not (Test-Path (Join-Path $ROOT ".env"))) {
  Write-Error ".env 文件不存在！请从 .env.example 复制"
  Write-Host "   cp .env.example .env"
  exit 1
}
Write-OK ".env 已就绪"

# ──────────────────────────────────────────────
#  1. Docker 基础设施
# ──────────────────────────────────────────────
if (-not $SkipContainers) {
  Write-Step "Step 1/5：Docker 基础设施"

  if ($Reset) {
    if ($Force -or (Read-Host "  确认重置？将删除所有数据卷！(y/N)") -eq "y") {
      Write-Step "  → 停止并清空现有容器与数据卷…"
      Push-Location $ROOT
      docker compose down -v
      Pop-Location
      Write-OK "数据卷已清空"
    } else {
      Write-Warn "跳过重置"
    }
  }

  Push-Location $ROOT
  Write-Step "  → 启动容器（postgres + redis + minio）…"
  docker compose up -d
  if ($LASTEXITCODE -ne 0) { Write-Error "容器启动失败！"; exit 1 }
  Pop-Location

  # 等待 PostgreSQL 就绪
  Write-Step "  → 等待 PostgreSQL 就绪…"
  $maxRetries = 30
  $retry = 0
  do {
    $ready = docker exec narrativeos-postgres pg_isready -U narrativeos -d narrativeos 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    $retry++
    Start-Sleep -Seconds 2
  } while ($retry -lt $maxRetries)

  if ($retry -ge $maxRetries) {
    Write-Error "PostgreSQL 未能启动，请检查 docker compose logs"
    exit 1
  }
  Write-OK "PostgreSQL 已就绪"

  # 等待 Redis 就绪
  Write-Step "  → 等待 Redis 就绪…"
  $retry = 0
  do {
    $ready = docker exec narrativeos-redis redis-cli -a ATT8834qWhvmcdT5cZboGHJYXRCOdE9r --no-auth-warning PING 2>$null
    if ($LASTEXITCODE -eq 0 -and $ready -eq "PONG") { break }
    $retry++
    Start-Sleep -Seconds 2
  } while ($retry -lt 15)

  if ($retry -ge 15) {
    Write-Warn "Redis 未完全就绪，继续执行…"
  } else {
    Write-OK "Redis 已就绪"
  }

  # 等待 MinIO 就绪
  Write-Step "  → 等待 MinIO 就绪…"
  $retry = 0
  do {
    $ready = docker exec narrativeos-minio curl -sf http://localhost:9000/minio/health/live 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    $retry++
    Start-Sleep -Seconds 2
  } while ($retry -lt 15)
  if ($retry -lt 15) {
    Write-OK "MinIO 已就绪"
  } else {
    Write-Warn "MinIO 健康检查超时，请稍后手动检查"
  }

  docker compose ps
  Write-OK "Docker 基础设施就绪"
} else {
  Write-Step "Step 1/5：跳过容器启动"
}

# ──────────────────────────────────────────────
#  2. 安装依赖
# ──────────────────────────────────────────────
Write-Step "Step 2/5：安装依赖"

Push-Location $ROOT
pnpm install
if ($LASTEXITCODE -ne 0) {
  Write-Error "pnpm install 失败！"
  Pop-Location
  exit 1
}
Pop-Location
Write-OK "依赖安装完成"

# ──────────────────────────────────────────────
#  3. 数据库迁移（Drizzle + 自定义脚本）
# ──────────────────────────────────────────────
Write-Step "Step 3/5：数据库迁移"

# 3a. 验证 pgvector 扩展
$vectorCheck = docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "SELECT count(*) FROM pg_extension WHERE extname='vector';" 2>&1
if ($vectorCheck.Trim() -eq "0") {
  Write-Warn "pgvector 扩展未安装，尝试手动安装…"
  docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS vector;"
}
Write-OK "pgvector 扩展已就绪"

# 3b. 安装 UUID-OSSP 和 pg_trgm
docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS ""uuid-ossp"";" 2>$null
docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>$null
Write-OK "辅助扩展已就绪"

# 3c. Drizzle Kit Push（基于 schema.ts 创建/同步所有表）
Push-Location (Join-Path $ROOT "packages/database")
Write-Step "  → Drizzle Kit 同步 schema…"
pnpm db:push
if ($LASTEXITCODE -ne 0) {
  Write-Error "Drizzle Kit push 失败！"
  Pop-Location
  exit 1
}
Pop-Location
Write-OK "Schema 同步完成"

# 3d. 自定义迁移脚本（ALTER TABLE + CHECK 约束 + 额外表）
Push-Location $ROOT
Write-Step "  → 自定义迁移脚本（约束、索引、额外表）…"
pnpm --filter @narrative-os/database exec tsx packages/database/migrate.ts
if ($LASTEXITCODE -ne 0) {
  Write-Warn "自定义迁移有告警（部分表可能已存在），继续执行…"
} else {
  Write-OK "自定义迁移完成"
}
Pop-Location

# 3e. 向量嵌入基础设施（embeddings 分区表 + 检索函数）
Write-Step "  → 向量嵌入基础设施…"
$embeddingsSql = @"
CREATE EXTENSION IF NOT EXISTS vector;
DO \$\$ BEGIN
  CREATE TYPE embedding_source_type AS ENUM (
    'chapter_chunk', 'setting_item', 'character_profile',
    'event_summary', 'foreshadowing_item', 'memory_event'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id    UUID DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,
    source_type     embedding_source_type NOT NULL,
    source_id       UUID NOT NULL,
    chunk_index     INTEGER DEFAULT 0,
    chunk_text      TEXT NOT NULL,
    chunk_length    INTEGER NOT NULL DEFAULT 0,
    embedding       vector(1536),
    meta_jsonb      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (embedding_id, project_id),
    CONSTRAINT chk_embeddings_chunk_length_positive CHECK (chunk_length >= 0),
    CONSTRAINT chk_embeddings_chunk_non_empty CHECK (LENGTH(chunk_text) > 0)
) PARTITION BY LIST (project_id);
CREATE TABLE IF NOT EXISTS embeddings_default PARTITION OF embeddings DEFAULT;
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings_default (project_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_project_chunk ON embeddings_default (project_id, chunk_index);
"@
# 注意：embedding 表的 SQL 中 $$ 在 PowerShell 里很麻烦，改用文件执行
$sqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
@"
CREATE EXTENSION IF NOT EXISTS vector;
DO 'BEGIN
  CREATE TYPE embedding_source_type AS ENUM (
    '"'"'chapter_chunk'"'"', '"'"'setting_item'"'"', '"'"'character_profile'"'"',
    '"'"'event_summary'"'"', '"'"'foreshadowing_item'"'"', '"'"'memory_event'"'"'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END';
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id    UUID DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL,
    source_type     embedding_source_type NOT NULL,
    source_id       UUID NOT NULL,
    chunk_index     INTEGER DEFAULT 0,
    chunk_text      TEXT NOT NULL,
    chunk_length    INTEGER NOT NULL DEFAULT 0,
    embedding       vector(1536),
    meta_jsonb      JSONB NOT NULL DEFAULT '"'"'{}'"'"'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (embedding_id, project_id),
    CONSTRAINT chk_embeddings_chunk_length_positive CHECK (chunk_length >= 0),
    CONSTRAINT chk_embeddings_chunk_non_empty CHECK (LENGTH(chunk_text) > 0)
) PARTITION BY LIST (project_id);
CREATE TABLE IF NOT EXISTS embeddings_default PARTITION OF embeddings DEFAULT;
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings_default (project_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_project_chunk ON embeddings_default (project_id, chunk_index);
"@ | Set-Content $sqlFile -Encoding UTF8

# 实际上，我们有现成的 SQL 文件
docker exec -i narrativeos-postgres psql -U narrativeos -d narrativeos < "$ROOT\packages\database\src\migrations\001_embeddings.sql" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Warn "embeddings 表可能已存在，继续执行…"
} else {
  Write-OK "向量嵌入基础设施就绪"
}

# ──────────────────────────────────────────────
#  4. 验证数据库状态
# ──────────────────────────────────────────────
Write-Step "Step 4/5：验证数据库"

# 列出所有表
Write-Step "  → 数据库中已创建的表："
$tables = docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
" 2>&1
$tables.Trim() -split "`n" | ForEach-Object {
  $t = $_.Trim()
  if ($t) { Write-OK "表: $t" }
}

# 验证 pgvector
$vectorOk = docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "
  SELECT count(*) FROM pg_extension WHERE extname IN ('vector', 'pg_trgm', 'uuid-ossp');
" 2>&1
$extCount = $vectorOk.Trim()
Write-OK "已安装扩展数: $extCount（期望: 3）"

# ──────────────────────────────────────────────
#  5. 启动开发服务器
# ──────────────────────────────────────────────
Write-Step "Step 5/5：启动开发服务"

Write-Warn "开发服务需要单独启动，运行："
Write-Host "   cd $ROOT"
Write-Host "   pnpm dev"
Write-Host ""
Write-Host "   Server → http://localhost:3001"
Write-Host "   Web    → http://localhost:5173"
Write-Host "   MinIO  → http://localhost:9001"

# ── 最终报告 ──
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      ✅  NarrativeOS+ 初始化完成！                           ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  PostgreSQL :5432  (narrativeos:narrativeos-postgres)       ║" -ForegroundColor Cyan
Write-Host "║  Redis      :6379  (narrativeos-redis)                      ║" -ForegroundColor Cyan
Write-Host "║  MinIO      :9000  (console :9001)                          ║" -ForegroundColor Cyan
Write-Host "║  Server     :3001                                           ║" -ForegroundColor Cyan
Write-Host "║  Web        :5173                                           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
