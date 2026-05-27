import type { Tool, ToolDefinition, ToolContext } from "./types";
import { generateSchemaTools } from "./schema-mapper";

class CompanionToolRegistry {
  private tools = new Map<string, Tool>();
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;

    const schemaTools = generateSchemaTools();
    for (const tool of schemaTools) {
      this.tools.set(tool.definition.name, tool);
    }

    this.registerWorldTools();
    this.registerEngineTools();
    this.registerUtilityTools();

    this.initialized = true;
    console.log(`[companion] Registry initialized: ${this.tools.size} tools`);
    console.log(`[companion] Tools: ${Array.from(this.tools.keys()).join(", ")}`);
  }

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  private registerWorldTools(): void {
    this.register({
      definition: {
        name: "query_world_setting",
        description:
          "查询项目中已确认的世界观设定数据。按引擎名、类型、名称或关键词筛选，所有条件可选且可自由组合。" +
          "使用示例：" +
          "- 按引擎查所有角色：{ engine: 'character' }" +
          "- 按名称搜索：{ name: '龙' }" +
          "- 关键词搜索：{ keyword: '修仙' }" +
          "- 带关系查询：{ engine: 'faction', includeRelations: true }" +
          "- 组合筛选：{ type: 'power_system', keyword: '天阶' }",
        parameters: {
          type: "object",
          properties: {
            engine: { type: "string", description: "按产出引擎筛选，如 character、geography、faction、power-system 等" },
            type: { type: "string", description: "按设定类型筛选，如 character、geography、power_system" },
            name: { type: "string", description: "按名称搜索（不区分大小写的部分匹配）" },
            keyword: { type: "string", description: "在摘要和内容中搜索关键词" },
            subtype: { type: "string", description: "按条目子类型筛选，如 protagonist、faction_member、region、artifact" },
            includeRelations: { type: "boolean", description: "是否同时返回条目间的关系" },
            limit: { type: "integer", description: "最大返回行数，默认 50，最大 200" },
          },
          required: [],
        },
      },
      execute: async (args, ctx) => {
        const { queryWorldSetting } = await import("@narrative-os/engines");
        const result = await queryWorldSetting(ctx.projectId, {
          engine: args.engine as string | undefined,
          type: args.type as string | undefined,
          name: args.name as string | undefined,
          keyword: args.keyword as string | undefined,
          subtype: args.subtype as string | undefined,
          includeRelations: args.includeRelations as boolean | undefined,
          limit: (args.limit as number) || 50,
        });
        return {
          data: result,
          display: `查询世界设定：找到 ${result.items.length} 个条目（共 ${result.total} 个）`,
        };
      },
    });
  }

  private registerEngineTools(): void {
    this.register({
      definition: {
        name: "approve_proposal",
        description: "Approve a pending AI proposal. Creates confirmed setting items.",
        parameters: {
          type: "object",
          properties: {
            proposalId: { type: "string", description: "UUID of the proposal to approve" },
            decision: { type: "string", description: "Optional author decision note" },
          },
          required: ["proposalId"],
        },
      },
      execute: async (args, ctx) => {
        const { Orchestrator } = await import("@narrative-os/pipeline");
        const orchestrator = new Orchestrator();
        const result = await orchestrator.approveProposal(
          args.proposalId as string,
          args.decision as string | undefined
        );
        return {
          data: result,
          display: `Approved proposal: ${result.settingItemsCreated} setting item(s) created`,
        };
      },
    });

    this.register({
      definition: {
        name: "reject_proposal",
        description: "Reject a pending AI proposal.",
        parameters: {
          type: "object",
          properties: {
            proposalId: { type: "string", description: "UUID of the proposal" },
            reason: { type: "string", description: "Rejection reason" },
          },
          required: ["proposalId"],
        },
      },
      execute: async (args, ctx) => {
        const { Orchestrator } = await import("@narrative-os/pipeline");
        const orchestrator = new Orchestrator();
        await orchestrator.rejectProposal(
          args.proposalId as string,
          (args.reason as string) || "Rejected via companion"
        );
        return { data: { success: true }, display: `Rejected proposal` };
      },
    });

    this.register({
      definition: {
        name: "revise_proposal",
        description: "Request revision of a proposal with feedback.",
        parameters: {
          type: "object",
          properties: {
            proposalId: { type: "string", description: "UUID of the proposal" },
            notes: { type: "string", description: "Revision feedback" },
          },
          required: ["proposalId", "notes"],
        },
      },
      execute: async (args, ctx) => {
        const { Orchestrator } = await import("@narrative-os/pipeline");
        const orchestrator = new Orchestrator();
        const result = await orchestrator.reviseProposal(
          args.proposalId as string,
          args.notes as string
        );
        return { data: result, display: `Requested revision on proposal` };
      },
    });

    this.register({
      definition: {
        name: "list_agent_nodes",
        description: "List all available AI agent nodes that can generate proposals.",
        parameters: { type: "object", properties: {} },
      },
      execute: async (_args, _ctx) => {
        const { listEngines } = await import("@narrative-os/engines");
        return { data: { nodes: listEngines() }, display: `Available: ${listEngines().join(", ")}` };
      },
    });

    this.register({
      definition: {
        name: "run_agent_node",
        description: "Run an AI agent node to generate proposals. Use list_agent_nodes first.",
        parameters: {
          type: "object",
          properties: {
            nodeName: { type: "string", description: "Agent node name" },
            context: { type: "string", description: "Context for the node" },
          },
          required: ["nodeName"],
        },
      },
      execute: async (args, ctx) => {
        const { getEngine } = await import("@narrative-os/engines");
        const { Orchestrator } = await import("@narrative-os/pipeline");
        const { db, sessions } = await import("@narrative-os/database");

        const node = getEngine(args.nodeName as string);
        const [session] = await db.insert(sessions).values({
          projectId: ctx.projectId,
          type: args.nodeName as string,
          title: `Companion: ${args.nodeName}`,
        }).returning({ id: sessions.id });

        const result = await node.run({
          projectId: ctx.projectId,
          sessionId: session.id,
          caller: (args.context as string) || `Companion-triggered ${args.nodeName}`,
        });

        const orchestrator = new Orchestrator();
        const proposalIds = await orchestrator.stageProposals(
          ctx.projectId, session.id, result, args.nodeName as string
        );

        return {
          data: { proposalsGenerated: proposalIds.length, proposalIds },
          display: `Ran ${args.nodeName}: ${proposalIds.length} proposal(s)`,
        };
      },
    });
  }

  private registerUtilityTools(): void {
    this.register({
      definition: {
        name: "semantic_search",
        description: "语义搜索项目中的相关数据（设定、章节、记忆事件）。当用户的问题可能涉及项目已有数据时调用，比关键词搜索更智能。",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "搜索查询文本，用自然语言描述用户想找的内容" },
            sourceType: { type: "string", description: "可选过滤：setting_item / chapter_chunk / memory_event / event_summary" },
            limit: { type: "integer", description: "返回条数上限，默认 8" },
          },
          required: ["query"],
        },
      },
      execute: async (args, ctx) => {
        const { EmbeddingPipeline } = await import("@narrative-os/database");
        const pipeline = EmbeddingPipeline.getInstance();
        if (!pipeline) {
          return { data: { error: "Embedding pipeline not initialized" }, display: "语义搜索不可用" };
        }
        const results = await pipeline.searchForCompanion(
          ctx.projectId,
          args.query as string,
          (args.limit as number) || 8
        );
        const sourceFilter = args.sourceType as string | undefined;
        const filtered = sourceFilter ? results.filter((r) => r.sourceType === sourceFilter) : results;
        return {
          data: {
            query: args.query,
            total: filtered.length,
            results: filtered.map((r) => ({
              sourceType: r.sourceType,
              sourceId: r.sourceId,
              text: r.chunkText.substring(0, 200),
              similarity: r.similarity,
            })),
          },
          display: `语义搜索「${args.query}」找到 ${filtered.length} 条结果`,
        };
      },
    });

    this.register({
      definition: {
        name: "update_activity",
        description: "更新窗口头部的活动状态。对话主题变化时或每次回复时都可以调用，让活动状态始终有趣、与小说相关。",
        parameters: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "简短活动描述（≤15字），如'正在讨论力量体系设计'",
            },
            color: {
              type: "string",
              description: "荧光色 hex，可选：#a78bfa(紫) #22d3ee(青) #34d399(绿) #fb923c(橙) #f472b6(粉) #60a5fa(蓝)",
            },
          },
          required: ["text"],
        },
      },
      execute: async (args) => ({
        data: { text: args.text, color: args.color || "#c4b5fd" },
      }),
    });

    this.register({
      definition: {
        name: "get_project_summary",
        description: "Get project status, proposal counts, and setting item counts.",
        parameters: { type: "object", properties: {} },
      },
      execute: async (_args, ctx) => {
        const { db, projects, aiProposals, settingItems } = await import("@narrative-os/database");
        const { eq, and } = await import("drizzle-orm");

        const [project] = await db.select().from(projects).where(eq(projects.id, ctx.projectId));
        const proposals = await db.select().from(aiProposals).where(eq(aiProposals.projectId, ctx.projectId));
        const items = await db.select().from(settingItems).where(
          and(eq(settingItems.projectId, ctx.projectId), eq(settingItems.status, "confirmed"))
        );

        return {
          data: {
            project: { title: project?.title, genre: project?.genre, status: project?.status },
            proposalCounts: {
              total: proposals.length,
              pending: proposals.filter((p) => p.status === "pending").length,
              approved: proposals.filter((p) => p.status === "approved").length,
            },
            confirmedSettings: items.length,
          },
          display: `"${project?.title}": ${proposals.length} proposals, ${items.length} settings`,
        };
      },
    });
  }
}

export const toolRegistry = new CompanionToolRegistry();
