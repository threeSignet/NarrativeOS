import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TopBar({ project, children }: {
  project?: { id: string; title: string; status: string } | null
  children?: ReactNode
}) {
  const navigate = useNavigate()
  const isHatching = project?.status === 'hatching'

  return (
    <header style={{
      height: 52, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 16,
      background: 'rgba(255,255,255,0.02)',
      borderBottom: '1px solid var(--glass-border)',
      backdropFilter: 'blur(20px)', zIndex: 100,
    }}>
      <div
        style={{
          fontFamily: 'var(--font-brand)', fontSize: 18, letterSpacing: '0.02em',
          color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
        onClick={() => navigate('/')}
      >
        NarrativeOS
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--glass-border)', flexShrink: 0 }} />
      {project && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)',
            cursor: 'pointer', padding: '6px 12px', borderRadius: 8,
            transition: 'all var(--duration) var(--ease)',
          }}
          onClick={() => navigate('/')}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {project.title}
          <span
            className={`status-dot ${isHatching ? 'status-dot-hatching' : 'status-dot-active'}`}
            style={{ width: 7, height: 7 }}
          />
        </div>
      )}
      <div style={{ flex: 1 }} />
      {isHatching && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 20,
          background: 'rgba(125,211,252,0.08)', color: 'var(--accent-ice)',
          border: '1px solid rgba(125,211,252,0.15)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-ice)', animation: 'pulse 2s ease-in-out infinite' }} />
          MOU 就绪
        </div>
      )}
      {children}
    </header>
  )
}
