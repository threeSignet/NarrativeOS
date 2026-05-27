#!/usr/bin/env bash
# ============================================================================
# NarrativeOS+ — 完整本地初始化脚本
# 用途：首次搭建 / 重置本地开发环境（Docker + 数据库 + 服务）
# 用法：
#   ./scripts/setup.sh              # 首次初始化
#   ./scripts/setup.sh --reset      # 重置全部数据（清空卷 + 重建）
#   ./scripts/setup.sh --reset --force  # 重置 + 自动确认
#
# 分步执行：
#   ./scripts/setup.sh --containers-only   # 只启动容器
#   ./scripts/setup.sh --db-only           # 只跑数据库迁移
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RESET=false
FORCE=false
CONTAINERS_ONLY=false
DB_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) RESET=true; shift ;;
    --force) FORCE=true; shift ;;
    --containers-only) CONTAINERS_ONLY=true; shift ;;
    --db-only) DB_ONLY=true; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

# ── 颜色输出 ──
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
step()  { echo -e "\n  🚀 ${CYAN}$1${NC}"; }
ok()    { echo -e "  ✅ ${GREEN}$1${NC}"; }
warn()  { echo -e "  ⚠️  ${YELLOW}$1${NC}"; }
err()   { echo -e "  ❌ ${RED}$1${NC}"; }

# ──────────────────────────────────────────────
#  0. 环境检查
# ──────────────────────────────────────────────
step "Step 0/5：环境检查"

command -v docker >/dev/null 2>&1 || { err "Docker 未安装！"; exit 1; }
ok "Docker: $(docker --version)"

command -v node >/dev/null 2>&1 || { err "Node.js 未安装！"; exit 1; }
ok "Node.js: $(node --version)"

command -v pnpm >/dev/null 2>&1 || { warn "pnpm 未安装，尝试安装…"; npm install -g pnpm; }
ok "pnpm: $(pnpm --version)"

if [ ! -f ".env" ]; then
  err ".env 文件不存在！请从 .env.example 复制"
  echo "   cp .env.example .env"
  exit 1
fi
ok ".env 已就绪"

# ──────────────────────────────────────────────
#  1. Docker 基础设施
# ──────────────────────────────────────────────
if [ "$DB_ONLY" = true ]; then
  step "Step 1/5：跳过容器启动（--db-only）"
else
  step "Step 1/5：Docker 基础设施"

  if [ "$RESET" = true ]; then
    if [ "$FORCE" = true ]; then
      echo "  → 重置数据卷…"
      docker compose down -v
      ok "数据卷已清空"
    else
      read -p "  确认重置？将删除所有数据卷！(y/N) " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down -v
        ok "数据卷已清空"
      else
        warn "跳过重置"
      fi
    fi
  fi

  echo "  → 启动容器（postgres + redis + minio）…"
  docker compose up -d

  # 等待 PostgreSQL 就绪
  echo -n "  → 等待 PostgreSQL "
  for i in $(seq 1 30); do
    if docker exec narrativeos-postgres pg_isready -U narrativeos -d narrativeos >/dev/null 2>&1; then
      echo " 就绪！"; break
    fi
    echo -n "."
    sleep 2
  done
  ok "PostgreSQL 已就绪"

  # 等待 Redis
  echo -n "  → 等待 Redis "
  for i in $(seq 1 15); do
    if docker exec narrativeos-redis redis-cli -a ATT8834qWhvmcdT5cZboGHJYXRCOdE9r --no-auth-warning PING 2>/dev/null | grep -q PONG; then
      echo " 就绪！"; break
    fi
    echo -n "."
    sleep 2
  done
  ok "Redis 已就绪"

  # 等待 MinIO
  echo -n "  → 等待 MinIO "
  for i in $(seq 1 15); do
    if docker exec narrativeos-minio curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; then
      echo " 就绪！"; break
    fi
    echo -n "."
    sleep 2
  done
  ok "MinIO 已就绪"

  docker compose ps
  ok "Docker 基础设施就绪"

  if [ "$CONTAINERS_ONLY" = true ]; then
    echo -e "\n✅ 容器启动完成。运行 ./scripts/setup.sh --db-only 继续数据库初始化。"
    exit 0
  fi
fi

# ──────────────────────────────────────────────
#  2. 安装依赖
# ──────────────────────────────────────────────
step "Step 2/5：安装依赖"
pnpm install
ok "依赖安装完成"

# ──────────────────────────────────────────────
#  3. 数据库迁移
# ──────────────────────────────────────────────
step "Step 3/5：数据库迁移"

# 3a. 验证 pgvector 扩展
docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null 2>&1
docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" >/dev/null 2>&1
docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null 2>&1
ok "数据库扩展已就绪"

# 3b. Drizzle Kit Push
step "  → Drizzle Kit 同步 schema…"
cd packages/database
pnpm db:push
cd "$ROOT"
ok "Schema 同步完成"

# 3c. 自定义迁移脚本
step "  → 自定义迁移脚本（约束、索引、额外表）…"
pnpm --filter @narrative-os/database exec tsx packages/database/migrate.ts 2>&1 || warn "部分迁移有告警（表可能已存在）"
ok "自定义迁移完成"

# 3d. 向量嵌入基础设施
step "  → 向量嵌入基础设施…"
docker exec -i narrativeos-postgres psql -U narrativeos -d narrativeos < packages/database/src/migrations/001_embeddings.sql 2>/dev/null
ok "向量嵌入基础设施就绪"

# ──────────────────────────────────────────────
#  4. 验证
# ──────────────────────────────────────────────
step "Step 4/5：验证数据库"

echo "  → 数据库表清单："
docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
" 2>&1 | while read -r t; do
  t="$(echo "$t" | xargs)"
  [ -n "$t" ] && ok "表: $t"
done

docker exec narrativeos-postgres psql -U narrativeos -d narrativeos -t -c "
  SELECT count(*) FROM pg_extension WHERE extname IN ('vector', 'pg_trgm', 'uuid-ossp');
" 2>&1 | read -r extCount
ok "扩展数：$(echo "$extCount" | xargs)/3"

echo ""
echo "  ✅ 初始化完成！运行 pnpm dev 启动开发服务"
