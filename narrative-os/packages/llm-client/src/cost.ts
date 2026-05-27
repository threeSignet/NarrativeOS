export interface Pricing {
  inputCacheHitPer1M: number;
  inputCacheMissPer1M: number;
  outputPer1M: number;
  currency: "CNY" | "USD";
}

export const PRICING_TABLE: Record<string, Record<string, Pricing>> = {
  // DeepSeek 官方定价 (2026-04-26 生效，https://api-docs.deepseek.com/quick_start/pricing)
  // 注：deepseek-v4-pro 当前 75% 折扣，截止 2026/05/31 15:59 UTC
  deepseek: {
    "deepseek-v4-flash": {
      inputCacheHitPer1M: 0.0028,
      inputCacheMissPer1M: 0.14,
      outputPer1M: 0.28,
      currency: "USD",
    },
    "deepseek-v4-pro": {
      inputCacheHitPer1M: 0.003625, // 原价 $0.0145，75% off
      inputCacheMissPer1M: 0.435,   // 原价 $1.74，75% off
      outputPer1M: 0.87,            // 原价 $3.48，75% off
      currency: "USD",
    },
  },
  // 后续按需添加
  // openai: { ... },
  // anthropic: { ... },
};

export interface CostInput {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
}

export interface CostResult {
  totalCost: number;
  currency: string;
  breakdown: {
    inputCacheHitCost: number;
    inputCacheMissCost: number;
    outputCost: number;
  };
}

export function calculateCost(input: CostInput): CostResult {
  const pricing = PRICING_TABLE[input.provider]?.[input.model];

  if (!pricing) {
    return {
      totalCost: 0,
      currency: "CNY",
      breakdown: { inputCacheHitCost: 0, inputCacheMissCost: 0, outputCost: 0 },
    };
  }

  const cacheHitTokens = input.promptCacheHitTokens ?? 0;
  const cacheMissTokens =
    input.promptCacheMissTokens ?? input.promptTokens - cacheHitTokens;

  const inputCacheHitCost = (cacheHitTokens * pricing.inputCacheHitPer1M) / 1_000_000;
  const inputCacheMissCost = (cacheMissTokens * pricing.inputCacheMissPer1M) / 1_000_000;
  const outputCost = (input.completionTokens * pricing.outputPer1M) / 1_000_000;

  return {
    totalCost: inputCacheHitCost + inputCacheMissCost + outputCost,
    currency: pricing.currency,
    breakdown: { inputCacheHitCost, inputCacheMissCost, outputCost },
  };
}
