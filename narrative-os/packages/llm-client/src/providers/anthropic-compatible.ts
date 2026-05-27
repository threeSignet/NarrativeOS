import Anthropic from "@anthropic-ai/sdk";
import { db, llmLogs } from "@narrative-os/database";
import type { Message, LLMOptions, LLMStreamChunk, ProviderConfig } from "../types";
import { estimateTokens } from "../tokenizer";
import { calculateCost } from "../cost";

export class AnthropicCompatibleProvider {
  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL, // DeepSeek: https://api.deepseek.com/anthropic
    });
  }

  async *streamChat(
    messages: Message[],
    options: LLMOptions
  ): AsyncGenerator<LLMStreamChunk> {
    const startTime = Date.now();
    const model = this.config.model;

    try {
      // Anthropic 协议要求 system prompt 独立提取
      const systemPrompt = messages.find(m => m.role === "system")?.content || "";
      const chatMessages = messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const promptTokens = estimateTokens(JSON.stringify(messages));

      const stream = this.client.messages.stream({
        model,
        system: systemPrompt || undefined,
        messages: chatMessages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      });

      let fullResponse = "";
      let completionTokens = 0;

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const text = event.delta.text;
          fullResponse += text;
          completionTokens += estimateTokens(text);
          yield { text, done: false };
        }
      }

      const latencyMs = Date.now() - startTime;
      const totalTokens = promptTokens + completionTokens;
      const costResult = calculateCost({ provider: this.config.name, model, promptTokens, completionTokens });

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
        costUsd: costResult.totalCost.toFixed(6),
        latencyMs,
        status: "success",
        promptSnapshot: { messages },
        responseSnapshot: { text: fullResponse.substring(0, 8000) },
      });

      yield { text: "", done: true };

    } catch (error: any) {
      await db.insert(llmLogs).values({
        projectId: options.projectId,
        sessionId: options.sessionId,
        caller: options.caller,
        model: `${this.config.name}/${this.config.model}`,
        status: "error",
        errorMessage: error.message,
        latencyMs: Date.now() - startTime,
        promptSnapshot: { messages },
      });
      throw error;
    }
  }
}
