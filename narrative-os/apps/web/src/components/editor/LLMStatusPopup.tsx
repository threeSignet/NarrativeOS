import { useState, useRef, useEffect } from 'react'
import { Coins, X } from 'lucide-react'
import { useHatchStore, type ActiveLLMJob } from '../../stores/hatch'
import { PRICING_TABLE, type Pricing } from '@narrative-os/llm-client/src/cost'
import { MODEL_REGISTRY, type ModelMeta } from '@narrative-os/llm-client/src/models'

// 默认值用于 LLM 状态尚未更新时的占位显示
const DEFAULT_PROVIDER = 'DeepSeek'
const DEFAULT_MODEL = 'deepseek-v4-pro'
const DEFAULT_CONTEXT_LIMIT = 1_000_000

interface ModelDisplayInfo extends Pricing {
  id: string
  name: string
  contextLimit: number
}

interface ProviderDisplayInfo {
  name: string
  models: ModelDisplayInfo[]
}

// 从共享包构建前端展示配置（单点维护，随 llm-client 更新自动同步）
function buildProviderConfigs(): Record<string, ProviderDisplayInfo> {
  const configs: Record<string, ProviderDisplayInfo> = {}
  for (const [provider, models] of Object.entries(PRICING_TABLE)) {
    const modelList: ModelDisplayInfo[] = []
    for (const [modelId, pricing] of Object.entries(models)) {
      const meta: ModelMeta = MODEL_REGISTRY[modelId] || { provider, label: modelId, contextLimit: 128_000 }
      modelList.push({
        id: modelId,
        name: meta.label,
        contextLimit: meta.contextLimit,
        ...pricing,
      })
    }
    configs[provider] = { name: provider, models: modelList }
  }
  return configs
}

const PROVIDER_CONFIGS = buildProviderConfigs()

function getProviderConfig(providerName: string): ProviderDisplayInfo | null {
  const key = providerName.toLowerCase()
  return PROVIDER_CONFIGS[key] || null
}

// ── Click-outside hook ──
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [enabled, onClose, ref])
}

// ── Popup base styles ──
const popupBaseStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  background: 'rgba(12,12,22,0.95)',
  backdropFilter: 'blur(40px) saturate(1.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  zIndex: 200,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

// ── Row style for pricing table ──
function PricingRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 11, color: accent ? 'var(--accent-mint)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}

export default function LLMStatusPopup() {
  const llmStatus = useHatchStore((s) => s.llmStatus)
  const activeLLMJobs = useHatchStore((s) => s.activeLLMJobs)
  const [showJobs, setShowJobs] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const jobsRef = useRef<HTMLDivElement>(null)
  const configRef = useRef<HTMLDivElement>(null)

  const hasJobs = Object.keys(activeLLMJobs).length > 0
  useClickOutside(jobsRef, () => setShowJobs(false), showJobs)
  useClickOutside(configRef, () => setShowConfig(false), showConfig)

  const activeJobs = Object.values(activeLLMJobs).filter((j): j is ActiveLLMJob => j.active)
  const doneJobs = Object.values(activeLLMJobs).filter((j): j is ActiveLLMJob => !j.active)

  // Derived display values
  const provider = llmStatus?.provider || DEFAULT_PROVIDER
  const model = llmStatus?.model || DEFAULT_MODEL
  const contextLimit = llmStatus?.contextLimit || DEFAULT_CONTEXT_LIMIT
  const totalTokens = llmStatus?.totalTokens ?? 0
  const isActive = llmStatus?.active ?? false

  const providerConfig = getProviderConfig(provider)
  const isMultiProvider = provider === '多个'

  // When no LLM is running, show only provider name.
  // When running, show provider/model.
  const showModelInStatus = hasJobs || isActive

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {/* ── Tokens area: clickable when jobs are active ── */}
      <div
        ref={jobsRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          cursor: hasJobs ? 'pointer' : 'default',
          padding: '1px 5px',
          borderRadius: 3,
          transition: 'background var(--duration) var(--ease)',
        }}
        onClick={() => hasJobs && setShowJobs((v) => !v)}
        onMouseEnter={(e) => { if (hasJobs) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <Coins size={10} />
        <span style={{ color: 'var(--text-secondary)' }}>
          {totalTokens.toLocaleString()}
          <span style={{ color: 'var(--text-muted)' }}>/{(contextLimit / 1_000_000).toFixed(0)}M</span>
        </span>

        {/* Jobs popup */}
        {showJobs && hasJobs && (
          <div
            style={{ ...popupBaseStyle, right: 0, minWidth: 240, maxWidth: 320, padding: '10px 0' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '0 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              正在进行的 LLM
            </div>
            {activeJobs.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>没有正在进行的 LLM 活动</div>
            )}
            {activeJobs.map((job) => (
              <div key={job.jobId} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{job.jobLabel}</span>
                  <span style={{ fontSize: 10, color: 'var(--accent-warm)', animation: 'pulse 1.5s ease-in-out infinite' }}>运行中</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>{job.provider}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>/{job.model}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>In: {job.promptTokens.toLocaleString()}</span>
                  <span>Out: {job.completionTokens.toLocaleString()}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>∑ {job.totalTokens.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Provider/Model area: always clickable for config details ── */}
      <div
        ref={configRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          cursor: 'pointer',
          padding: '1px 5px',
          borderRadius: 3,
          transition: 'background var(--duration) var(--ease)',
        }}
        onClick={() => setShowConfig((v) => !v)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <span>{provider}</span>
        {showModelInStatus && (
          <span style={{ color: 'var(--text-secondary)' }}>/{model}</span>
        )}
        {isActive && (
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-warm)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        )}

        {/* Config popup: list ALL models for this provider */}
        {showConfig && (
          <div
            style={{ ...popupBaseStyle, right: 0, minWidth: 280, maxWidth: 380, padding: 0, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{provider} 模型配置</span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfig(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}
              >
                <X size={12} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isMultiProvider ? (
                // 多任务并发：按任务展示各自的供应商/模型
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {activeJobs.length + doneJobs.length} 个并发任务
                  </div>
                  {[...activeJobs, ...doneJobs].map((job) => {
                    const jobConfig = getProviderConfig(job.provider)
                    return (
                      <div key={job.jobId} style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {job.jobLabel}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          {job.provider || '未知'} / {job.model || '未知'}
                          {job.active && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-warm)', animation: 'pulse 1.5s ease-in-out infinite' }}>运行中</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          <span>∑ {job.totalTokens.toLocaleString()} tokens</span>
                          {jobConfig && (
                            <span>{(job.contextLimit / 1_000_000).toFixed(0)}M 窗口</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : providerConfig ? (
                providerConfig.models.map((m) => (
                  <div key={m.id}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{m.name}</div>
                    <PricingRow label="上下文窗口" value={`${(m.contextLimit / 1_000_000).toFixed(0)}M tokens`} />
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0' }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>
                      定价（每百万 tokens）
                    </div>
                    <PricingRow
                      label="缓存命中"
                      value={`¥${m.inputCacheHitPer1M.toFixed(4)}`}
                      accent
                    />
                    <PricingRow
                      label="缓存未命中"
                      value={`¥${m.inputCacheMissPer1M.toFixed(4)}`}
                    />
                    <PricingRow
                      label="输出"
                      value={`¥${m.outputPer1M.toFixed(4)}`}
                    />
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0' }} />
                    <PricingRow label="货币" value="CNY" />
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  暂无 {provider} 的模型配置信息
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
