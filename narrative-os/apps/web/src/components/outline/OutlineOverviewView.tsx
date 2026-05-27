import { useEffect, useState } from 'react'
import {
  ChevronRight, BookOpen, FileText,
} from 'lucide-react'
import { useOutlineStore } from '../../stores/outline'
import { useHatchStore } from '../../stores/hatch'
import type { Project } from '../../stores/projects'
import { useAutoScroll } from '../../hooks/useAutoScroll'

export default function OutlineOverviewView({ project, onBack, onOpenOutlineDetail }: {
  project: Project
  onBack: () => void
  onOpenOutlineDetail: (title: string, outline: Record<string, any>) => void
}) {
  const volumes = useOutlineStore((s) => s.volumes)
  const chapters = useOutlineStore((s) => s.chapters)
  const fetchVolumes = useOutlineStore((s) => s.fetchVolumes)
  const fetchChapters = useOutlineStore((s) => s.fetchChapters)
  const generateOutline = useOutlineStore((s) => s.generateOutline)
  const generateVolumeOutline = useOutlineStore((s) => s.generateVolumeOutline)
  const generateChapterOutlines = useOutlineStore((s) => s.generateChapterOutlines)
  const outlinePhase = useOutlineStore((s) => s.phase)
  const streamText = useOutlineStore((s) => s.streamText)
  const generatingNode = useOutlineStore((s) => s.generatingNode)
  const settingItems = useHatchStore((s) => s.settingItems)

  const [expandedVolume, setExpandedVolume] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const streamScroll = useAutoScroll(streamText)

  useEffect(() => { fetchVolumes(project.id) }, [project.id, fetchVolumes])

  useEffect(() => {
    if (expandedVolume) fetchChapters(project.id, expandedVolume)
  }, [expandedVolume, project.id, fetchChapters])

  useEffect(() => {
    if (outlinePhase === 'done') setGenerating(null)
  }, [outlinePhase])

  const sortedVolumes = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)
  const confirmedChapters = chapters.filter(c => c.status === 'confirmed').length

  const getStatusDot = (ch: { status: string; outline: Record<string, any> | null }) => {
    if (ch.status === 'confirmed') return { bg: '#86efac', border: '#86efac' }
    if (ch.outline) return { bg: '#c4b5fd', border: '#c4b5fd' }
    return { bg: 'transparent', border: 'var(--text-muted)' }
  }

  const handleGenerate = async (type: 'outline' | 'volume' | 'chapters', volumeId?: string) => {
    setGenerating(`${type}-${volumeId ?? 'all'}`)
    try {
      if (type === 'outline') await generateOutline(project.id)
      else if (type === 'volume') await generateVolumeOutline(project.id)
      else if (type === 'chapters' && volumeId) await generateChapterOutlines(project.id, volumeId)
    } catch { setGenerating(null) }
  }

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px 28px', gap: 16, minHeight: 0, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={onBack}
          style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, transition: 'color var(--duration) var(--ease)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
          <span>返回</span>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BookOpen size={18} style={{ color: 'var(--accent-mint)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 16, color: 'var(--text-primary)' }}>「{project.title}」大纲总览</h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {sortedVolumes.length} 卷 · {chapters.length} 章 · {confirmedChapters} 已确认 · {settingItems.length} 条设定
          </p>
        </div>
      </div>

      {/* Streaming area */}
      {outlinePhase === 'streaming' && streamText && (
        <div ref={streamScroll.ref} style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--accent-violet)', marginBottom: 6, fontWeight: 500 }}>
            {generatingNode === 'outline-generator' ? '生成大纲' : generatingNode === 'volume-outline' ? '生成卷纲' : '生成章纲'}中...
          </div>
          <pre style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.6 }}>
            {streamText}
          </pre>
        </div>
      )}

      {/* Empty state */}
      {sortedVolumes.length === 0 && outlinePhase !== 'streaming' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
          <FileText size={32} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>还没有大纲</p>
          <button
            onClick={() => handleGenerate('outline')}
            disabled={!!generating}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'rgba(134,239,172,0.12)', color: 'var(--accent-mint)', fontSize: 13, cursor: generating ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)' }}
          >
            {generating === 'outline-all' ? '生成中...' : '生成大纲'}
          </button>
        </div>
      )}

      {/* Volume cards */}
      {sortedVolumes.map(vol => {
        const isExpanded = expandedVolume === vol.id
        const volChapters = chapters
          .filter(c => c.volumeId === vol.id)
          .sort((a, b) => a.chapterNumber - b.chapterNumber)
        const confirmed = volChapters.filter(c => c.status === 'confirmed').length
        const total = volChapters.length
        const progress = total > 0 ? confirmed / total : 0

        return (
          <div key={vol.id} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
            {/* Volume header */}
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, cursor: vol.outline ? 'pointer' : 'default', fontFamily: 'var(--font-brand)' }}
                    onClick={() => vol.outline && onOpenOutlineDetail(`卷${vol.volumeNumber}：${vol.title} — 卷纲`, vol.outline)}
                    onMouseEnter={e => vol.outline && (e.currentTarget.style.color = 'var(--accent-ice)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  >
                    卷{vol.volumeNumber}：{vol.title}
                  </span>
                  {vol.outline && (
                    <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(196,181,253,0.1)', color: 'var(--accent-violet)' }}>有卷纲</span>
                  )}
                </div>
                {vol.summary && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {vol.summary}
                  </p>
                )}
                {/* Progress bar */}
                {total > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2, background: 'var(--accent-mint)', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{confirmed}/{total}</span>
                  </div>
                )}
                {/* Status dots */}
                {total > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {volChapters.map(ch => {
                      const dot = getStatusDot(ch)
                      return (
                        <div key={ch.id} title={`${ch.title} (${ch.status})`} style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: dot.bg, border: `1.5px solid ${dot.border}`,
                        }} />
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => setExpandedVolume(isExpanded ? null : vol.id)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                >
                  {isExpanded ? '收起' : '展开'}
                </button>
                <button
                  onClick={() => handleGenerate('volume')}
                  disabled={!!generating}
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(196,181,253,0.1)', color: 'var(--accent-violet)', fontSize: 11, cursor: generating ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)' }}
                >
                  AI 调整
                </button>
              </div>
            </div>

            {/* Expanded chapter list */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--glass-border)', padding: '8px 16px 12px', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, gap: 8, fontSize: 12, marginBottom: 4 }}>
                  <FileText size={12} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>卷纲</span>
                  {vol.outline ? (
                    <>
                      <span style={{ fontSize: 10, color: 'var(--accent-mint)' }}>已生成</span>
                      <span
                        onClick={() => onOpenOutlineDetail(`卷${vol.volumeNumber}：${vol.title} — 卷纲`, vol.outline!)}
                        style={{ fontSize: 10, color: 'var(--accent-ice)', cursor: 'pointer', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(96,165,250,0.2)' }}
                      >查看</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>未生成</span>
                  )}
                </div>

                {volChapters.map(ch => {
                  const dot = getStatusDot(ch)
                  return (
                    <div
                      key={ch.id}
                      style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 5, gap: 6, fontSize: 12, cursor: ch.outline ? 'pointer' : 'default', transition: 'background var(--duration) var(--ease)' }}
                      onClick={() => ch.outline && onOpenOutlineDetail(`章${ch.chapterNumber}：${ch.title} — 章纲`, ch.outline!)}
                      onMouseEnter={e => ch.outline && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot.bg, border: `1.5px solid ${dot.border}`, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                        {ch.chapterNumber}. {ch.title}
                      </span>
                      {ch.outline ? (
                        <span style={{ fontSize: 9, color: 'var(--accent-ice)' }}>查看章纲</span>
                      ) : (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>未创建</span>
                      )}
                      {ch.wordCountTarget && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {ch.wordCountTarget >= 1000 ? `${(ch.wordCountTarget / 1000).toFixed(1)}k` : ch.wordCountTarget}
                        </span>
                      )}
                    </div>
                  )
                })}

                <div style={{ marginTop: 8, paddingLeft: 8 }}>
                  <button
                    onClick={() => handleGenerate('chapters', vol.id)}
                    disabled={!!generating}
                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: generating ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)' }}
                  >
                    {generating === `chapters-${vol.id}` ? '生成中...' : '生成章纲'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
