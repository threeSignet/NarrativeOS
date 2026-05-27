import { ArrowRight, Sparkles, MessageSquare, Wand2, Shrink, Scissors, Brain, ShieldCheck } from 'lucide-react'

// 编辑器右上角竖排圆形操作按钮（参考 demo.html .editor-actions）
const ACTIONS = [
  { key: 'continue', label: '续写', icon: <ArrowRight size={16} /> },
  { key: 'polish', label: '润色', icon: <Sparkles size={16} /> },
  { key: 'dialogue', label: '对话优化', icon: <MessageSquare size={16} /> },
  { key: 'fix', label: '修正', icon: <Wand2 size={16} /> },
  { key: 'expand', label: '展开', icon: <Shrink size={16} /> },
  { key: 'deai', label: '去AI味', icon: <Scissors size={16} /> },
  { key: 'memory', label: '查记忆', icon: <Brain size={16} /> },
  { key: 'consistency', label: '检查一致性', icon: <ShieldCheck size={16} /> },
]

interface EditorActionRailProps {
  onAction: (action: string) => void
  activeAction?: string | null
}

export default function EditorActionRail({ onAction, activeAction }: EditorActionRailProps) {
  return (
    <div style={{
      position: 'absolute', top: 0, right: 12, zIndex: 60,
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '8px 0',
    }}>
      {ACTIONS.map((act) => (
        <button
          key={act.key}
          data-tip={act.label}
          onClick={() => onAction(act.key)}
          className={`editor-action-btn${activeAction === act.key ? ' active-action' : ''}`}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: activeAction === act.key
              ? 'rgba(196,181,253,0.12)'
              : 'rgba(255,255,255,0.04)',
            color: activeAction === act.key
              ? 'var(--accent-violet)'
              : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--duration) var(--ease)',
            backdropFilter: 'blur(12px)',
            ...(activeAction === act.key ? { border: '1px solid rgba(196,181,253,0.2)' } : {}),
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.transform = 'scale(1.08)'
          }}
          onMouseLeave={(e) => {
            if (activeAction !== act.key) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {act.icon}
        </button>
      ))}
    </div>
  )
}
