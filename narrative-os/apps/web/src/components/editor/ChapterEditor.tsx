import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { apiFetch, apiPost } from '../../api/client'
import { useHatchStore, type SettingItem } from '../../stores/hatch'
import { EntityHighlight, updateEntityHighlightEntities } from './EntityHighlight'
import SelectionToolbar from './SelectionToolbar'
import EntityTooltip from './EntityTooltip'
import EditorActionRail from './EditorActionRail'
import type { ChapterItem } from '../../stores/outline'

interface ChapterEditorProps {
  chapterId: string
  projectId: string
  chapter?: ChapterItem | null
  initialContent?: string
  onSave?: (content: string) => void
  onEntityClick?: (entity: SettingItem) => void
}

export default function ChapterEditor({ chapterId, projectId, chapter, initialContent, onSave, onEntityClick }: ChapterEditorProps) {
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(!!initialContent)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [tooltipEntity, setTooltipEntity] = useState<SettingItem | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorDomRef = useRef<HTMLElement | null>(null)

  const settingItems = useHatchStore((s) => s.settingItems)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '开始写作...',
      }),
      EntityHighlight.configure({
        entities: settingItems,
      }),
    ],
    content: initialContent || '',
    onUpdate: ({ editor }) => {
      setDirty(true)
    },
    editorProps: {
      attributes: {
        class: 'chapter-editor',
      },
    },
    onCreate: ({ editor }) => {
      // 获取编辑器 DOM 元素引用
      editorDomRef.current = (editor.view.dom as HTMLElement)
    },
  })

  // 维持 editor DOM 引用最新
  useEffect(() => {
    if (editor) {
      editorDomRef.current = editor.view.dom as HTMLElement
    }
  }, [editor])

  // 监听实体点击事件（从 EntityHighlight 扩展发出）
  useEffect(() => {
    const dom = editorDomRef.current
    if (!dom) return

    const handleEntityClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ entityId: string }>
      const entityId = customEvent.detail?.entityId
      if (!entityId) return
      const entity = settingItems.find((item) => item.id === entityId)
      if (entity) {
        if (onEntityClick) {
          onEntityClick(entity)
        } else {
          // 显示 tooltip
          const rect = (e.target as HTMLElement)?.getBoundingClientRect()
          if (rect) {
            setTooltipEntity(entity)
            setTooltipPos({ x: rect.left, y: rect.bottom + 4 })
          }
        }
      }
    }

    dom.addEventListener('entity-click', handleEntityClick)
    return () => dom.removeEventListener('entity-click', handleEntityClick)
  }, [settingItems, onEntityClick])

  // 加载已保存内容
  useEffect(() => {
    if (!editor || loaded || !chapterId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<{ content: string | null }>(`/outline/chapters/${chapterId}/content`)
        if (!cancelled && data.content) {
          editor.commands.setContent(data.content)
        }
      } catch { /* 暂无内容 */ }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [editor, chapterId, loaded])

  // 当 settingItems 变化时更新实体高亮数据
  useEffect(() => {
    if (settingItems.length > 0) {
      updateEntityHighlightEntities(settingItems)
      // 触发编辑器重渲染以应用新实体
      editor?.commands.setMeta('entityHighlight', { entities: settingItems })
    }
  }, [editor, settingItems])

  const save = useCallback(async () => {
    if (!editor || !dirty || !chapterId) return
    setSaving(true)
    try {
      const html = editor.getHTML()
      await apiPost(`/outline/chapters/${chapterId}/content`, { content: html })
      setDirty(false)
      onSave?.(html)
    } catch (err) {
      console.error('[ChapterEditor] 保存失败:', err)
    }
    setSaving(false)
  }, [editor, dirty, chapterId, onSave])

  // 自动保存（3 秒防抖）
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => { save() }, 3000)
    return () => clearTimeout(timer)
  }, [dirty, save])

  // 键盘快捷键保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  // ── 操作处理 ──
  const handleSelectionAction = useCallback((action: string, text?: string) => {
    // 将操作信息以自定义事件发出，由父组件处理
    const event = new CustomEvent('editor-action', {
      detail: { action, text, chapterId },
      bubbles: true,
    })
    editorDomRef.current?.dispatchEvent(event)
    setActiveAction(null)
  }, [chapterId])

  const handleRailAction = useCallback((action: string) => {
    setActiveAction((prev) => prev === action ? null : action)
    const event = new CustomEvent('editor-action', {
      detail: { action, text: editor?.getText()?.substring(0, 500), chapterId, fullContent: editor?.getHTML() },
      bubbles: true,
    })
    editorDomRef.current?.dispatchEvent(event)
  }, [editor, chapterId])

  const handleTooltipOpenDetail = useCallback((entity: SettingItem) => {
    if (onEntityClick) {
      onEntityClick(entity)
    }
  }, [onEntityClick])

  // ── 编辑器顶部信息栏（面包屑+状态，与 TopBar 融合显示） ──
  const editorStatusBar = useMemo(() => {
    if (!chapter) return null
    const wordCount = editor?.getText()?.replace(/\s/g, '').length || 0
    const target = chapter.wordCountTarget || 10000
    const progress = Math.min(100, Math.round((wordCount / target) * 100))

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 24px',
        borderBottom: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.01)',
        fontSize: 12,
      }}>
        {/* 章节标题面包屑 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <span style={{ color: 'var(--text-muted)' }}>章{chapter.chapterNumber}</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{chapter.title}</span>
          {chapter.status && (
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
              background: chapter.status === 'confirmed' ? 'rgba(134,239,172,0.1)' : 'rgba(253,230,138,0.1)',
              color: chapter.status === 'confirmed' ? 'var(--accent-mint)' : 'var(--accent-warm)',
            }}>
              {chapter.status === 'confirmed' ? '定稿' : '草稿'}
            </span>
          )}
        </div>

        {/* 字数进度条 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 100, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%', borderRadius: 2,
              background: progress >= 100 ? 'var(--accent-mint)' : 'var(--accent-ice)',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {wordCount.toLocaleString()} / {target.toLocaleString()} 字
          </span>
        </div>

        {/* 保存状态 */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          {saving ? '保存中...' : dirty ? '未保存' : '已保存'}
        </span>
      </div>
    )
  }, [chapter, editor, dirty, saving])

  if (!editor) return null

  return (
    <div ref={editorContainerRef} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 编辑器顶部状态栏（与系统 TopBar 通过视觉融合） */}
      {editorStatusBar}

      {/* 编辑器正文 + 右侧操作按钮 */}
      <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
        {/* 正文区域 */}
        <div style={{
          flex: 1, overflowY: 'auto',
          maxWidth: 780, width: '100%', margin: '0 auto',
          padding: '40px 64px',
        }}>
          <EditorContent editor={editor} />
        </div>

        {/* 右侧操作按钮轨（仅在写作态显示） */}
        <EditorActionRail onAction={handleRailAction} activeAction={activeAction} />
      </div>

      {/* 划词工具条 */}
      <SelectionToolbar
        editorElement={editorDomRef.current}
        onAction={handleSelectionAction}
      />

      {/* 实体悬浮提示 */}
      <EntityTooltip
        entity={tooltipEntity}
        position={tooltipPos}
        onOpenDetail={handleTooltipOpenDetail}
        onClose={() => { setTooltipEntity(null); setTooltipPos(null) }}
      />
    </div>
  )
}
