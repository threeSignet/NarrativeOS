import { useEffect, useState } from 'react'
import {
  ChevronRight, Globe2, BookOpen, FileText,
} from 'lucide-react'
import { useOutlineStore } from '../../stores/outline'

export default function ChaptersPanel({ projectId, searchQuery, onNavigate }: {
  projectId: string
  searchQuery: string
  onNavigate: (target: 'settings' | 'outline' | 'volumeOutline' | 'chapterOutline' | 'chapter', id?: string) => void
}) {
  const volumes = useOutlineStore((s) => s.volumes)
  const chapters = useOutlineStore((s) => s.chapters)
  const fetchVolumes = useOutlineStore((s) => s.fetchVolumes)
  const fetchChapters = useOutlineStore((s) => s.fetchChapters)
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null)

  useEffect(() => { fetchVolumes(projectId) }, [projectId, fetchVolumes])

  useEffect(() => {
    if (expandedVolume) fetchChapters(projectId, expandedVolume)
  }, [expandedVolume, projectId, fetchChapters])

  const query = searchQuery.trim().toLowerCase()
  const sortedVolumes = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)

  const expanded = query
    ? sortedVolumes.filter(v =>
        v.title.toLowerCase().includes(query) ||
        chapters.some(c => c.volumeId === v.id && c.title.toLowerCase().includes(query))
      ).map(v => v.id)
    : expandedVolume ? [expandedVolume] : []

  const getChapterStatusDot = (ch: { status: string; outline: Record<string, any> | null }) => {
    if (ch.status === 'confirmed') return { bg: '#86efac', border: '#86efac', label: '定稿' }
    if (ch.outline) return { bg: '#c4b5fd', border: '#c4b5fd', label: '有章纲' }
    return { bg: 'transparent', border: 'var(--text-muted)', label: '未创建' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Global entries */}
      <div
        onClick={() => onNavigate('settings')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', transition: 'background var(--duration) var(--ease)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Globe2 size={13} style={{ color: 'var(--accent-violet)' }} />
          <span>设定集</span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, padding: '1.5px 5px', borderRadius: 3, background: 'rgba(196,181,253,0.08)', color: 'var(--accent-violet)' }}>总览</span>
      </div>
      <div
        onClick={() => onNavigate('outline')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', transition: 'background var(--duration) var(--ease)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={13} style={{ color: 'var(--text-muted)' }} />
          <span>大纲总览</span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, padding: '1.5px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>全局</span>
      </div>

      <div style={{ height: 1, background: 'var(--glass-border)', margin: '6px 10px' }} />

      {/* Volume/chapter tree */}
      {sortedVolumes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 10px', textAlign: 'center' }}>还没有章节，请先生成大纲</p>
      ) : sortedVolumes.map(vol => {
        const isExpanded = expanded.includes(vol.id)
        const volChapters = chapters
          .filter(c => c.volumeId === vol.id)
          .sort((a, b) => a.chapterNumber - b.chapterNumber)
        const filteredChapters = query
          ? volChapters.filter(c =>
              c.title.toLowerCase().includes(query) ||
              vol.title.toLowerCase().includes(query))
          : volChapters

        if (query && !vol.title.toLowerCase().includes(query) && filteredChapters.length === 0) return null

        return (
          <div key={vol.id} style={{ marginBottom: 2 }}>
            <div
              onClick={() => setExpandedVolume(isExpanded ? null : vol.id)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 6, cursor: 'pointer', gap: 6, transition: 'background var(--duration) var(--ease)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
              <BookOpen size={12} style={{ color: 'var(--accent-ice)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                卷{vol.volumeNumber}：{vol.title}
              </span>
            </div>

            {isExpanded && (
              <div style={{ marginLeft: 16 }}>
                <div
                  onClick={() => onNavigate('volumeOutline', vol.id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', gap: 6, fontSize: 11, color: 'var(--text-secondary)', transition: 'background var(--duration) var(--ease)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FileText size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>卷纲</span>
                  {vol.outline && <span style={{ fontSize: 9, color: 'var(--accent-mint)' }}>已生成</span>}
                </div>

                {filteredChapters.map(ch => {
                  const dot = getChapterStatusDot(ch)
                  return (
                    <div
                      key={ch.id}
                      onClick={() => onNavigate(ch.outline ? 'chapter' : 'chapterOutline', ch.id)}
                      style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', gap: 6, fontSize: 11, transition: 'background var(--duration) var(--ease)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: dot.bg,
                        border: `1.5px solid ${dot.border}`,
                      }} />
                      <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ch.chapterNumber}. {ch.title}
                      </span>
                      {ch.wordCountTarget && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{ch.wordCountTarget >= 1000 ? `${(ch.wordCountTarget / 1000).toFixed(1)}k` : ch.wordCountTarget}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
