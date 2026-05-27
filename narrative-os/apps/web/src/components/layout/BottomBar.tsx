import { useMemo } from 'react'
import {
  Bell, Globe2, Brain,
} from 'lucide-react'
import { useHatchStore } from '../../stores/hatch'
import { useCompanionStore } from '../../stores/companion'
import { engineLabelMap } from '../../utils/engineConfig'
import TaskBar from '../ui/TaskBar'
import LLMStatusPopup from '../editor/LLMStatusPopup'

export default function BottomBar({ onOpenProposalList }: {
  onOpenProposalList: () => void
}) {
  const phase = useHatchStore((s) => s.phase)
  const proposals = useHatchStore((s) => s.proposals)
  const settingItems = useHatchStore((s) => s.settingItems)
  const currentEngine = useHatchStore((s) => s.currentEngine)
  const companionStreaming = useCompanionStore((s) => s.isStreaming)

  const flowState = useMemo<'IDLE' | 'AI_PROCESSING' | 'REVIEWING' | 'EXECUTING' | 'WORLD_DONE'>(() => {
    if (companionStreaming || phase === 'streaming') return 'AI_PROCESSING'
    if (phase === 'waiting') return 'REVIEWING'
    if (phase === 'world_complete') return 'WORLD_DONE'
    const hasExecuting = proposals.some((p) => p.status === 'approved')
    if (hasExecuting && phase === 'idle') return 'EXECUTING'
    return 'IDLE'
  }, [phase, companionStreaming, proposals])

  const pendingCount = proposals.filter((p) => p.status === 'pending').length

  const flowColors: Record<string, { color: string; glow: string }> = {
    AI_PROCESSING: { color: 'var(--accent-violet)', glow: 'rgba(196,181,253,0.6)' },
    REVIEWING: { color: 'var(--accent-warm)', glow: 'rgba(253,230,138,0.5)' },
    EXECUTING: { color: 'var(--accent-mint)', glow: 'rgba(110,231,183,0.5)' },
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
          {flowState === 'IDLE' ? 'IDLE'
            : flowState === 'AI_PROCESSING' ? 'PROC'
            : flowState === 'REVIEWING' ? 'REVIEW'
            : 'EXEC'}
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
            background: phase === 'streaming' ? 'var(--accent-warm)' : 'var(--text-muted)',
            animation: phase === 'streaming' ? 'pulse 1.5s ease-in-out infinite' : undefined,
          }} />
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
            {phase === 'streaming' ? (currentEngine ? `生成:${engineLabelMap[currentEngine] || currentEngine}` : 'GEN')
              : phase === 'waiting' ? (currentEngine ? `等待:${engineLabelMap[currentEngine] || currentEngine}` : 'WAIT')
              : phase === 'world_complete' ? 'WORLD_DONE'
              : 'IDLE'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-mint)' }} />
          <span>已连接</span>
        </div>
      </div>
    </div>
  )
}
