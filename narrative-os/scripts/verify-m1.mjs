#!/usr/bin/env node
/**
 * M1 验收脚本 — 验证骨架立起 + 端到端通路
 *
 * 运行方式：
 *   pnpm db:up      # 启动数据库
 *   pnpm dev        # 启动前后端（另一个终端）
 *   node scripts/verify-m1.mjs
 *
 * 验收项（对应重构起点_v2.md Phase 0+1）：
 *   1. Health 端点可访问
 *   2. 创建项目
 *   3. 获取项目详情
 *   4. 项目状态为 hatching
 *   5. 设定集锁定 → status = active
 *   6. 获取 setting_items（为空但接口通）
 *   7. 获取 proposals（为空但接口通）
 */

const BASE = process.env.API_BASE || "http://localhost:3001";

async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`[${res.status}] ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

function log(step, ok, detail) {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${step}${detail ? " — " + detail : ""}`);
}

let projectId = null;

async function main() {
  console.log("=== NarrativeOS M1 验收 ===\n");

  // 1. Health
  try {
    const health = await request("/health");
    log("Health 端点", health.ok, `db=${health.db}, ws=${health.wsConnections}`);
  } catch (e) {
    log("Health 端点", false, e.message);
    console.log("\n⚠️  后端未启动，请先运行 pnpm dev");
    process.exit(1);
  }

  // 2. 创建项目
  try {
    const project = await request("/projects", {
      method: "POST",
      body: JSON.stringify({
        title: "M1 验收项目",
        genre: "修仙",
        style: "热血升级流",
        target_words: 1000000,
        core_creativity: "凡人逆天改命",
      }),
    });
    projectId = project.id;
    log("创建项目", true, `id=${projectId}, status=${project.status}`);
  } catch (e) {
    log("创建项目", false, e.message);
    process.exit(1);
  }

  // 3. 获取项目详情
  try {
    const project = await request(`/projects/${projectId}`);
    log("获取项目", true, `title=${project.title}, status=${project.status}`);
  } catch (e) {
    log("获取项目", false, e.message);
  }

  // 4. 验证初始状态为 hatching
  try {
    const project = await request(`/projects/${projectId}`);
    const ok = project.status === "hatching";
    log("初始状态 = hatching", ok, `实际=${project.status}`);
  } catch (e) {
    log("初始状态检查", false, e.message);
  }

  // 5. 获取 setting_items 接口
  try {
    const settings = await request(`/settings/${projectId}`);
    log("设定集接口", true, `locked=${settings.locked}, items=${settings.items?.length ?? 0}`);
  } catch (e) {
    log("设定集接口", false, e.message);
  }

  // 6. 获取 proposals 接口
  try {
    const res = await request(`/hatch/${projectId}/proposals`);
    log("提案接口", true, `count=${res.proposals?.length ?? 0}`);
  } catch (e) {
    log("提案接口", false, e.message);
  }

  // 7. 设定集锁定 → active
  try {
    const activated = await request(`/projects/${projectId}/activate`, { method: "POST", body: "{}" });
    const ok = activated.status === "active";
    log("设定集锁定 → active", ok, `status=${activated.status}`);
  } catch (e) {
    log("设定集锁定", false, e.message);
  }

  // 8. 确认锁定后 setting_items 返回 locked=true
  try {
    const settings = await request(`/settings/${projectId}`);
    log("锁定后设定集状态", settings.locked, `locked=${settings.locked}`);
  } catch (e) {
    log("锁定后设定集状态", false, e.message);
  }

  console.log("\n=== M1 验收完成 ===");
  console.log("若要验证完整孵化链路，请打开前端 http://localhost:5173");
  console.log("手动操作：创建项目 → 开始孵化 → 审批提案 → 设定集锁定");
}

main().catch((e) => {
  console.error("脚本异常:", e);
  process.exit(1);
});
