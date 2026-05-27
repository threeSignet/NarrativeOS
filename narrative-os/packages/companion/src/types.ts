export type ToolParameterSchema = Record<string, unknown> & {
  type: "object";
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
  }>;
  required?: string[];
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolContext {
  projectId: string;
  sessionId: string;
  callerRef: string;
}

export interface ToolResult {
  data: unknown;
  display?: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export type CompanionEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; result: unknown; display?: string }
  | { type: "usage"; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: "model_info"; info: { provider: string; model: string; contextLimit: number; label: string } }
  | { type: "activity"; text: string; color: string }
  | { type: "done"; summary: { toolCallsCount: number; iterations: number } }
  | { type: "error"; message: string };
