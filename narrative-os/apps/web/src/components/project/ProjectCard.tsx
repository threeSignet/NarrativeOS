import { Globe2 } from 'lucide-react'
import type { Project } from '../../stores/projects'
import GlassPanel from '../ui/GlassPanel'

interface ProjectCardProps {
  project: Project
  onClick: (id: string) => void
  onContextMenu: (e: React.MouseEvent, project: Project) => void
  index: number
}

const genreColors: Record<string, string> = {
  '修仙': '#7dd3fc', '玄幻': '#c4b5fd', '科幻': '#86efac',
  '都市': '#fde68a', '历史': '#fdba74', '游戏': '#fca5a5',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatWords(n: number | null) {
  if (!n) return null
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`
  return n.toLocaleString()
}

export default function ProjectCard({ project, onClick, onContextMenu, index }: ProjectCardProps) {
  const color = genreColors[project.genre] || '#7dd3fc'
  const isHatching = project.status === 'hatching'

  return (
    <GlassPanel hover onClick={() => onClick(project.id)} onContextMenu={(e: React.MouseEvent) => onContextMenu(e, project)}>
      <div className="animate-fade-in-up" style={{
        padding: '18px 20px',
        cursor: 'pointer',
        animationDelay: `${index * 60}ms`,
      }}>
        {/* Row 1: Title + Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              background: `${color}12`,
            }}>
              <Globe2 size={16} style={{ color }} />
            </div>
            <h3 style={{
              fontSize: 15, fontWeight: 500, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.title}
            </h3>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
            flexShrink: 0,
            background: isHatching ? 'rgba(196,181,253,0.08)' : 'rgba(134,239,172,0.08)',
            color: isHatching ? 'var(--accent-violet)' : 'var(--accent-mint)',
            border: `1px solid ${isHatching ? 'rgba(196,181,253,0.15)' : 'rgba(134,239,172,0.15)'}`,
          }}>
            {isHatching ? '孵化中' : '写作中'}
          </span>
        </div>

        {/* Row 2: Meta info grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr',
          gap: '4px 12px',
          fontSize: 12,
          lineHeight: '20px',
        }}>
          {/* Genre */}
          <span style={{ color: 'var(--text-muted)' }}>类型</span>
          <span style={{ color: color, fontWeight: 500 }}>{project.genre}</span>

          {/* Platform */}
          <span style={{ color: 'var(--text-muted)', justifySelf: 'end' }}>{project.platform || '--'}</span>

          {/* Words */}
          <span style={{ color: 'var(--text-muted)' }}>字数</span>
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{project.targetWords ? `${formatWords(project.targetWords)}字` : '--'}</span>

          {/* Date */}
          <span style={{ color: 'var(--text-muted)', justifySelf: 'end', fontFamily: 'var(--font-mono)' }}>{formatDate(project.createdAt)}</span>
        </div>

        {/* Row 3: Style (multi-line, only if present) */}
        {project.style && (
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            fontSize: 12, color: 'var(--text-secondary)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {project.style}
          </div>
        )}
      </div>
    </GlassPanel>
  )
}
