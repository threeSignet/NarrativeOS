import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

const statusLabels: Record<string, string> = {
  confirmed: '已确认',
  draft: '草稿',
  archived: '归档',
}
const statusColors: Record<string, string> = {
  confirmed: 'var(--accent-mint)',
  draft: 'var(--text-muted)',
  archived: 'var(--text-muted)',
}

export default function OutlineCard({ icon, title, summary, status, hasOutline, expanded, small, active }: {
  icon: ReactNode
  title: string
  summary: string
  status: string
  hasOutline?: boolean
  expanded?: boolean
  small?: boolean
  active?: boolean
}) {
  const statusColor = statusColors[status] || 'var(--text-muted)'
  return (
    <div style={{
      padding: small ? '6px 10px' : '8px 12px', borderRadius: 8,
      background: active ? 'rgba(125,211,252,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? 'rgba(125,211,252,0.15)' : 'var(--glass-border)'}`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ color: hasOutline !== false ? 'var(--accent-ice)' : 'var(--text-muted)' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: small ? 12 : 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
      </div>
      <div style={{ fontSize: 10, color: statusColor, padding: '2px 6px', borderRadius: 3, background: `${statusColor}10`, flexShrink: 0 }}>
        {statusLabels[status] || status}
      </div>
      {expanded !== undefined && (
        <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      )}
    </div>
  )
}
