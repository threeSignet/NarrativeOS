import { useMemo, useRef, useEffect, useState } from 'react'
import {
  Loader2, Sparkles, BookOpen, Wand2, Check, CheckCircle,
  Globe2, Mountain, Swords, MapPin, Users, Package,
  FileText, Layers, PawPrint, Music, Clock, Flame, Coins, GitBranch, Scale, Eye, Pen, Ruler,
  Info, ChevronDown, ChevronRight,
} from 'lucide-react'
import type { Proposal, EngineInfo } from '../../stores/hatch'
import type { Project } from '../../stores/projects'
import { engineLabelMap } from '../../utils/engineConfig'
import { useAutoScroll } from '../../hooks/useAutoScroll'

// ── Pipeline state derived from backend engines array (already in topological order) ──
interface PipelineStep {
  key: string
  node: string
  label: string
  group: 'world' | 'studio' | 'proactive'
  status: 'completed' | 'running' | 'waiting_approval' | 'pending'
  itemCount: number
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  tone: <Globe2 size={12} />,
  'scale-designer': <Ruler size={12} />,
  geography: <Mountain size={12} />,
  'power-system': <Swords size={12} />,
  faction: <MapPin size={12} />,
  race: <PawPrint size={12} />,
  culture: <Music size={12} />,
  history: <Clock size={12} />,
  technique: <Flame size={12} />,
  economy: <Coins size={12} />,
  rules: <Scale size={12} />,
  character: <Users size={12} />,
  conflict: <Sparkles size={12} />,
  causality: <GitBranch size={12} />,
  'item-system': <Package size={12} />,
  'story-blueprint': <BookOpen size={12} />,
  'foreshadowing': <Eye size={12} />,
  'outline-generator': <FileText size={12} />,
  'volume-outline': <Layers size={12} />,
  'chapter-outline': <FileText size={12} />,
  'chapter-writer': <Pen size={12} />,
}

function computePipeline(
  engines: EngineInfo[],
  proposals: Proposal[],
  currentEngine: string | null,
  hatchGroup: 'world' | 'studio',
): PipelineStep[] {
  const approvedSources = new Set(
    proposals.filter((p) => p.status === 'approved').map((p) => p.sourceNode),
  )
  const pendingSources = new Set(
    proposals.filter((p) => p.status === 'pending').map((p) => p.sourceNode),
  )

  // 使用 engines 数组（已按拓扑序排列），过滤当前 hatchGroup
  return engines
    .filter((e) => e.group === hatchGroup)
    .map((e) => {
      const itemCount = e.itemCount || 0
      if (hatchGroup === 'world') {
        if (currentEngine === e.name) return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'running' as const, itemCount }
        if (e.hasPending || pendingSources.has(e.name)) return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'waiting_approval' as const, itemCount }
        if (e.hasData) return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'completed' as const, itemCount }
        return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'pending' as const, itemCount }
      } else {
        if (currentEngine === e.name) return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'running' as const, itemCount }
        if (pendingSources.has(e.name)) return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'waiting_approval' as const, itemCount }
        if (approvedSources.has(e.name)) return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'completed' as const, itemCount }
        return { key: e.type, node: e.name, label: e.label, group: e.group, status: 'pending' as const, itemCount }
      }
    })
}

// ── Sub-components ──

function PhaseBadge({ phase, pipeline, allEngines }: { phase: string; pipeline: PipelineStep[]; allEngines: EngineInfo[] }) {
  const completedCount = pipeline.filter((s) => s.status === 'completed').length
  // 使用全部孵化引擎数（世界+工作室）作为总数，让进度更有意义
  const total = allEngines.filter((e) => e.group === 'world' || e.group === 'studio').length

  const config: Record<string, { label: string; color: string; bg: string }> = {
    idle: { label: '待开始', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)' },
    streaming: { label: '生成中', color: 'var(--accent-violet)', bg: 'rgba(196,181,253,0.08)' },
    waiting: { label: '待审批', color: 'var(--accent-warm)', bg: 'rgba(253,230,138,0.08)' },
    waiting_phase_confirmation: { label: '待确认', color: 'var(--accent-warm)', bg: 'rgba(253,230,138,0.08)' },
    world_complete: { label: '世界完成', color: 'var(--accent-mint)', bg: 'rgba(134,239,172,0.08)' },
    complete: { label: '已完成', color: 'var(--accent-mint)', bg: 'rgba(134,239,172,0.08)' },
  }
  const cfg = config[phase] || config.idle

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}20`,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {cfg.label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {completedCount}/{total} 引擎完成
      </span>
    </div>
  )
}

function PipelineBar({ pipeline }: { pipeline: PipelineStep[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeIdx = pipeline.findIndex((s) => s.status === 'running' || s.status === 'waiting_approval')

  useEffect(() => {
    if (scrollRef.current && activeIdx >= 0) {
      const child = scrollRef.current.children[activeIdx] as HTMLElement | undefined
      child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeIdx])

  return (
    <div style={{
      position: 'relative',
      padding: '12px 0',
      borderBottom: '1px solid var(--glass-border)',
    }}>{/* Steps */}
      <div ref={scrollRef} style={{
        display: 'flex', alignItems: 'flex-start', gap: 0,
        padding: '0 20px', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {pipeline.map((step, i) => {
          const isLast = i === pipeline.length - 1

          const dotStyle = (() => {
            switch (step.status) {
              case 'completed':
                return { bg: 'rgba(134,239,172,0.15)', border: '1px solid rgba(134,239,172,0.3)', color: 'var(--accent-mint)' }
              case 'running':
                return { bg: 'rgba(196,181,253,0.2)', border: '1px solid rgba(196,181,253,0.5)', color: 'var(--accent-violet)' }
              case 'waiting_approval':
                return { bg: 'rgba(253,230,138,0.12)', border: '1px solid rgba(253,230,138,0.3)', color: 'var(--accent-warm)' }
              case 'pending':
                return { bg: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }
            }
          })()

          return (
            <div key={step.node} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, width: 44,
              }}>
                <div style={{ height: 16 }} />
                {/* Dot */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: dotStyle.bg,
                  border: dotStyle.border,
                  color: dotStyle.color,
                  position: 'relative',
                  transition: 'all 300ms var(--ease)',
                  ...(step.status === 'running' ? {
                    animation: 'pulse 1.5s ease-in-out infinite',
                    boxShadow: '0 0 12px rgba(196,181,253,0.3)',
                  } : {}),
                  ...(step.status === 'waiting_approval' ? {
                    boxShadow: '0 0 6px rgba(253,230,138,0.15)',
                  } : {}),
                }}>
                  {step.status === 'completed' ? (
                    <Check size={12} />
                  ) : step.status === 'running' ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    STEP_ICONS[step.node] || <span style={{ fontSize: 9, opacity: 0.4 }}>{step.label[0]}</span>
                  )}
                </div>
                {/* Step label */}
                <span style={{
                  fontSize: 10, color: step.status === 'pending' ? 'var(--text-muted)' : dotStyle.color,
                  fontWeight: step.status === 'running' || step.status === 'waiting_approval' ? 600 : 400,
                  whiteSpace: 'nowrap', textAlign: 'center',
                  opacity: step.status === 'pending' ? 0.5 : 1,
                }}>
                  {step.label}
                </span>
                {/* 数据计数徽标 */}
                {step.itemCount > 0 && (
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: 'var(--accent-mint)',
                    background: 'rgba(134,239,172,0.1)', borderRadius: 4,
                    padding: '1px 4px', lineHeight: 1,
                  }}>
                    {step.itemCount}
                  </span>
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{
                  width: 12, height: 2,
                  background: step.status === 'completed' ? 'rgba(134,239,172,0.3)' : 'rgba(255,255,255,0.05)',
                  marginBottom: 16,
                  flexShrink: 0,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Engine Map Panel ──

function EngineMapPanel({ engines, hatchGroup }: { engines: EngineInfo[]; hatchGroup: 'world' | 'studio' }) {
  const [expanded, setExpanded] = useState(false)

  // 使用引擎自身的 group 字段过滤，不再依赖外部 PIPELINE_DEF
  const worldEngines = engines.filter((e) => e.group === 'world')
  const studioEngines = engines.filter((e) => e.group === 'studio')

  const totalItems = engines.reduce((sum, e) => sum + e.itemCount, 0)
  const enginesWithData = engines.filter((e) => e.hasData).length

  return (
    <div style={{ borderBottom: '1px solid var(--glass-border)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11,
          fontFamily: 'var(--font-ui)',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Info size={12} />
        <span>引擎数据地图</span>
        <span style={{ color: 'var(--accent-mint)', fontWeight: 600 }}>
          {enginesWithData}/{engines.length} 引擎 · {totalItems} 条目
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* World engines */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              世界引擎
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
              {worldEngines.map((e) => {
                const stepIcons = STEP_ICONS as Record<string, React.ReactNode>
                const iconKey = e.name
                return (
                  <div key={e.type} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: e.hasData ? 'rgba(134,239,172,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${e.hasData ? 'rgba(134,239,172,0.12)' : 'rgba(255,255,255,0.04)'}`,
                    opacity: e.hasData ? 1 : 0.5,
                  }}>
                    <span style={{ color: e.hasData ? 'var(--accent-mint)' : 'var(--text-muted)', display: 'flex' }}>
                      {stepIcons[iconKey] || <span style={{ fontSize: 10 }}>●</span>}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>{e.label}</span>
                    {e.itemCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-mint)', fontFamily: 'var(--font-mono)' }}>
                        {e.itemCount}
                      </span>
                    )}
                    {e.hasPending && (
                      <span style={{ fontSize: 9, color: 'var(--accent-warm)', background: 'rgba(253,230,138,0.12)', padding: '1px 4px', borderRadius: 3 }}>
                        待审
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Studio engines */}
          {studioEngines.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                工作室引擎
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                {studioEngines.map((e) => {
                  const stepIcons = STEP_ICONS as Record<string, React.ReactNode>
                  const iconKey = e.name
                  return (
                    <div key={e.type} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6,
                      background: e.hasData ? 'rgba(134,239,172,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${e.hasData ? 'rgba(134,239,172,0.12)' : 'rgba(255,255,255,0.04)'}`,
                      opacity: e.hasData ? 1 : 0.5,
                    }}>
                      <span style={{ color: e.hasData ? 'var(--accent-mint)' : 'var(--text-muted)', display: 'flex' }}>
                        {stepIcons[iconKey] || <span style={{ fontSize: 10 }}>●</span>}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>{e.label}</span>
                      {e.itemCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-mint)', fontFamily: 'var(--font-mono)' }}>
                          {e.itemCount}
                        </span>
                      )}
                      {e.hasPending && (
                        <span style={{ fontSize: 9, color: 'var(--accent-warm)', background: 'rgba(253,230,138,0.12)', padding: '1px 4px', borderRadius: 3 }}>
                          待审
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──

export default function HatchingView({ project, phase, proposals, engines, currentEngine, streamText, lastStreamText, hatchError, onStart, hatchGroup, onStartStudio, onCompletePhase, phaseConfirmationTarget }: {
  project: Project
  phase: string
  proposals: Proposal[]
  engines: EngineInfo[]
  currentEngine: string | null
  streamText: string
  lastStreamText: string
  hatchError: string | null
  onStart: () => void
  hatchGroup: 'world' | 'studio'
  onStartStudio: () => void
  onCompletePhase?: (phase: string) => void
  phaseConfirmationTarget?: string | null
}) {
  const pipeline = useMemo(
    () => computePipeline(engines, proposals, currentEngine, hatchGroup),
    [engines, proposals, currentEngine, hatchGroup],
  )
  const pending = useMemo(
    () => proposals.filter((p) => p.status === 'pending'),
    [proposals],
  )
  const streamScroll = useAutoScroll(streamText)

  const currentEngineLabel = currentEngine ? (engineLabelMap[currentEngine] || currentEngine) : null
  const displayText = streamText || lastStreamText

  // ── Determine content by phase ──
  const renderContent = () => {
    // ── IDLE（尚未开始）──
    if (phase === 'idle' && proposals.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '48px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 420 }}>
            AI 将按照上述流水线，依次为「<b style={{ color: 'var(--text-primary)' }}>{project.title}</b>」生成世界观设定与大纲。
            每个阶段完成后，你需要在 <b style={{ color: 'var(--accent-warm)' }}>MOU 弹窗</b>中审批 AI 的提案。
          </p>
          {hatchError && (
            <div style={{ fontSize: 13, color: 'var(--accent-rose)', padding: '10px 18px', background: 'rgba(252,165,165,0.06)', borderRadius: 8, border: '1px solid rgba(252,165,165,0.12)', maxWidth: 400 }}>
              {hatchError}
            </div>
          )}
          <button onClick={onStart} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(196,181,253,0.14)', color: 'var(--accent-violet)',
            border: '1px solid rgba(196,181,253,0.25)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.14)' }}
          >
            <Wand2 size={16} />
            开始世界引擎孵化
          </button>
        </div>
      )
    }

    // ── IDLE with history（已开始但中断，如服务重启）── 显示继续推进按钮
    if (phase === 'idle' && proposals.length > 0) {
      const nextPending = pipeline.find((s) => s.status === 'pending')
      const nextLabel = nextPending ? (engineLabelMap[nextPending.node] || nextPending.label) : null
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '48px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 420 }}>
            孵化流程曾中断。点击下方按钮继续{nextLabel ? `「${nextLabel}」` : '下一阶段'}的设计。
          </p>
          {hatchError && (
            <div style={{ fontSize: 13, color: 'var(--accent-rose)', padding: '10px 18px', background: 'rgba(252,165,165,0.06)', borderRadius: 8, border: '1px solid rgba(252,165,165,0.12)', maxWidth: 400 }}>
              {hatchError}
            </div>
          )}
          <button onClick={onStart} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(196,181,253,0.14)', color: 'var(--accent-violet)',
            border: '1px solid rgba(196,181,253,0.25)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.14)' }}
          >
            <Wand2 size={16} />
            继续孵化
          </button>
        </div>
      )
    }

    // ── STREAMING ──
    if (phase === 'streaming') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-violet)' }} />
            <span style={{ fontSize: 14, color: 'var(--accent-violet)', fontWeight: 500 }}>
              AI 正在生成「{currentEngineLabel || '...'}」
            </span>
            {hatchError && (
              <span style={{ fontSize: 12, color: 'var(--accent-rose)', marginLeft: 8 }}>{hatchError}</span>
            )}
          </div>
          <div ref={streamScroll.ref} onScroll={streamScroll.handleScroll} style={{
            height: 'calc(100vh - 400px)', minHeight: 280,
            padding: 20, borderRadius: 12,
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
            fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.8,
            color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', overflowY: 'auto',
          }}>
            {streamText || 'AI 正在思考，请稍候...'}
            <span style={{ animation: 'pulse 1s ease-in-out infinite', color: 'var(--accent-violet)' }}>|</span>
          </div>
        </div>
      )
    }

    // ── WORLD_COMPLETE ──
    if (phase === 'world_complete') {
      const worldCompleted = pipeline.filter((s) => s.status === 'completed').length
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe2 size={24} style={{ color: 'var(--accent-mint)' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'var(--text-primary)', marginBottom: 6 }}>
              世界构建完成
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 420 }}>
              「{project.title}」的{worldCompleted}个世界观引擎已全部就绪。接下来进入内容生产阶段，生成大纲与章节正文。
            </p>
          </div>
          <button onClick={onStartStudio} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(196,181,253,0.14)', color: 'var(--accent-violet)',
            border: '1px solid rgba(196,181,253,0.25)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.14)' }}
          >
            <Pen size={16} />
            进入工作室阶段
          </button>
        </div>
      )
    }

    // ── COMPLETE ──
    if (phase === 'complete') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={24} style={{ color: 'var(--accent-mint)' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'var(--text-primary)', marginBottom: 6 }}>
              创作准备完成
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 400 }}>
              「{project.title}」的世界观与大纲已全部就绪。项目已进入写作模式。
            </p>
          </div>
        </div>
      )
    }

    // ── WAITING_PHASE_CONFIRMATION ──
    if (phase === 'waiting_phase_confirmation') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(253,230,138,0.08)', border: '1px solid rgba(253,230,138,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={24} style={{ color: 'var(--accent-warm)' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'var(--text-primary)', marginBottom: 6 }}>
              地理环境阶段完成
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 420 }}>
              地理环境阶段已有产出。确认完成后，系统将推进到后续世界观引擎。
            </p>
          </div>
          <button onClick={() => onCompletePhase?.(phaseConfirmationTarget || 'geography')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(253,230,138,0.12)', color: 'var(--accent-warm)',
            border: '1px solid rgba(253,230,138,0.25)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(253,230,138,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(253,230,138,0.12)' }}
          >
            <CheckCircle size={16} />
            确认阶段完成
          </button>
        </div>
      )
    }

    // ── WAITING ──
    const waitingEngine = currentEngine || pipeline.find((s) => s.status === 'waiting_approval')?.node || null
    const nextPending = pipeline.find((s) => s.status === 'pending')
    const waitingLabel = waitingEngine
      ? (engineLabelMap[waitingEngine] || waitingEngine)
      : (nextPending ? (engineLabelMap[nextPending.node] || nextPending.label) : null)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
        {/* Status line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: pending.length > 0 ? 'var(--accent-warm)' : 'var(--accent-violet)',
            boxShadow: pending.length > 0
              ? '0 0 8px var(--accent-warm)'
              : '0 0 8px var(--accent-violet)',
          }} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
            {pending.length > 0
              ? `「${waitingLabel || '...'}」方案待审批`
              : `正在准备「${waitingLabel || '下一阶段'}」...`}
          </span>
          {pending.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--accent-warm)', fontWeight: 500 }}>
              {pending.length} 个方案
            </span>
          )}
        </div>

        {/* AI reasoning (collapsible) */}
        {displayText && (
          <details style={{ marginBottom: 0 }}>
            <summary style={{
              fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '6px 0', userSelect: 'none',
            }}>
              AI 推理过程（点击展开/收起）
            </summary>
            <div style={{
              padding: 16, borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
              fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7,
              color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
              maxHeight: 260, overflowY: 'auto',
              marginTop: 6,
            }}>
              {displayText}
            </div>
          </details>
        )}

        {/* Action prompt */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '28px 20px', textAlign: 'center',
          background: pending.length > 0
            ? 'rgba(253,230,138,0.03)'
            : 'rgba(196,181,253,0.03)',
          borderRadius: 12,
          border: pending.length > 0
            ? '1px solid rgba(253,230,138,0.08)'
            : '1px solid rgba(196,181,253,0.06)',
        }}>
          {pending.length > 0 ? (
            <>
              <Sparkles size={18} style={{ color: 'var(--accent-warm)' }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 420 }}>
                {pending.length} 个方案正在 <b style={{ color: 'var(--accent-warm)' }}>MOU 弹窗</b>中等待你的审批。
                请选择最符合你设想的方案，或提出修改意见。
              </p>
            </>
          ) : (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: hatchError ? 'var(--accent-rose)' : 'var(--accent-violet)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 420 }}>
                  AI 正在准备{waitingLabel ? `「${waitingLabel}」` : '下一阶段'}的设计，请稍候...
                </p>
                {hatchError && (
                  <p style={{ fontSize: 12, color: 'var(--accent-rose)', lineHeight: 1.5, maxWidth: 420 }}>
                    {hatchError}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="animate-fade-in-up" style={{
      display: 'flex', flexDirection: 'column', flex: 1,
      padding: '24px 28px', gap: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(196,181,253,0.08)', border: '1px solid rgba(196,181,253,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} style={{ color: 'var(--accent-violet)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{
                fontFamily: 'var(--font-brand)', fontSize: 17, color: 'var(--text-primary)',
                letterSpacing: '0.01em',
              }}>
                「{project.title}」孵化中
              </h2>
              <PhaseBadge phase={phase} pipeline={pipeline} allEngines={engines} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {project.genre} · {hatchGroup === 'world' ? '世界观构建' : '大纲与内容生成'}
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline progress */}
      <PipelineBar pipeline={pipeline} />

      {/* Engine data map (collapsible) */}
      <EngineMapPanel engines={engines} hatchGroup={hatchGroup} />

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>
    </div>
  )
}
