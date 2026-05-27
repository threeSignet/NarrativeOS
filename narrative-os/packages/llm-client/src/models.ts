export interface ModelMeta {
  provider: string
  label: string
  contextLimit: number
}

export const MODEL_REGISTRY: Record<string, ModelMeta> = {
  'deepseek-v4-flash': { provider: 'DeepSeek', label: 'DeepSeek V4 Flash', contextLimit: 1_000_000 },
  'deepseek-v4-pro':  { provider: 'DeepSeek', label: 'DeepSeek V4 Pro',  contextLimit: 1_000_000 },
}

export function getModelMeta(model: string, providerName?: string): ModelMeta {
  const meta = MODEL_REGISTRY[model]
  if (meta) return meta
  return {
    provider: providerName || model.split('-')[0],
    label: model,
    contextLimit: 128_000,
  }
}
