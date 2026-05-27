import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowRight, Sparkles, Wand2, Shrink, FileText, Scissors, Send } from 'lucide-react'

// 按 demo.html 设计：选中文字后的浮层工具条
interface SelectionToolbarProps {
  editorElement: HTMLElement | null
  onAction: (action: string, text?: string) => void
}

interface ToolbarPosition {
  top: number
  left: number
}

const ACTIONS = [
  { key: 'continue', label: '续写', icon: <ArrowRight size={13} /> },
  { key: 'polish', label: '润色', icon: <Sparkles size={13} /> },
  { key: 'fix', label: '修正', icon: <Wand2 size={13} /> },
  { key: 'expand', label: '展开', icon: <Shrink size={13} /> },
  { key: 'deai', label: '去AI味', icon: <Scissors size={13} /> },
]

export default function SelectionToolbar({ editorElement, onAction }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 })
  const [customInput, setCustomInput] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const hide = useCallback(() => {
    setVisible(false)
    setCustomInput('')
    setSelectedText('')
  }, [])

  useEffect(() => {
    if (!editorElement) return

    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        hide()
        return
      }

      // 检查选区是否在编辑器内
      const range = sel.getRangeAt(0)
      if (!editorElement.contains(range.commonAncestorContainer)) {
        hide()
        return
      }

      const text = sel.toString().trim()
      if (!text) { hide(); return }

      setSelectedText(text)

      // 计算位置：选区上方居中
      const rect = range.getBoundingClientRect()
      const toolbarWidth = 320
      let left = rect.left + rect.width / 2 - toolbarWidth / 2
      // 限制在视口内
      if (left < 12) left = 12
      if (left + toolbarWidth > window.innerWidth - 12) left = window.innerWidth - toolbarWidth - 12

      const top = rect.top - 12 // 在选区上方 12px

      setPosition({ top, left })
      setVisible(true)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [editorElement, hide])

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return
    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        hide()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [visible, hide])

  const handleAction = (action: string) => {
    onAction(action, selectedText)
    hide()
  }

  const handleCustomSend = () => {
    const input = customInput.trim()
    if (!input) return
    onAction('custom', input)
    setCustomInput('')
    hide()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleCustomSend()
    }
  }

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      className="sel-toolbar"
      style={{
        position: 'fixed',
        zIndex: 150,
        top: position.top,
        left: position.left,
        transform: visible ? 'translateY(-100%)' : 'translateY(calc(-100% + 8px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        background: 'rgba(16,16,28,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms cubic-bezier(0.4,0,0.2,1), transform 150ms cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: visible ? 'auto' : 'none',
        width: 320,
      }}
    >
      {/* 操作按钮行 */}
      <div style={{
        display: 'flex', gap: 2, padding: 6,
        flexWrap: 'wrap',
      }}>
        {ACTIONS.map((act) => (
          <button
            key={act.key}
            onClick={() => handleAction(act.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, border: 'none',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 500,
              cursor: 'pointer', transition: 'all var(--duration) var(--ease)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {act.icon}
            {act.label}
          </button>
        ))}
      </div>

      {/* 自定义输入行 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <input
          ref={inputRef}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入自定义指令... Enter 发送"
          style={{
            flex: 1, border: 'none', background: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 13,
            fontFamily: 'var(--font-ui)',
            padding: '4px 6px',
          }}
        />
        <button
          onClick={handleCustomSend}
          disabled={!customInput.trim()}
          style={{
            width: 28, height: 28, borderRadius: 7, border: 'none',
            background: customInput.trim() ? 'var(--accent-violet)' : 'rgba(255,255,255,0.06)',
            color: customInput.trim() ? 'var(--bg-deep)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: customInput.trim() ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'all var(--duration) var(--ease)',
          }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  )
}
