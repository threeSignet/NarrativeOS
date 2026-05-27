/**
 * 工具执行调度器 — 引擎和伴侣共用的工具执行层
 *
 * 接收 LLM 的 tool call，分发到对应的执行函数，返回 tool result message
 *
 * 设计原则：
 * - 引擎和伴侣共用同一个执行器，确保行为一致
 * - 错误消息友好，帮助 LLM 自我纠正
 * - projectId 强制注入，无法跨项目访问
 */
import type { ToolCall } from "@narrative-os/llm-client";
import { queryWorldSetting } from "./query-world-setting";
import type { QueryWorldSettingParams } from "./query-world-setting";

// ── 执行上下文 ──

export interface ToolExecutionContext {
  projectId: string;
  sessionId: string;
  /** 写作引擎的章节快照 ID，若不提供则查询实时数据 */
  snapshotChapterId?: string;
}

// ── 工具执行结果 ──

export interface ToolExecutionResult {
  role: "tool";
  tool_call_id: string;
  content: string;
}

// ── 工具分发 ──

/**
 * 执行 LLM 的 tool call，返回 tool result message
 *
 * 目前支持的 tool：
 * - query_world_setting：查询世界观设定数据
 *
 * 未来扩展：新增工具只需在此函数中添加 case 分支
 */
export async function executeToolCall(
  toolCall: ToolCall,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { name, arguments: argsStr } = toolCall.function;

  try {
    // 解析参数
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsStr) as Record<string, unknown>;
    } catch {
      return errorResult(toolCall.id, `无法解析工具参数 JSON: ${argsStr}`);
    }

    switch (name) {
      case "query_world_setting":
        return await handleQueryWorldSetting(toolCall.id, args, ctx);

      default:
        return errorResult(toolCall.id, `未知工具: ${name}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(toolCall.id, `工具执行异常: ${message}`);
  }
}

// ── 具体工具处理函数 ──

/**
 * 处理 query_world_setting 工具调用
 */
async function handleQueryWorldSetting(
  toolCallId: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // 构建查询参数 — 所有参数可选，自由组合
  const params: QueryWorldSettingParams = {};

  if (typeof args.engine === "string") params.engine = args.engine;
  if (typeof args.type === "string") params.type = args.type;
  if (typeof args.name === "string") params.name = args.name;
  if (typeof args.keyword === "string") params.keyword = args.keyword;
  if (typeof args.subtype === "string") params.subtype = args.subtype;
  if (typeof args.namePattern === "string") params.namePattern = args.namePattern;
  if (typeof args.includeRelations === "boolean") params.includeRelations = args.includeRelations;
  if (typeof args.limit === "number") params.limit = Math.min(args.limit, 200);

  // 数据源：如果上下文提供了章节快照 ID，自动传入
  if (ctx.snapshotChapterId) {
    params.snapshotChapterId = ctx.snapshotChapterId;
  }

  // 至少有一个筛选条件
  const hasFilter = params.engine || params.type || params.name || params.keyword || params.subtype || params.namePattern;
  if (!hasFilter) {
    return errorResult(
      toolCallId,
      "query_world_setting 至少需要一个筛选条件（engine、type、name、keyword、subtype、namePattern）。" +
      "如果不确定查什么，可以先用 engine 参数查某个引擎的所有产出，或者用 keyword 做广泛搜索。"
    );
  }

  // 执行查询
  const result = await queryWorldSetting(ctx.projectId, params);

  // 格式化返回结果（包含完整 content，供 LLM 深度分析）
  const formattedItems = result.items.map((item) => ({
    id: item.id, type: item.type, name: item.name,
    summary: item.summary, content: item.content,
    tags: item.tags, engineSource: item.engineSource,
    itemSubtype: item.itemSubtype, parentItemId: item.parentItemId,
  }));

  const emptyHint = result.total === 0
    ? "查询成功，但未找到匹配的数据。这不代表查询出错——说明该条件下尚无已确认的设定条目。请尝试放宽条件、换用 engine 参数查看某引擎的全部产出、或者直接生成提案（首次生成时依赖数据为空是正常的）。"
    : (result.total >= (params.limit || 50)
      ? `返回了 ${result.total} 条结果（已达到上限），可能还有更多数据。请缩小筛选范围。`
      : `返回了 ${result.total} 条结果。`);

  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify({
      items: formattedItems,
      total: result.total,
      relations: result.relations,
      _hint: emptyHint,
    }),
  };
}

// ── 工具函数 ──

function errorResult(toolCallId: string, message: string): ToolExecutionResult {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify({ error: message }),
  };
}
