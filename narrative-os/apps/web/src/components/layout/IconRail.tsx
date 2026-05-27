import type { ReactNode } from 'react'
import { Globe2, BookOpen, Settings, Sparkles } from 'lucide-react'
import { useWindowManager } from '../../stores/windowManager'
import { useCompanionStore } from '../../stores/companion'

export default function IconRail({ activePanel, onPanelClick, projectId }: {
  activePanel: 'world' | 'chapters' | 'settings' | null
  onPanelClick: (panel: 'world' | 'chapters' | 'settings') => void
  projectId?: string
}) {
  const getWindowByType = useWindowManager((s) => s.getWindowByType)
  const openWindow = useWindowManager((s) => s.openWindow)
  const fetchInitActivity = useCompanionStore((s) => s.fetchInitActivity)

  return (
    <nav style={{
      width: 52, flexShrink: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '12px 0', gap: 4,
      background: 'rgba(255,255,255,0.015)',
      borderRight: '1px solid var(--glass-border)',
      zIndex: 90, position: 'relative',
    }}>
      <RailBtn
        icon={<Globe2 size={18} />}
        active={activePanel === 'world'}
        onClick={() => onPanelClick('world')}
        title="世界引擎"
      />
      <RailBtn
        icon={<BookOpen size={18} />}
        active={activePanel === 'chapters'}
        onClick={() => onPanelClick('chapters')}
        title="工作室"
        badge
      />
      <div style={{ flex: 1 }} />
      <RailBtn
        icon={<Sparkles size={18} />}
        active={!!getWindowByType('companion')}
        onClick={() => {
          openWindow('companion', { title: 'AI 伙伴' })
          if (projectId) fetchInitActivity(projectId)
        }}
        title="AI 伙伴"
        accent
      />
      <RailBtn
        icon={<Settings size={18} />}
        active={activePanel === 'settings'}
        onClick={() => onPanelClick('settings')}
        title="设置"
      />
    </nav>
  )
}

function RailBtn({ icon, active, onClick, title, badge, accent }: {
  icon: ReactNode; active: boolean; onClick: () => void; title: string; badge?: boolean; accent?: boolean
}) {
  const activeColor = accent ? 'var(--accent-violet)' : 'var(--accent-ice)'
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 10, border: 'none',
        background: active ? (accent ? 'rgba(196,181,253,0.12)' : 'rgba(255,255,255,0.08)') : 'transparent',
        color: active ? activeColor : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all var(--duration) var(--ease)', position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = accent ? 'var(--accent-violet)' : 'var(--text-secondary)' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
    >
      {icon}
      {active && <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: '0 3px 3px 0', background: activeColor }} />}
      {badge && <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-warm)', border: '2px solid var(--bg-deep)' }} />}
    </button>
  )
}
