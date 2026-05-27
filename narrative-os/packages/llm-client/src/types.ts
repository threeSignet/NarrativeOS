export type APIFormat = 'openai' | 'anthropic';

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinitionForLLM {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ProviderConfig {
  name: string;
  apiFormat: APIFormat;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface LLMOptions {
  provider?: ProviderConfig;
  maxTokens?: number;
  temperature?: number;
  tier?: "lightweight" | "pro";
  tools?: ToolDefinitionForLLM[];
  caller: string;
  projectId?: string;
  sessionId?: string;
  callerRefId?: string;
  callerRefType?: string;
}

export interface LLMStreamChunk {
  text: string;
  done: boolean;
  modelInfo?: { provider: string; model: string; contextLimit: number; label: string };
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  toolCalls?: ToolCall[];
  reasoning?: string;
}
