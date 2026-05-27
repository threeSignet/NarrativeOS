import { useEffect, useState, useCallback } from 'react'
import {
  ChevronRight, BookOpen, FileText, Sparkles, Loader2,
} from 'lucide-react'
import { useOutlineStore, type VolumeItem, type ChapterItem } from '../../stores/outline'
import { useHatchStore, type SettingItem } from '../../stores/hatch'
import { useWindowManager } from '../../stores/windowManager'
import { typeLabels } from '../../utils/entityConfig'
import type { Project } from '../../stores/projects'
import OutlineCard from './OutlineCard'
import ChapterEditor from '../editor/ChapterEditor'
import ChapterOutlinePanel from '../editor/ChapterOutlinePanel'

export default function ActiveView({ project }: { project: Project }) {
  const volumes = useOutlineStore((s) => s.volumes)
  const chapters = useOutlineStore((s) => s.chapters)
  const fetchVolumes = useOutlineStore((s) => s.fetchVolumes)
  const fetchChapters = useOutlineStore((s) => s.fetchChapters)
  const generateOutline = useOutlineStore((s) => s.generateOutline)
  const generateVolumeOutline = useOutlineStore((s) => s.generateVolumeOutline)
  const outlinePhase = useOutlineStore((s) => s.phase)
  const streamText = useOutlineStore((s) => s.streamText)
  const generatingNode = useOutlineStore((s) => s.generatingNode)
  const settingItems = useHatchStore((s) => s.settingItems)

  const openWindow = useWindowManager((s) => s.openWindow)

  const [expandedVolume, setExpandedVolume] = useState<string | null>(null)
  const [activeVolume, setActiveVolume] = useState<VolumeItem | null>(null)
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null)

  useEffect(() => {
    fetchVolumes(project.id)
  }, [project.id, fetchVolumes])

  useEffect(() => {
    if (expandedVolume) {
      fetchChapters(project.id, expandedVolume)
    }
  }, [expandedVolume, project.id, fetchChapters])

  const hasVolume = volumes.length > 0
  const isStreaming = outlinePhase === 'streaming'

  // 实体点击 → 打开实体详情浮窗
  const handleEntityClick = useCallback((entity: SettingItem) => {
    const label = typeLabels[entity.type] || entity.type
    openWindow('entity-detail', {
      title: `${label} · ${entity.name}`,
      props: { entityItem: entity },
    })
  }, [openWindow])

  const breadcrumb = [
    { label: project.title, onClick: () => { setActiveVolume(null); setActiveChapter(null) } },
    ...(activeVolume ? [{ label: `卷${activeVolume.volumeNumber}：${activeVolume.title}`, onClick: () => setActiveChapter(null) }] : []),
    ...(activeChapter ? [{ label: `章${activeChapter.chapterNumber}：${activeChapter.title}`, onClick: () => {} }] : []),
  ]

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Breadcrumb bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 28px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
        {breadcrumb.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
            <span
              onClick={item.onClick}
              style={{ fontSize: 12, color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
            >{item.label}</span>
          </div>
        ))}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', marginLeft: 4,
          background: activeChapter ? (activeChapter.status === 'confirmed' ? 'var(--accent-mint)' : 'var(--accent-warm)') : 'var(--accent-mint)',
          boxShadow: activeChapter ? '0 0 6px currentColor' : 'none',
        }} />
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header — 仅在未进入章节写作态时显示 */}
        {!activeChapter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} style={{ color: 'var(--accent-mint)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 16, color: 'var(--text-primary)' }}>「{project.title}」工作台</h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>世界观 {settingItems.length} 条设定 · {volumes.length} 卷 · {chapters.length} 章</p>
            </div>
            {!hasVolume && !isStreaming && (
              <button onClick={() => generateOutline(project.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(134,239,172,0.2)',
                background: 'rgba(134,239,172,0.12)', color: 'var(--accent-mint)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}>
                <Sparkles size={14} /> 生成大纲
              </button>
            )}
            {hasVolume && !isStreaming && (
              <button onClick={() => generateVolumeOutline(project.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(125,211,252,0.2)',
                background: 'rgba(125,211,252,0.12)', color: 'var(--accent-ice)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}>
                <Sparkles size={14} /> 生成卷纲
              </button>
            )}
          </div>
        )}

        {/* Streaming output */}
        {isStreaming && streamText && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(196,181,253,0.04)', border: '1px solid rgba(196,181,253,0.1)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: 11, color: 'var(--accent-violet)' }}>正在生成{generatingNode === 'outline-generator' ? '大纲' : generatingNode === 'volume-outline' ? '卷纲' : '章纲'}...</span>
            </div>
            {streamText}
          </div>
        )}

        {/* Outline tree — 只在未选章节时显示 */}
        {hasVolume && !activeChapter && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {volumes.map((vol) => {
            const volChapters = chapters
              .filter((ch) => ch.volumeId === vol.id)
              .sort((a, b) => a.chapterNumber - b.chapterNumber)
            return (
            <div key={vol.id}>
              <div
                onClick={() => setExpandedVolume(expandedVolume === vol.id ? null : vol.id)}
                style={{ cursor: 'pointer' }}
              >
                <OutlineCard
                  icon={<BookOpen size={14} />}
                  title={`卷${vol.volumeNumber}：${vol.title}`}
                  summary={vol.summary || '卷纲'}
                  status={vol.status}
                  hasOutline={!!vol.outline}
                  expanded={expandedVolume === vol.id}
                />
              </div>
              {expandedVolume === vol.id && (
                <div style={{ marginLeft: 20, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {volChapters.map((ch) => (
                      <div key={ch.id} onClick={() => { setActiveVolume(vol); setActiveChapter(ch) }} style={{ cursor: 'pointer' }}>
                        <OutlineCard
                          icon={<FileText size={12} />}
                          title={`章${ch.chapterNumber}：${ch.title}`}
                          summary={ch.summary || (ch.outline ? '章纲已生成' : '章纲待生成')}
                          status={ch.status}
                          hasOutline={!!ch.outline}
                          small
                          // @ts-expect-error TS6 zustand inference
                          active={activeChapter?.id === ch.id}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* Chapter editor view — 章节写作态 */}
      {activeChapter && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* 章纲浮层（写作态左侧浮层） */}
          {activeChapter.outline && (
            <ChapterOutlinePanel
              data={{
                summary: activeChapter.outline.summary || activeChapter.summary,
                keyCharacters: activeChapter.outline.keyCharacters || activeChapter.outline.key_characters,
                keyLocations: activeChapter.outline.keyLocations || activeChapter.outline.key_locations,
                keyEvents: activeChapter.outline.keyEvents || activeChapter.outline.key_events,
                toPlantForeshadowings: activeChapter.outline.toPlantForeshadowings || activeChapter.outline.to_plant_foreshadowings,
                toResolveForeshadowings: activeChapter.outline.toResolveForeshadowings || activeChapter.outline.to_resolve_foreshadowings,
                targetWords: activeChapter.wordCountTarget || activeChapter.outline.targetWords,
              }}
            />
          )}

          {/* 增强版编辑器（含实体高亮、划词工具条、实体弹窗、右侧操作按钮、内置状态栏） */}
          <ChapterEditor
            chapterId={activeChapter.id}
            projectId={project.id}
            chapter={activeChapter}
            onEntityClick={handleEntityClick}
          />
        </div>
      )}
      </div>
    </div>
  )
}
