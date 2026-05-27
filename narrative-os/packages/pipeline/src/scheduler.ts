import { db, projects, settingItems, aiProposals, mouStates, sessions, projectScales, projectSettings } from "@narrative-os/database";
import { eq, and, sql } from "drizzle-orm";
import { getEngine } from "@narrative-os/engines";
import { Orchestrator } from "./orchestrator";
import { bus } from "./event-bus";
import type { EngineContext } from "@narrative-os/engines";
import { getRunnableEngines, HATCH_ENGINES, SCALE_CHAIN, loadProjectScales, getProjectChildScale } from "@narrative-os/engines";

export type SchedulerEventType =
  | "engine_started"
  | "engine_completed"
  | "proposals_staged"
  | "project_activated"
  | "error"
  | "proactive_triggered";

export interface SchedulerEvent {
  type: SchedulerEventType;
  projectId: string;
  node?: string;
  proposalIds?: string[];
  error?: string;
  trigger?: string;
}

// 孵化阶段引擎（依赖图驱动，顺序执行，等用户审批后触发下一个）
const HATCH_ENGINE_NAMES = HATCH_ENGINES.map((e) => e.name);

// 引擎注册信息
export interface EngineRegistration {
  name: string;
  mode: "hatching" | "proactive" | "both";
  // proactive 模式下，监听哪些事件触发
  triggers?: string[];
}

const engineRegistry = new Map<string, EngineRegistration>();

export function registerEngine(reg: EngineRegistration) {
  engineRegistry.set(reg.name, reg);
}

// 注册默认的孵化引擎
HATCH_ENGINE_NAMES.forEach((name) => registerEngine({ name, mode: "hatching" }));

// 注册主动引擎（Proactive）
registerEngine({ name: "memory-extractor", mode: "proactive", triggers: ["chapter.committed"] });
registerEngine({ name: "censor-checker", mode: "proactive", triggers: ["chapter.committed"] });

export class EngineScheduler {
  private orchestrator: Orchestrator;
  private onEvent?: (event: SchedulerEvent) => void;
  private running = new Map<string, Set<string>>(); // projectId -> Set<nodeName>
  private listeners: Array<{ type: string; fn: (...args: any[]) => void }> = [];

  constructor(opts?: {
    orchestrator?: Orchestrator;
    onProposalsStaged?: (projectId: string, proposalIds: string[]) => void;
    onEvent?: (event: SchedulerEvent) => void;
  }) {
    this.onEvent = opts?.onEvent;
    // 复用外部传入的 Orchestrator 实例（如 hatch 路由创建的那个），
    // 避免双实例导致 WS 通知丢失
    this.orchestrator = opts?.orchestrator ?? new Orchestrator({
      onProposalsStaged: (projectId, proposalIds) => {
        this.emit({ type: "proposals_staged", projectId, proposalIds });
        opts?.onProposalsStaged?.(projectId, proposalIds);
      },
    });

    // 注册事件监听（主动模式入口）
    this.setupEventListeners();
  }

  /**
   * 销毁时清理事件监听
   */
  destroy() {
    for (const { type, fn } of this.listeners) {
      bus.off(type as never, fn as never);
    }
    this.listeners = [];
  }

  private listen<T extends Parameters<typeof bus.on>[0]>(
    type: T,
    fn: Parameters<typeof bus.on<T>>[1]
  ) {
    bus.on(type, fn);
    this.listeners.push({ type, fn });
  }

  private setupEventListeners() {
    // NOTE: Hatching chain (proposal.approved / proposal.rejected) is now
    // driven by the frontend via SSE streaming — the frontend calls runEngine()
    // after each approval/reject/revise, giving the user live LLM output.
    // The scheduler no longer auto-triggers hatching engines.

    // 项目激活后：标记孵化阶段结束
    this.listen("project.activated", (event) => {
      this.emit({ type: "project_activated", projectId: event.projectId });
    });

    // 章节提交后：触发主动引擎（memory, censor）
    this.listen("chapter.committed", (event) => {
      this.runProactiveEngines(event.projectId, event.chapterId).catch((err: Error) => {
        this.emit({
          type: "error",
          projectId: event.projectId,
          error: `Proactive engine error: ${err.message}`,
        });
      });
      // 异步触发章节向量嵌入
      this.embedChapter(event.projectId, event.chapterId).catch((err: Error) => {
        console.error(`[scheduler] Chapter embedding error: ${err.message}`);
      });
    });
  }

  // ─────────────────────────────────────────────
  // 孵化模式（Hatching）— 依赖图驱动
  // ─────────────────────────────────────────────

  /**
   * 查询下一个应运行的引擎（不执行），用于审批后提示前端。
   * 返回 null 表示没有待运行的引擎（可能有 pending 提案或已完成）。
   */
  async getNextEngine(projectId: string): Promise<{ name: string; phase: string; hatchGroup?: string } | null> {
    // 查询阶段完成状态
    const [settings] = await db
      .select({ hatchSummary: projectSettings.hatchSummary })
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId));
    const phaseStatus = (settings?.hatchSummary as any)?.phaseStatus || {};

    // 查询已确认的引擎产出（settingItems + projectScales）
    const confirmedItems = await db
      .select({ engineSource: settingItems.engineSource })
      .from(settingItems)
      .where(and(eq(settingItems.projectId, projectId), eq(settingItems.status, "confirmed")));
    const confirmedEngines = new Set(confirmedItems.map((i) => i.engineSource).filter(Boolean) as string[]);

    // 查询 pending 提案
    const pendingProposals = await db
      .select({ sourceNode: aiProposals.sourceNode })
      .from(aiProposals)
      .where(and(eq(aiProposals.projectId, projectId), eq(aiProposals.status, "pending")));
    const pendingEngines = new Set(pendingProposals.map((p) => p.sourceNode).filter(Boolean) as string[]);

    // 有待审批提案 → 等待用户操作
    if (pendingEngines.size > 0) return null;

    // 检查是否有 revision_requested
    const revisionRequested = await db
      .select({ sourceNode: aiProposals.sourceNode })
      .from(aiProposals)
      .where(and(eq(aiProposals.projectId, projectId), eq(aiProposals.status, "revision_requested")));
    if (revisionRequested.length > 0) {
      return { name: revisionRequested[0].sourceNode!, phase: "waiting" };
    }

    // 阶段检查：geography 阶段需要用户确认完成才能推进到后续引擎
    // 如果 geography 已有 confirmed 产出但用户未确认阶段完成，提示用户确认
    const geographyHasOutput = confirmedEngines.has("geography");
    const geographyPhaseCompleted = phaseStatus.geography === "completed";
    if (geographyHasOutput && !geographyPhaseCompleted) {
      // geography 有产出但未确认完成，提示用户确认阶段
      return { name: "geography", phase: "waiting_phase_confirmation", hatchGroup: "world" };
    }

    // 使用依赖图计算可运行的引擎（getRunnableEngines 和 HATCH_ENGINES 已在顶部静态导入）
    const runnable = getRunnableEngines(confirmedEngines, pendingEngines);
    const hatchRunnable = runnable.filter((e) => HATCH_ENGINES.some((he) => he.name === e.name));

    if (hatchRunnable.length > 0) {
      const nextEngine = hatchRunnable[0];
      // 判断当前处于哪个阶段（world 还是 studio）
      const hatchGroup = nextEngine.engineGroup;
      return { name: nextEngine.name, phase: "streaming", hatchGroup };
    }

    // 没有可运行引擎 → 检查是否已完成
    const allWorldEngines = HATCH_ENGINES.filter((e) => e.engineGroup === "world");
    const allWorldDone = allWorldEngines.every((e) => confirmedEngines.has(e.name));
    if (allWorldDone) {
      // 检查工作室引擎是否已开始
      const anyStudioDone = HATCH_ENGINES.filter((e) => e.engineGroup === "studio")
        .some((e) => confirmedEngines.has(e.name));
      if (!anyStudioDone) {
        return { name: "outline-generator", phase: "world_complete", hatchGroup: "studio" };
      }
    }

    const allHatchEngines = HATCH_ENGINES;
    const allDone = allHatchEngines.every((e) => confirmedEngines.has(e.name));
    if (allDone) {
      return { name: "", phase: "complete" };
    }

    return null;
  }

  /**
   * 孵化阶段状态机 — 孵化引擎的唯一入口。
   *
   * 确定项目当前所处的孵化阶段，供 `/hatch/:id/advance` 端点使用。
   * 前端不再做任何编排判定，所有阶段判定在此方法中完成。
   */
  async getNextPhase(projectId: string): Promise<{
    phase: "waiting_approval" | "waiting_revision" | "engine_ready" | "waiting_user_action" | "waiting_phase_confirmation" | "complete";
    engine?: string;
    pendingCount?: number;
    refinableCount?: number;
    refinement?: { parentItemId: string; parentName: string; parentScale: string; targetScale: string; engineSource: string };
  }> {
    // 1) 有待审批提案 → 等待用户操作
    const pendingProposals = await db
      .select({ sourceNode: aiProposals.sourceNode, id: aiProposals.id })
      .from(aiProposals)
      .where(and(eq(aiProposals.projectId, projectId), eq(aiProposals.status, "pending")));

    if (pendingProposals.length > 0) {
      console.log(`[scheduler.getNextPhase] → waiting_approval (${pendingProposals.length} pending: ${pendingProposals.map((p) => p.sourceNode).join(",")})`);
      return { phase: "waiting_approval", pendingCount: pendingProposals.length };
    }

    // 2) 有 revision_requested → 需要重新运行同一引擎
    const revisionProposals = await db
      .select({ sourceNode: aiProposals.sourceNode })
      .from(aiProposals)
      .where(and(eq(aiProposals.projectId, projectId), eq(aiProposals.status, "revision_requested")))
      .limit(1);

    if (revisionProposals.length > 0) {
      console.log(`[scheduler.getNextPhase] → waiting_revision (${revisionProposals[0].sourceNode})`);
      return { phase: "waiting_revision", engine: revisionProposals[0].sourceNode || undefined };
    }

    // 3) 检查是否需要细化（不再自动触发，仅提示前端有待细化条目）
    const refinable = await this.getItemsNeedingRefinement(projectId);
    if (refinable.length > 0) {
      const first = refinable[0];
      console.log(`[scheduler.getNextPhase] → waiting_user_action: ${refinable.length} 个条目待细化，首个 ${first.engineSource}/${first.name} (${first.scale}→${first.targetScale})`);
      return {
        phase: "waiting_user_action",
        refinableCount: refinable.length,
        engine: first.engineSource,
        refinement: {
          parentItemId: first.id,
          parentName: first.name,
          parentScale: first.scale,
          targetScale: first.targetScale,
          engineSource: first.engineSource,
        },
      };
    }

    // 4) 获取下一个引擎
    const next = await this.getNextEngine(projectId);
    if (next && (next.phase === "streaming" || next.phase === "world_complete")) {
      console.log(`[scheduler.getNextPhase] → engine_ready: ${next.name} (phase=${next.phase}, group=${next.hatchGroup})`);
      return { phase: "engine_ready", engine: next.name };
    }

    // 4b) 阶段等待确认（如 geography 有产出但未确认完成）
    if (next && next.phase === "waiting_phase_confirmation") {
      console.log(`[scheduler.getNextPhase] → waiting_phase_confirmation: ${next.name}`);
      return { phase: "waiting_phase_confirmation", engine: next.name };
    }

    // 5) 已完成
    console.log(`[scheduler.getNextPhase] → complete`);
    return { phase: "complete" };
  }

  /**
   * Check a project and run the NEXT missing engine (dependency graph driven).
   */
  async runMissingEngines(projectId: string): Promise<void> {
    if (this.isRunning(projectId)) {
      console.log(`[scheduler] Project ${projectId} already has running engines, skip`);
      return;
    }

    const [project] = await db
      .select({ status: projects.status, genre: projects.genre })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project || project.status !== "hatching") {
      console.log(`[scheduler] Project ${projectId} not in hatching status (${project?.status}), skip`);
      return;
    }

    // 查询哪些引擎已有 confirmed 产出（按 engineSource）
    const confirmedItems = await db
      .select({ engineSource: settingItems.engineSource })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed")
        )
      );
    const confirmedEngines = new Set(
      confirmedItems.map((i) => i.engineSource).filter(Boolean) as string[]
    );

    // scale-designer 已合入 geography 引擎，不再需要独立检查
    console.log(`[scheduler] Confirmed engines: ${[...confirmedEngines].join(", ") || "none"}`);

    // 阶段检查：geography 阶段需要用户确认完成才能自动推进到后续引擎
    // 与 getNextEngine 保持一致，防止 onProposalsResolved 绕过阶段确认
    const [settings] = await db
      .select({ hatchSummary: projectSettings.hatchSummary })
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId));
    const phaseStatus = (settings?.hatchSummary as any)?.phaseStatus || {};
    const geographyHasOutput = confirmedEngines.has("geography");
    const geographyPhaseCompleted = phaseStatus.geography === "completed";
    if (geographyHasOutput && !geographyPhaseCompleted) {
      console.log(`[scheduler] Geography phase has output but not confirmed, skip auto-advance`);
      return;
    }

    // 查询 pending 提案对应的引擎
    const pendingProposals = await db
      .select({ sourceNode: aiProposals.sourceNode })
      .from(aiProposals)
      .where(
        and(
          eq(aiProposals.projectId, projectId),
          eq(aiProposals.status, "pending")
        )
      );
    const pendingEngines = new Set(
      pendingProposals.map((p) => p.sourceNode).filter(Boolean) as string[]
    );
    console.log(`[scheduler] Pending engines: ${[...pendingEngines].join(", ") || "none"}`);

    // 检查 revision_requested（需要重新运行）
    const revisionProposals = await db
      .select({ type: aiProposals.type, sourceNode: aiProposals.sourceNode })
      .from(aiProposals)
      .where(
        and(
          eq(aiProposals.projectId, projectId),
          eq(aiProposals.status, "revision_requested")
        )
      );

    if (revisionProposals.length > 0) {
      const engineName = revisionProposals[0].sourceNode || undefined;
      console.log(`[scheduler] Revision requested for ${engineName}, re-running...`);
      if (engineName) {
        // 清除旧的 revision_requested 记录，防止死循环
        const supersededProposals = await db
          .update(aiProposals)
          .set({ status: "superseded" })
          .where(
            and(
              eq(aiProposals.projectId, projectId),
              eq(aiProposals.sourceNode, engineName),
              eq(aiProposals.status, "revision_requested")
            )
          )
          .returning({ id: aiProposals.id });
        for (const sp of supersededProposals) {
          await db
            .update(mouStates)
            .set({ status: "superseded", decidedAt: new Date() })
            .where(eq(mouStates.proposalId, sp.id));
        }
        await this.runSingleEngine(projectId, project.genre, engineName);
        return;
      }
    }

    // 依赖图筛选：找出依赖已满足且未在跑的引擎
    const runnable = getRunnableEngines(confirmedEngines, pendingEngines);
    console.log(`[scheduler] Runnable engines: ${runnable.map((e) => e.name).join(", ") || "none"}`);

    // 只取属于孵化阶段的引擎
    const hatchRunnable = runnable.filter((e) => HATCH_ENGINE_NAMES.includes(e.name));
    console.log(`[scheduler] Hatch runnable: ${hatchRunnable.map((e) => e.name).join(", ") || "none"}`);

    if (hatchRunnable.length === 0) {
      console.log(`[scheduler] No runnable hatch engines for ${projectId}`);
      return;
    }

    // 按注册表顺序取第一个
    const engineDef = hatchRunnable[0];
    console.log(`[scheduler] Running next engine: ${engineDef.name}`);
    await this.runSingleEngine(projectId, project.genre, engineDef.name);
  }

  /**
   * 手动触发指定引擎（适用于 active 阶段或用户主动触发）
   */
  async runEngine(projectId: string, engineName: string): Promise<void> {
    if (this.isRunning(projectId)) return;

    const [project] = await db
      .select({ genre: projects.genre })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) return;

    await this.runSingleEngine(projectId, project.genre, engineName);
  }

  /**
   * Called after user approves/rejects all pending proposals.
   *
   * 当前策略：
   * 1. 检查是否还有 pending 提案 → 如有，等待
   * 2. 不再自动运行细化循环（由用户手动触发）
   * 3. 推进到下一个引擎
   */
  async onProposalsResolved(projectId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 500));

    // 1. 还有 pending 提案？等待用户审批（非细化类的提案需要用户决策）
    const stillPending = await db
      .select({ id: mouStates.id })
      .from(mouStates)
      .where(
        and(
          eq(mouStates.projectId, projectId),
          eq(mouStates.status, "pending")
        )
      );

    if (stillPending.length > 0) return;

    // 2. 不再自动运行细化循环 — 细化由用户手动触发
    //    用户通过前端按钮或 API 调用 scheduler.refineItem() 触发细化

    // 3. 没有 pending 且没有待细化 → 推进到下一个引擎
    await this.runMissingEngines(projectId);
  }

  /**
   * 细化自动循环：逐个细化待细化的条目，每步自动审批结果。
   * 细化是执行的延续，不需要用户再选方案（方向已在初始 pass 确定）。
   */
  private async runRefinementLoop(projectId: string): Promise<void> {
    const MAX_ITERATIONS = 100;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const refinableItems = await this.getItemsNeedingRefinement(projectId);
      if (refinableItems.length === 0) {
        console.log(`[scheduler] 细化循环完成：所有条目已细化到底`);
        break;
      }

      const first = refinableItems[0];
      console.log(`[scheduler] 细化循环 #${i + 1}: ${first.engineSource}/${first.name} (${first.scale} → ${first.targetScale}), 剩余 ${refinableItems.length} 个`);

      // 运行细化引擎
      const proposalIds = await this.refineItem(projectId, first.id);

      if (proposalIds.length === 0) {
        console.warn(`[scheduler] 细化循环：${first.name} 未产生提案，跳过`);
        // 清除父条目的 needs_refinement 防止死循环
        await db
          .update(settingItems)
          .set({ content: sql`jsonb_set(${settingItems.content}, '{needs_refinement}', 'false')`, updatedAt: new Date() })
          .where(eq(settingItems.id, first.id));
        continue;
      }

      // 自动审批所有细化提案（取第一个，supersede 其余）
      for (const pid of proposalIds) {
        try {
          await this.orchestrator.approveProposal(pid, "细化自动审批");
          console.log(`[scheduler] 细化自动审批: ${pid.substring(0, 8)}`);
        } catch (err: any) {
          console.error(`[scheduler] 细化自动审批失败 ${pid}: ${err.message}`);
          // 如果审批失败，标记父条目跳过，防止死循环
          await db
            .update(settingItems)
            .set({ content: sql`jsonb_set(${settingItems.content}, '{needs_refinement}', 'false')`, updatedAt: new Date() })
            .where(eq(settingItems.id, first.id));
          break;
        }
      }

      // 细化+审批完成，推送通知前端刷新状态
      bus.emit({
        type: "setting.items_created" as any,
        projectId,
        proposalId: proposalIds[0],
        itemIds: [],
        relationIds: [],
      });
    }
  }

  // ─────────────────────────────────────────────
  // 主动模式（Proactive）— 事件驱动触发
  // ─────────────────────────────────────────────

  registerProactiveEngine(name: string, triggers: string[]) {
    registerEngine({ name, mode: "proactive", triggers });
  }

  private async runProactiveEngines(projectId: string, chapterId: string): Promise<void> {
    const enginesToRun: string[] = [];

    for (const [name, reg] of engineRegistry) {
      if (reg.mode === "proactive" && reg.triggers?.includes("chapter.committed")) {
        enginesToRun.push(name);
      }
    }

    if (enginesToRun.length === 0) {
      console.log(`[Proactive] chapter.committed for ${projectId}/${chapterId} — no proactive engines registered yet`);
      return;
    }

    // 获取章节和项目信息，用于 proactive 上下文
    const [project] = await db
      .select({ genre: projects.genre, status: projects.status })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project || project.status !== "active") {
      console.log(`[Proactive] project ${projectId} not active (${project?.status}), skipping proactive engines`);
      return;
    }

    await Promise.all(
      enginesToRun.map((engineName) =>
        this.runSingleEngine(projectId, project.genre || "通用", engineName, { chapterId })
          .then(() => {
            this.emit({
              type: "proactive_triggered",
              projectId,
              node: engineName,
              trigger: "chapter.committed",
            });
          })
          .catch((err: Error) => {
            this.emit({
              type: "error",
              projectId,
              node: engineName,
              error: err.message,
            });
          })
      )
    );
  }

  // ─────────────────────────────────────────────
  // 通用执行层
  // ─────────────────────────────────────────────

  private async runSingleEngine(
    projectId: string,
    genre: string,
    engineName: string,
    extraContext?: Record<string, unknown>
  ): Promise<void> {
    // 检查项目状态，防止在错误状态下运行引擎
    const [project] = await db
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.id, projectId));
    const isHatchingEngine = HATCH_ENGINE_NAMES.includes(engineName);
    const isProactiveEngine = engineRegistry.get(engineName)?.mode === "proactive";
    if (!project) {
      console.warn(`[scheduler] runSingleEngine: project ${projectId} not found`);
      return;
    }
    if (isHatchingEngine && project.status !== "hatching") {
      console.log(`[scheduler] runSingleEngine: project ${projectId} not in hatching status (${project.status}), skip`);
      return;
    }
    if (isProactiveEngine && project.status !== "active") {
      console.log(`[scheduler] runSingleEngine: project ${projectId} not in active status (${project.status}), skip proactive engine`);
      return;
    }

    try {
      this.setRunning(projectId, engineName, true);
      this.emit({ type: "engine_started", projectId, node: engineName });
      console.log(`[scheduler] Engine starting: ${engineName} for project ${projectId}`);

      // Create a session record for LLM logging
      const [session] = await db.insert(sessions).values({
        projectId,
        type: engineName,
        title: `Hatching: ${engineName}`,
      }).returning({ id: sessions.id });

      const node = getEngine(engineName);
      const ctx: EngineContext = {
        projectId,
        sessionId: session.id,
        caller: genre || "通用",
        ...extraContext,
      };

      console.log(`[scheduler] Running ${engineName} node...`);
      const result = await node.run(ctx);
      console.log(`[scheduler] ${engineName} completed, proposals: ${result.proposals.length}`);

      if (result.proposals.length > 0) {
        const ids = await this.orchestrator.stageProposals(
          projectId,
          session.id,
          result,
          engineName
        );
        console.log(`[scheduler] ${engineName} staged ${ids.length} proposals`);
      }

      this.emit({ type: "engine_completed", projectId, node: engineName });
    } catch (err: any) {
      console.error(`[scheduler] ${engineName} failed:`, err.message);
      this.emit({
        type: "error",
        projectId,
        node: engineName,
        error: err.message,
      });
    } finally {
      this.setRunning(projectId, engineName, false);
    }
  }

  // ─────────────────────────────────────────────
  // 细化模式（Refinement）— 通用，任何引擎都可逐层细化
  // ─────────────────────────────────────────────

  /**
   * 对任何已确认条目进行细化，生成下一层级的子条目。
   * 根据条目的 engineSource 自动调用对应引擎。
   */
  async refineItem(
    projectId: string,
    parentItemId: string,
  ): Promise<string[]> {
    const [parentItem] = await db
      .select({
        id: settingItems.id,
        name: settingItems.name,
        engineSource: settingItems.engineSource,
        content: settingItems.content,
      })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.id, parentItemId),
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed")
        )
      );

    if (!parentItem || !parentItem.engineSource) {
      console.warn(`[scheduler] refineItem: ${parentItemId} not found or no engineSource`);
      return [];
    }

    const engineName = parentItem.engineSource;
    const content = (parentItem.content || {}) as Record<string, unknown>;
    const parentScale = (content.scale as string) || "continent";

    // 使用动态尺度体系确定下一级（优先项目自定义，回退到 SCALE_CHAIN）
    const childScale = await getProjectChildScale(projectId, parentScale);
    if (!childScale) {
      // 回退到 SCALE_CHAIN（兼容没有运行 scale-designer 的旧项目）
      const currentIdx = SCALE_CHAIN.indexOf(parentScale as typeof SCALE_CHAIN[number]);
      if (currentIdx < 0 || currentIdx >= SCALE_CHAIN.length - 1) {
        console.log(`[scheduler] refineItem: ${parentItem.name} (${parentScale}) is at finest scale, skip`);
        return [];
      }
      const targetScale = SCALE_CHAIN[currentIdx + 1];
      const depth = currentIdx + 1;
      console.log(`[scheduler] Refining ${engineName}: ${parentItem.name} (${parentScale} → ${targetScale}) [SCALE_CHAIN fallback]`);
      return this.runRefinementEngine(projectId, engineName, {
        parentItemId, parentName: parentItem.name, parentScale,
        targetScale, depth,
      });
    }

    const targetScale = childScale.key;
    const depth = childScale.sortOrder;

    console.log(`[scheduler] Refining ${engineName}: ${parentItem.name} (${parentScale} → ${targetScale})`);
    return this.runRefinementEngine(projectId, engineName, {
      parentItemId: parentItem.id,
      parentName: parentItem.name,
      parentScale,
      targetScale,
      depth,
    });
  }

  /**
   * 查找所有需要细化的条目（任何引擎，有 needs_refinement=true 且未到达最细尺度）
   * 自动排除已有子条目的项，防止重复细化。
   */
  async getItemsNeedingRefinement(projectId: string): Promise<Array<{
    id: string;
    name: string;
    scale: string;
    targetScale: string;
    engineSource: string;
  }>> {
    const items = await db
      .select({
        id: settingItems.id,
        name: settingItems.name,
        content: settingItems.content,
        engineSource: settingItems.engineSource,
      })
      .from(settingItems)
      .where(
        and(
          eq(settingItems.projectId, projectId),
          eq(settingItems.status, "confirmed"),
        )
      );

    // 批量查询哪些条目已有子条目（已细化的父条目不再重复细化）
    const parentIds = new Set(
      (await db
        .select({ parentItemId: settingItems.parentItemId })
        .from(settingItems)
        .where(
          and(
            eq(settingItems.projectId, projectId),
            eq(settingItems.status, "confirmed"),
          )
        )
      ).map((r) => r.parentItemId).filter(Boolean) as string[]
    );

    const results: Array<{ id: string; name: string; scale: string; targetScale: string; engineSource: string }> = [];
    const skippedReasons: string[] = [];

    for (const item of items) {
      if (!item.engineSource) continue;
      const content = (item.content || {}) as Record<string, unknown>;
      const needsRefinement = content.needs_refinement === true;
      const scale = (content.scale as string) || "";

      if (!needsRefinement && !scale) {
        // 既不需要细化也没有尺度 — 非空间类条目，正常跳过
        continue;
      }
      if (!needsRefinement) {
        skippedReasons.push(`"${item.name}": needs_refinement=false`);
        continue;
      }
      if (!scale) {
        // needs_refinement=true 但没有 scale — LLM 遗漏了 scale 字段
        // 尝试从项目尺度链的第一级兜底
        const projectScales = await loadProjectScales(projectId);
        const firstScale = projectScales.length > 0 ? projectScales[0].key : null;
        if (firstScale) {
          console.warn(`[scheduler] 细化检查："${item.name}" 有 needs_refinement=true 但缺少 scale，兜底使用项目首级尺度 "${firstScale}"`);
          const childScale = await getProjectChildScale(projectId, firstScale);
          if (childScale && !parentIds.has(item.id)) {
            results.push({
              id: item.id, name: item.name, scale: firstScale,
              targetScale: childScale.key,
              engineSource: item.engineSource,
            });
            // NOTE: 不在读取路径中修改 DB。缺失的 scale 应由审批 handler 在创建/更新条目时写入。
            // 如果需要修复存量数据，应通过独立的数据修复脚本或 API 完成。
          }
        } else {
          skippedReasons.push(`"${item.name}": needs_refinement=true 但无 scale 且无项目尺度链`);
        }
        continue;
      }

      // 已有子条目的父条目不再细化 — 防止重复创建子条目
      if (parentIds.has(item.id)) continue;

      // 使用动态尺度体系判断是否可细化（优先项目自定义，回退 SCALE_CHAIN）
      const childScale = await getProjectChildScale(projectId, scale);
      if (!childScale) {
        // 回退：检查 SCALE_CHAIN
        const idx = SCALE_CHAIN.indexOf(scale as typeof SCALE_CHAIN[number]);
        if (idx >= 0 && idx < SCALE_CHAIN.length - 1) {
          results.push({
            id: item.id, name: item.name, scale,
            targetScale: SCALE_CHAIN[idx + 1],
            engineSource: item.engineSource,
          });
        } else {
          // scale 不在默认链中且没有子尺度 — 可能是最细级别，或自定义尺度未写入
          const projectScales = await loadProjectScales(projectId);
          const scaleKeys = projectScales.map((s) => s.key);
          const isFinestScale = projectScales.length > 0 && !projectScales.some((s) => s.parentKey === scale);
          if (!isFinestScale) {
            skippedReasons.push(`"${item.name}": scale="${scale}" 在项目尺度链(${scaleKeys.join(",")})中无子级且不在默认链中`);
          }
        }
        continue;
      }

      results.push({
        id: item.id, name: item.name, scale,
        targetScale: childScale.key,
        engineSource: item.engineSource,
      });
    }

    if (results.length > 0) {
      console.log(`[scheduler] 细化检查：发现 ${results.length} 个待细化条目 → ${results.map((r) => `${r.name}(${r.scale}→${r.targetScale})`).join(", ")}`);
    }
    if (skippedReasons.length > 0) {
      console.warn(`[scheduler] 细化检查：跳过了 ${skippedReasons.length} 个条目 — ${skippedReasons.join("; ")}`);
    }
    if (results.length === 0 && skippedReasons.length === 0) {
      console.log(`[scheduler] 细化检查：无可细化条目（共 ${items.length} 个已确认条目，${parentIds.size} 个已有子条目）`);
    }

    return results;
  }

  /**
   * 以细化模式运行指定引擎
   */
  private async runRefinementEngine(
    projectId: string,
    engineName: string,
    refinement: {
      parentItemId: string;
      parentName: string;
      parentScale: string;
      targetScale: string;
      depth: number;
    },
  ): Promise<string[]> {
    const lockKey = `${engineName}:refine:${refinement.parentItemId}`;
    if (this.isRunning(projectId)) return [];

    try {
      this.setRunning(projectId, lockKey, true);
      this.emit({ type: "engine_started", projectId, node: `${engineName}:refine` });

      const [project] = await db
        .select({ genre: projects.genre })
        .from(projects)
        .where(eq(projects.id, projectId));

      const [session] = await db.insert(sessions).values({
        projectId,
        type: `${engineName}:refine`,
        title: `Refine: ${engineName} → ${refinement.parentName} (${refinement.targetScale})`,
      }).returning({ id: sessions.id });

      const node = getEngine(engineName);
      const ctx: EngineContext = {
        projectId,
        sessionId: session.id,
        caller: project?.genre || "通用",
        refinement,
      };

      console.log(`[scheduler] Running refinement: ${engineName} for ${refinement.parentName} → ${refinement.targetScale}`);
      const result = await node.run(ctx);
      console.log(`[scheduler] Refinement completed, proposals: ${result.proposals.length}`);

      let proposalIds: string[] = [];
      if (result.proposals.length > 0) {
        proposalIds = await this.orchestrator.stageProposals(
          projectId,
          session.id,
          result,
          engineName
        );
        console.log(`[scheduler] Refinement staged ${proposalIds.length} proposals`);
      }

      this.emit({ type: "engine_completed", projectId, node: `${engineName}:refine` });
      return proposalIds;
    } catch (err: any) {
      console.error(`[scheduler] Refinement failed:`, err.message);
      this.emit({ type: "error", projectId, node: `${engineName}:refine`, error: err.message });
      return [];
    } finally {
      this.setRunning(projectId, lockKey, false);
    }
  }

  isRunning(projectId: string): boolean {
    const running = this.running.get(projectId);
    return !!running && running.size > 0;
  }

  private setRunning(projectId: string, engine: string, value: boolean) {
    if (!this.running.has(projectId)) {
      this.running.set(projectId, new Set());
    }
    const set = this.running.get(projectId)!;
    if (value) set.add(engine);
    else set.delete(engine);
  }

  // ─────────────────────────────────────────────
  // 向量嵌入触发
  // ─────────────────────────────────────────────

  private async embedChapter(projectId: string, chapterId: string): Promise<void> {
    const { EmbeddingPipeline } = await import("@narrative-os/database");
    const pipeline = EmbeddingPipeline.getInstance();
    if (!pipeline) {
      console.warn(`[scheduler] EmbeddingPipeline not initialized, skipping chapter embed`);
      return;
    }
    console.log(`[scheduler] Embedding chapter ${chapterId}...`);
    await pipeline.embedChapter(projectId, chapterId);
  }

  private emit(event: SchedulerEvent) {
    this.onEvent?.(event);
    // 同步发射到全局事件总线，消除双轨制，确保所有监听者都能收到
    try { bus.emit(event as any); } catch { /* 总线未初始化时静默忽略 */ }
  }
}
