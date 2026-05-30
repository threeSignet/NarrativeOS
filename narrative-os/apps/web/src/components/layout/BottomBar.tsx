import { useMemo, useState, useRef, useEffect } from 'react'
import {
  Bell, Globe2, Brain, ChevronDown, Shield, Zap, Bot,
} from 'lucide-react'
import { useHatchStore } from '../../stores/hatch'
import { useCompanionStore } from '../../stores/companion'
import { useProjectStore } from '../../stores/projects'
import { getEngineDisplayLabel } from '../../utils/engineConfig'
import TaskBar from '../ui/TaskBar'
import LLMStatusPopup from '../editor/LLMStatusPopup'
import { apiFetch } from '../../api/client'

const MODE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  plan: { label: '计划模式', icon: <Shield size={10} />, color: 'var(--accent-ice)', desc: '每个引擎运行前需手动确认' },
  auto: { label: '自动模式', icon: <Zap size={10} />, color: 'var(--accent-warm)', desc: '引擎自动运行，提案需审批' },
  full_auto: { label: '全自动', icon: <Bot size={10} />, color: 'var(--accent-mint)', desc: '引擎自动运行，提案自动审批' },
}

export default function BottomBar({ projectId, onOpenProposalList }: {
  projectId?: string
  onOpenProposalList: () => void
}) {
  const phase = useHatchStore((s) => s.phase)
  const proposals = useHatchStore((s) => s.proposals)
  const settingItems = useHatchStore((s) => s.settingItems)
  const currentEngine = useHatchStore((s) => s.currentEngine)
  const refinementContext = useHatchStore((s) => s._refinementContext)
  const companionStreaming = useCompanionStore((s) => s.isStreaming)

  // ── v4.0 协作模式切换 ──
  const projects = useProjectStore((s) => s.projects)
  const currentProject = projects.find((p) => p.id === projectId)
  const currentMode = (currentProject as any)?.collaborationMode || 'auto'
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const modeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const switchMode = async (mode: string) => {
    if (!projectId) return
    try {
      await apiFetch(`/projects/${projectId}/mode`, {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      })
      // 更新本地状态
      const store = useProjectStore.getState()
      store.projects = store.projects.map((p) =>
        p.id === projectId ? { ...p, collaborationMode: mode } : p
      )
      useProjectStore.setState({ projects: [...store.projects] })
    } catch (err: any) {
      console.error('[BottomBar] 切换协作模式失败:', err.message)
    }
    setModeMenuOpen(false)
  }

  const pendingCount = proposals.filter((p) => p.status === 'pending').length
  // WAITING 阶段细分：有引擎在跑但无待审批提案 = 实际在执行
  const isExecutingInWaiting = phase === 'waiting' && currentEngine && pendingCount === 0

  const flowState = useMemo<'IDLE' | 'AI_PROCESSING' | 'REVIEWING' | 'WORLD_DONE'>(() => {
    if (companionStreaming || phase === 'streaming' || isExecutingInWaiting) return 'AI_PROCESSING'
    if (phase === 'waiting' || phase === 'waiting_phase_confirmation') return 'REVIEWING'
    if (phase === 'world_complete') return 'WORLD_DONE'
    return 'IDLE'
  }, [phase, companionStreaming, isExecutingInWaiting])

  const flowColors: Record<string, { color: string; glow: string }> = {
    AI_PROCESSING: { color: 'var(--accent-violet)', glow: 'rgba(196,181,253,0.6)' },
    REVIEWING: { color: 'var(--accent-warm)', glow: 'rgba(253,230,138,0.5)' },
    WORLD_DONE: { color: 'var(--accent-mint)', glow: 'rgba(134,239,172,0.5)' },
    IDLE: { color: 'var(--text-muted)', glow: 'rgba(255,255,255,0.2)' },
  }
  const fc = flowColors[flowState]

  return (
    <div style={{
      height: 28, flexShrink: 0, display: 'flex', alignItems: 'center',
      borderTop: '1px solid var(--glass-border)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      {/* Flow state indicator */}
      <div
        title={`心流: ${flowState}`}
        style={{
          width: 52, height: 28, flexShrink: 0,
          borderRight: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-ui)',
          color: fc.color,
          '--glow-color': fc.glow,
          animation: flowState !== 'IDLE' ? 'breathGlow 2s ease-in-out infinite' : 'none',
        } as React.CSSProperties}>
          {flowState === 'IDLE' ? '空闲'
            : flowState === 'AI_PROCESSING' ? '生成中'
            : flowState === 'REVIEWING' ? '待审'
            : '完成'}
        </span>
      </div>

      {/* TaskBar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 2px', gap: 0,
        overflowX: 'auto', flexShrink: 0,
      }}>
        <TaskBar />
      </div>

      <div style={{ flex: 1 }} />

      {/* Status info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: (phase === 'streaming' || isExecutingInWaiting) ? 'var(--accent-warm)' : 'var(--text-muted)',
            animation: (phase === 'streaming' || isExecutingInWaiting) ? 'pulse 1.5s ease-in-out infinite' : undefined,
          }} />
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
            {phase === 'streaming' || isExecutingInWaiting
              ? (currentEngine ? `生成:${getEngineDisplayLabel(currentEngine, refinementContext)}` : '生成中')
              : phase === 'waiting' ? (currentEngine ? `等待:${getEngineDisplayLabel(currentEngine, refinementContext)}` : '等待中')
              : phase === 'waiting_phase_confirmation' ? '待确认'
              : phase === 'world_complete' ? '世界完成'
              : '空闲'}
          </span>
        </div>
        <span style={{ width: 1, height: 12, background: 'var(--glass-border)' }} />
        <LLMStatusPopup />
        <span style={{ width: 1, height: 12, background: 'var(--glass-border)' }} />
        <div
          onClick={onOpenProposalList}
          style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '1px 5px', borderRadius: 3, transition: 'background var(--duration) var(--ease)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <Bell size={10} />
          <span>提案 <span style={{ color: pendingCount > 0 ? 'var(--accent-warm)' : 'var(--text-muted)' }}>{pendingCount}</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Globe2 size={10} />
          <span>设定 <span style={{ color: settingItems.length > 0 ? 'var(--accent-mint)' : 'var(--text-muted)' }}>{settingItems.length}</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Brain size={10} />
          <span>记忆 0</span>
        </div>
        <span style={{ width: 1, height: 12, background: 'var(--glass-border)' }} />

        {/* ── v4.0 协作模式切换 ── */}
        {projectId && (
          <div ref={modeMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => setModeMenuOpen((v) => !v)}
              title={MODE_CONFIG[currentMode]?.desc || ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
                padding: '1px 6px', borderRadius: 3,
                transition: 'background var(--duration) var(--ease)',
                color: MODE_CONFIG[currentMode]?.color || 'var(--text-muted)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {MODE_CONFIG[currentMode]?.icon}
              <span style={{ fontSize: 10, fontWeight: 500 }}>{MODE_CONFIG[currentMode]?.label || currentMode}</span>
              <ChevronDown size={8} style={{ opacity: 0.6 }} />
            </div>
            {modeMenuOpen && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 4px)', right: 0,
                minWidth: 160,
                background: 'rgba(12,12,22,0.95)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)', borderRadius: 8,
                padding: '6px 0', zIndex: 200,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}>
                {Object.entries(MODE_CONFIG).map(([key, cfg]) => (
                  <div
                    key={key}
                    onClick={() => switchMode(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', cursor: 'pointer',
                      background: currentMode === key ? 'rgba(255,255,255,0.06)' : 'transparent',
                      transition: 'background var(--duration) var(--ease)',
                    }}
                    onMouseEnter={(e) => { if (currentMode !== key) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={(e) => { if (currentMode !== key) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cfg.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <span style={{ width: 1, height: 12, background: 'var(--glass-border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-mint)' }} />
          <span>已连接</span>
        </div>
      </div>
    </div>
  )
}
