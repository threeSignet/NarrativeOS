import OpenAI from "openai";
import { db, llmLogs } from "@narrative-os/database";
import type { Message, LLMOptions, LLMStreamChunk, ProviderConfig, ToolCall } from "../types";
import { countTokens } from "../tokenizer";
import { calculateCost } from "../cost";
import { getModelMeta } from "../models";

interface StreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

function tryParseJSON(raw: string): { parsed: any; parseError?: string } {
  if (!raw) return { parsed: null };
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return { parsed: JSON.parse(cleaned) };
  } catch (e: any) {
    return { parsed: null, parseError: e.message };
  }
}

function toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, tool_call_id: m.tool_call_id!, content: m.content };
    }
    if (m.role === "assistant" && m.tool_calls) {
      const msg: Record<string, any> = {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
      if (m.reasoning_content != null) msg.reasoning_content = m.reasoning_content;
      return msg as OpenAI.ChatCompletionMessageParam;
    }
    if (m.role === "assistant" && m.reasoning_content != null) {
      const msg: Record<string, any> = { role: "assistant" as const, content: m.content };
      msg.reasoning_content = m.reasoning_content;
      return msg as OpenAI.ChatCompletionMessageParam;
    }
    return { role: m.role as "user" | "assistant" | "system", content: m.content };
  });
}

export class OpenAICompatibleProvider {
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }

  async *streamChat(
    messages: Message[],
    options: LLMOptions
  ): AsyncGenerator<LLMStreamChunk> {
    const startTime = Date.now();
    const model = this.config.model;
    const isDeepseek = this.config.name === "deepseek";

    try {
      const createParams = {
        model,
        messages: toOpenAIMessages(messages),
        temperature: options.temperature ?? 0.7,
        stream: true as const,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(isDeepseek ? { stream_options: { include_usage: true } } : {}),
        ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
      };

      const meta = getModelMeta(model, this.config.name);
      yield {
        text: "",
        done: false,
        modelInfo: {
          provider: meta.provider,
          model,
          contextLimit: meta.contextLimit,
          label: meta.label,
        },
      };

      const stream = await this.client.chat.completions.create(
        createParams as any,
        { headers: isDeepseek ? { "X-DN-Timeout": "300" } : undefined }
      ) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

      let fullResponse = "";
      let reasoningContent = "";
      let usage: StreamUsage | null = null;
      let finishReason: string | null = null;
      const toolCallsAccumulator = new Map<number, ToolCall>();
      let loggedFirstChunk = false;

      for await (const chunk of stream) {
        if (chunk.usage) {
          usage = chunk.usage as StreamUsage;
        }

        // Log first chunk structure to diagnose reasoning_content capture
        if (isDeepseek && !loggedFirstChunk) {
          loggedFirstChunk = true;
          const rawChunk = chunk as Record<string, any>;
          const choiceKeys = rawChunk.choices?.[0] ? Object.keys(rawChunk.choices[0] as object) : [];
          const deltaKeys = rawChunk.choices?.[0]?.delta ? Object.keys(rawChunk.choices[0].delta as object) : [];
          console.log(`[deepseek] first chunk: choice keys=[${choiceKeys.join(',')}] delta keys=[${deltaKeys.join(',')}]`);
          // Check if reasoning_content exists at choice level (not delta level)
          if ((rawChunk.choices?.[0] as Record<string, any>)?.reasoning_content !== undefined) {
            console.log(`[deepseek] WARNING: reasoning_content found at choice level, not delta level!`);
          }
        }

        const delta = chunk.choices[0]?.delta;
        const rawDelta = delta as Record<string, any>;
        const text = delta?.content || "";
        if (text) {
          fullResponse += text;
          yield { text, done: false };
        }

        // Capture reasoning_content from delta level (standard DeepSeek format)
        if (rawDelta?.reasoning_content) {
          reasoningContent += rawDelta.reasoning_content;
        }

        // Accumulate tool_call deltas
        const deltas = chunk.choices[0]?.delta?.tool_calls;
        if (deltas) {
          for (const delta of deltas) {
            const idx = delta.index ?? 0;
            if (!toolCallsAccumulator.has(idx)) {
              toolCallsAccumulator.set(idx, {
                id: delta.id || "",
                type: "function",
                function: {
                  name: delta.function?.name || "",
                  arguments: delta.function?.arguments || "",
                },
              });
            } else {
              const existing = toolCallsAccumulator.get(idx)!;
              if (delta.id) existing.id = delta.id;
              if (delta.function?.name) existing.function.name += delta.function.name;
              if (delta.function?.arguments) existing.function.arguments += delta.function.arguments;
            }
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      if (isDeepseek) {
        console.log(`[deepseek] reasoning_content captured: ${reasoningContent.length} chars${reasoningContent ? ` ("${reasoningContent.substring(0, 80)}...")` : " (EMPTY - may cause 400 on tool call follow-up)"}`);
      }

      const latencyMs = Date.now() - startTime;

      let promptTokens: number;
      let completionTokens: number;
      let totalTokens: number;
      let promptCacheHitTokens: number | undefined;
      let promptCacheMissTokens: number | undefined;

      if (isDeepseek && usage?.total_tokens) {
        promptTokens = usage.prompt_tokens ?? 0;
        completionTokens = usage.completion_tokens ?? 0;
        totalTokens = usage.total_tokens;
        promptCacheHitTokens = usage.prompt_cache_hit_tokens;
        promptCacheMissTokens = usage.prompt_cache_miss_tokens;
      } else {
        const promptTexts = messages.map((m) => m.content).join("");
        [promptTokens, completionTokens] = await Promise.all([
          countTokens(promptTexts),
          countTokens(fullResponse),
        ]);
        totalTokens = promptTokens + completionTokens;
      }

      const costResult = calculateCost({
        provider: this.config.name,
        model,
        promptTokens,
        completionTokens,
        promptCacheHitTokens,
        promptCacheMissTokens,
      });

      const { parsed, parseError } = tryParseJSON(fullResponse);
      const responseSnapshot: Record<string, any> = { parsed, raw: fullResponse };
      if (parseError) responseSnapshot.parse_error = parseError;
      if (finishReason) responseSnapshot.finish_reason = finishReason;
      if (usage) responseSnapshot.usage = usage;

      await db.insert(llmLogs).values({
        projectId: options.projectId,
        sessionId: options.sessionId,
        caller: options.caller,
        callerRefId: options.callerRefId,
        callerRefType: options.callerRefType,
        model: `${this.config.name}/${model}`,
        promptTokens,
        completionTokens,
        totalTokens,
        promptCacheHitTokens: promptCacheHitTokens ?? null,
        promptCacheMissTokens: promptCacheMissTokens ?? null,
        costUsd: `${costResult.totalCost.toFixed(6)} ${costResult.currency}`,
        latencyMs,
        status: "success",
        promptSnapshot: { messages },
        responseSnapshot,
      });

      const toolCalls = toolCallsAccumulator.size > 0
        ? Array.from(toolCallsAccumulator.values())
        : undefined;

      yield {
        text: "",
        done: true,
        usage: { promptTokens, completionTokens, totalTokens },
        toolCalls,
        reasoning: reasoningContent || undefined,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;

      await db.insert(llmLogs).values({
        projectId: options.projectId,
        sessionId: options.sessionId,
        caller: options.caller,
        model: `${this.config.name}/${this.config.model}`,
        status: "error",
        errorMessage: error.message,
        latencyMs,
        promptSnapshot: { messages },
      });
      throw error;
    }
  }
}
