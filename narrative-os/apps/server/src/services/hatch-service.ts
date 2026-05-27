/**
 * Hatching 服务层 — 引擎调度的共享业务逻辑
 *
 * 从 hatch.ts 路由层抽离的纯业务逻辑函数，解决路由层逻辑耦合问题。
 * 路由层仅负责 HTTP 参数解析和 SSE 推送，所有校验逻辑委托给此模块。
 */
import { getEngineDef } from "@narrative-os/engines";
import { db, projects, aiProposals, settingItems, projectScales, sessions } from "@narrative-os/database";
import { eq, and } from "drizzle-orm";

// ── 工具函数 ──

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(id: string): boolean {
  return UUID_RE.test(id);
}

// ── 依赖校验 ──

export interface DependencyCheckResult {
  satisfied: boolean;
  missingDeps: string[];
}

/**
 * 校验引擎的前置依赖是否已确认。
 *
 * 非细化模式下，确保前置引擎的产出已确认，
 * 防止前端因状态同步延迟而触发依赖未满足的引擎。
 *
 * scale_design 引擎的数据存储在 project_scales 表而非 settingItems 表，
 * 需要额外查询尺度数据以正确判断依赖是否满足。
 */
export async function validateDependencies(
  projectId: string,
  engineName: string,
): Promise<DependencyCheckResult> {
  const engineDef = getEngineDef(engineName);
  if (!engineDef || engineDef.dependsOn.length === 0) {
    return { satisfied: true, missingDeps: [] };
  }

  // 查询已确认的 engineSource（对应引擎 name）
  const confirmed = await db
    .select({ engineSource: settingItems.engineSource })
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed"),
      ),
    );

  const confirmedSources = new Set(
    confirmed.map((i) => i.engineSource).filter(Boolean) as string[],
  );

  // 注意：scale_design 已合入 geography 引擎，project_scales 表由 geography 的审批 handler 写入
  // 不再需要独立的 scale-designer 检查

  const missing = engineDef.dependsOn.filter((dep) => !confirmedSources.has(dep));
  return {
    satisfied: missing.length === 0,
    missingDeps: missing,
  };
}

// ── 防重复运行检查 ──
// 注意：防重守卫已移除。孵化阶段流程完全由后端状态机（scheduler.getNextPhase()）控制，
// 前端通过 /hatch/:id/advance 单一入口推进，不存在重复运行的可能。

// ── 引擎执行结果类型 ──

export interface EngineExecResult {
  success: boolean;
  sessionId: string;
  engine: string;
  proposalCount: number;
  proposals: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    reasoning: string;
  }>;
}

// ── 会话创建 ──

// ── 引擎状态查询 ──

/**
 * 查询项目所有孵化引擎的状态（含数据量、pending 状态）。
 * 用于前端引擎状态面板的渲染数据。
 */
export async function queryEngineStates(projectId: string) {
  const items = await db
    .select()
    .from(settingItems)
    .where(
      and(
        eq(settingItems.projectId, projectId),
        eq(settingItems.status, "confirmed"),
      ),
    );

  // 按类型分组
  const byType: Record<string, typeof items> = {};
  for (const item of items) {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  }

  // 查询 pending proposals（正在生成中）
  const pending = await db
    .select()
    .from(aiProposals)
    .where(
      and(
        eq(aiProposals.projectId, projectId),
        eq(aiProposals.status, "pending"),
      ),
    );
  const pendingTypes = new Set(pending.map((p) => p.type));

  // scale_design 引擎的数据存储在 project_scales 表
  let hasScaleData = false;
  let scales: Array<{ key: string; label: string; description: string | null }> = [];
  try {
    scales = await db
      .select()
      .from(projectScales)
      .where(eq(projectScales.projectId, projectId));
    hasScaleData = scales.length > 0;
  } catch {
    // 表可能尚未创建（迁移未执行），降级处理
  }

  // 动态读取所有孵化阶段引擎
  const { HATCH_ENGINES } = await import("@narrative-os/engines");
  const engines = HATCH_ENGINES.map((e) => ({
    type: e.settingType,
    label: e.label,
    name: e.name,
    group: e.engineGroup,
    dependsOn: e.dependsOn,
  }));

  return engines.map((e) => {
    const engineItems = byType[e.type] || [];
    const hasData = e.type === "scale_design" ? hasScaleData : engineItems.length > 0;
    return {
      ...e,
      hasData,
      itemCount: e.type === "scale_design" ? scales.length : engineItems.length,
      items: e.type === "scale_design"
        ? scales.map((s) => ({ id: s.key, name: s.label, summary: s.description }))
        : engineItems.map((i) => ({ id: i.id, name: i.name, summary: i.summary })),
      hasPending: pendingTypes.has(e.type),
    };
  });
}

// ── 防重复/组合守卫已移除 ──
// 孵化流程完全由 scheduler.getNextPhase() 状态机控制，
// 前端通过单一 /hatch/:id/advance 入口推进，无需额外守卫。
