import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { AnthropicCompatibleProvider } from "./providers/anthropic-compatible";
import type { Message, LLMOptions, LLMStreamChunk, ProviderConfig } from "./types";

export type ModelTier = "lightweight" | "pro";

function loadProvider(tier: ModelTier = "lightweight"): ProviderConfig {
  const isPro = tier === "pro";
  return {
    name: process.env.LLM_PROVIDER || "deepseek",
    apiFormat: (process.env.LLM_API_FORMAT as "openai" | "anthropic") || "openai",
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
    apiKey: process.env.LLM_API_KEY || "",
    model: isPro
      ? (process.env.LLM_MODEL_HEAVY || "deepseek-v4-pro")
      : (process.env.LLM_MODEL_LIGHT || "deepseek-v4-flash"),
  };
}

function createProvider(config: ProviderConfig) {
  if (config.apiFormat === "anthropic") {
    return new AnthropicCompatibleProvider(config);
  }
  return new OpenAICompatibleProvider(config);
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

export class LLMClient {
  private lightweightProvider: ProviderConfig;
  private proProvider: ProviderConfig;
  private retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.lightweightProvider = loadProvider("lightweight");
    this.proProvider = loadProvider("pro");
    if (!this.lightweightProvider.apiKey) {
      throw new Error("LLM_API_KEY is not set in environment variables");
    }
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  async *stream(
    messages: Message[],
    options: LLMOptions & { tier?: ModelTier; timeoutMs?: number }
  ): AsyncGenerator<LLMStreamChunk> {
    // 开发阶段：强制使用轻量模型以节省成本，上线前恢复为动态 tier 切换
    const tier = "lightweight";
    const provider = options.provider || this.lightweightProvider;
    const instance = createProvider(provider);

    const timeoutMs = options.timeoutMs || 1_800_000; // 默认 30 分钟超时（复杂引擎请求可能耗时 10-30 分钟）

    yield* this.withRetry(async function* () {
      yield* instance.streamChat(messages, options);
    }, timeoutMs);
  }

  private async *withRetry(
    generatorFn: () => AsyncGenerator<LLMStreamChunk>,
    timeoutMs: number
  ): AsyncGenerator<LLMStreamChunk> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Wrap the generator with timeout
        yield* this.withTimeout(generatorFn(), timeoutMs);
        return; // Success, exit
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt >= this.retryConfig.maxRetries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          this.retryConfig.maxDelayMs
        );

        console.warn(
          `[LLMClient] Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("LLM request failed after max retries");
  }

  private async *withTimeout(
    generator: AsyncGenerator<LLMStreamChunk>,
    timeoutMs: number
  ): AsyncGenerator<LLMStreamChunk> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`LLM request timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const iterator = generator[Symbol.asyncIterator]();

    while (true) {
      const result = await Promise.race([iterator.next(), timeoutPromise]);

      if (result.done) {
        if (result.value) {
          yield result.value;
        }
        return;
      }

      yield result.value;
    }
  }

  private isRetryableError(error: any): boolean {
    // Check HTTP status codes
    if (error.status && this.retryConfig.retryableStatuses.includes(error.status)) {
      return true;
    }
    // Check error messages for common retryable conditions
    const message = error.message?.toLowerCase() || "";
    const retryablePatterns = [
      "timeout",
      "econnreset",
      "etimedout",
      "enotfound",
      "rate limit",
      "too many requests",
      "internal server error",
      "bad gateway",
      "service unavailable",
      "gateway timeout",
    ];
    return retryablePatterns.some((pattern) => message.includes(pattern));
  }
}
