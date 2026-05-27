/**
 * 共享 SSE (Server-Sent Events) 流解析器
 * 消除 hatch store 和 outline store 中重复的 SSE 读取逻辑
 */

export interface SSEHandlers {
  /** LLM 模型信息（model 事件） */
  onModel?: (info: { provider: string; model: string; contextLimit: number; label: string }) => void;
  /** Token 用量（usage 事件） */
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
  /** 流式文本块（chunk 事件的 text 字段） */
  onChunk?: (text: string) => void;
  /** 错误事件 */
  onError?: (message: string) => void;
  /** 提案暂存完成（staged 事件） */
  onStaged?: () => void;
  /** 流结束（done 事件），携带内嵌的提案数据 */
  onDone?: (data: Record<string, unknown>) => void;
  /** LLM 工具调用开始（tool_call 事件） */
  onToolCall?: (data: { toolCallId: string; toolName: string; args: Record<string, unknown> }) => void;
  /** LLM 工具调用结果（tool_result 事件） */
  onToolResult?: (data: { toolCallId: string; summary: string }) => void;
  /** LLM 开始生成最终内容（generation 事件） */
  onGeneration?: (data: { start: boolean }) => void;
  /** 兜底：捕获所有未被上述 handler 处理的事件类型 */
  onEvent?: (eventType: string, data: Record<string, unknown>) => void;
}

/**
 * 读取 SSE 响应流，按事件类型分发给对应的 handler
 * 支持标准 SSE 协议：event: <type>\ndata: <json>\n\n
 * 也支持多行 data（合并后解析）
 */
export async function readSSEStream(res: Response, handlers: SSEHandlers): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = "";
  let dataLines: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLines.push(line.slice(6));
      } else if (line === "" || line === "\r") {
        // 空行 = 事件边界，触发分发
        if (currentEventType && dataLines.length > 0) {
          const raw = dataLines.join("\n");
          try {
            const parsed = JSON.parse(raw);
            dispatch(currentEventType, parsed, handlers);
          } catch {
            /* 跳过格式错误的 JSON */
          }
        }
        currentEventType = "";
        dataLines = [];
      }
    }
  }
  // 处理最后可能残留的事件（没有以空行结尾的情况）
  if (currentEventType && dataLines.length > 0) {
    const raw = dataLines.join("\n");
    try {
      const parsed = JSON.parse(raw);
      dispatch(currentEventType, parsed, handlers);
    } catch { /* 跳过 */ }
  }
}

function dispatch(eventType: string, data: Record<string, unknown>, h: SSEHandlers): void {
  switch (eventType) {
    case "model":
      if (h.onModel) h.onModel(data as any);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "usage":
      if (h.onUsage) h.onUsage(data as any);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "chunk":
      if (h.onChunk && data.text) h.onChunk(data.text as string);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "error":
      if (h.onError) h.onError((data.message as string) || "未知错误");
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "staged":
      if (h.onStaged) h.onStaged();
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "done":
      if (h.onDone) h.onDone(data);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "tool_call":
      if (h.onToolCall) h.onToolCall(data as any);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "tool_result":
      if (h.onToolResult) h.onToolResult(data as any);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "generation":
      if (h.onGeneration) h.onGeneration(data as any);
      else if (h.onEvent) h.onEvent(eventType, data);
      break;
    case "session":
    case "engine_name":
      if (h.onEvent) h.onEvent(eventType, data);
      break;
    default:
      if (h.onEvent) h.onEvent(eventType, data);
  }
}
