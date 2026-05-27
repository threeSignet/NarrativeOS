/**
 * EmbeddingProvider 实现 — 硅基流动 SiliconFlow
 *
 * 使用 BAAI/bge-m3 模型（免费，1024维）。
 * SiliconFlow API 兼容 OpenAI Embedding 接口。
 */

import type { EmbeddingProvider } from "@narrative-os/database";

interface SiliconFlowEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export function loadEmbeddingConfig(): EmbeddingConfig {
  return {
    baseURL: process.env.EMBEDDING_BASE_URL || "https://api.siliconflow.cn/v1",
    apiKey: process.env.EMBEDDING_API_KEY || "",
    model: process.env.EMBEDDING_MODEL || "BAAI/bge-m3",
  };
}

export class SiliconFlowEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    const env = loadEmbeddingConfig();
    this.config = {
      baseURL: config?.baseURL || env.baseURL,
      apiKey: config?.apiKey || env.apiKey,
      model: config?.model || env.model,
    };
    if (!this.config.apiKey) {
      console.warn("[SiliconFlowEmbeddingProvider] EMBEDDING_API_KEY is not set");
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.config.apiKey) {
      throw new Error("[SiliconFlowEmbeddingProvider] EMBEDDING_API_KEY is not set");
    }
    if (texts.length === 0) return [];

    // SiliconFlow embedding API: POST /v1/embeddings
    const response = await fetch(`${this.config.baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      throw new Error(
        `[SiliconFlowEmbeddingProvider] Embedding request failed: ${response.status} ${errorText}`
      );
    }

    const data = (await response.json()) as SiliconFlowEmbeddingResponse;

    // 按 index 排序确保顺序一致
    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    if (embeddings.length !== texts.length) {
      throw new Error(
        `[SiliconFlowEmbeddingProvider] Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`
      );
    }

    return embeddings;
  }

  getModelInfo() {
    return {
      provider: "siliconflow",
      model: this.config.model,
      dimensions: 1024,
    };
  }
}

/**
 * 工厂函数：根据环境变量创建 EmbeddingProvider
 */
export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER || "siliconflow";
  switch (provider) {
    case "siliconflow":
      return new SiliconFlowEmbeddingProvider();
    default:
      console.warn(`[createEmbeddingProvider] Unknown provider "${provider}", falling back to siliconflow`);
      return new SiliconFlowEmbeddingProvider();
  }
}
