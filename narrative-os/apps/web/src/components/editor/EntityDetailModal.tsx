import { useState, useRef, useEffect, useCallback } from 'react'
import { Save, Sparkles, Loader2, ArrowUp } from 'lucide-react'
import Modal from '../ui/Modal'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import type { SettingItem } from '../../stores/hatch'
import EntityMarkdown from './EntityMarkdown'
import { typeLabels, typeColors, formatKey } from '../../utils/entityConfig'

interface EntityDetailModalProps {
  open: boolean
  item: SettingItem | null
  allEntities: SettingItem[]
  projectId: string
  onClose: () => void
  onSaved: (item: SettingItem) => void
  inline?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let chatIdCounter = 0
function nextChatId() { return `chat_${Date.now()}_${++chatIdCounter}` }

export default function EntityDetailModal({ open, item, allEntities, projectId, onClose, onSaved: _onSaved, inline }: EntityDetailModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [contentEdits, setContentEdits] = useState<Record<string, string>>({})

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatStreaming, setIsChatStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')

  const chatBodyScroll = useAutoScroll(chatMessages.length + streamText.length)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  if (item && name !== item.name && !editing) {
    setName(item.name)
    setSummary(item.summary)
    setContentEdits({})
    setEditing(false)
  }

  useEffect(() => {
    if (!open && !inline) {
      setChatMessages([])
      setChatInput('')
      setIsChatStreaming(false)
      setStreamText('')
    }
  }, [open, inline])

  useEffect(() => {
    if (!item && inline) {
      setChatMessages([])
      setChatInput('')
      setIsChatStreaming(false)
      setStreamText('')
    }
  }, [item, inline])

  const handleChatSend = useCallback(async () => {
    const msg = chatInput.trim()
    if (!msg || isChatStreaming || !item) return

    const userMsg: ChatMessage = { id: nextChatId(), role: 'user', content: msg }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setIsChatStreaming(true)
    setStreamText('')

    try {
      const res = await fetch(`/api/companion/${projectId}/entity-adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            id: item.id,
            type: item.type,
            name: item.name,
            summary: item.summary,
            content: item.content,
          },
          message: msg,
        }),
      })

      if (!res.ok) throw new Error('Request failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setStreamText(fullText)
              }
            } catch { }
          }
        }
      }

      if (fullText) {
        setChatMessages((prev) => [...prev, { id: nextChatId(), role: 'assistant', content: fullText }])
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { id: nextChatId(), role: 'assistant', content: '抱歉，请求失败了，请稍后重试。' }])
    } finally {
      setIsChatStreaming(false)
      setStreamText('')
    }
  }, [chatInput, isChatStreaming, item, projectId])

  if (!item) return null

  const color = typeColors[item.type] || 'var(--accent-ice)'
  const label = typeLabels[item.type] || item.type

  const handleEdit = () => {
    setEditing(true)
    setName(item.name)
    setSummary(item.summary)
    setContentEdits({})
  }

  const handleContentChange = (key: string, value: string) => {
    setContentEdits((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      const updatedContent = { ...item.content }
      for (const [key, value] of Object.entries(contentEdits)) {
        updatedContent[key] = value
      }

      // Create a MOU proposal for the update instead of directly patching
      const res = await fetch(`/api/settings/items/${item.id}/propose-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          summary,
          content: updatedContent,
          reasoning: '作者手动编辑设定',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }))
        throw new Error(err.error || 'Save failed')
      }

      // Proposal created — exit editing mode and close the detail window.
      // The actual setting update will happen after MOU approval.
      // Trigger a refresh of proposals so the MOU modal can pick it up.
      setEditing(false)
      setContentEdits({})
      onClose()
    } catch (err) {
      console.error('Failed to create update proposal:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleChatSend()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const textarea = chatInputRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value
      const newValue = value.substring(0, start) + '\n' + value.substring(end)
      setChatInput(newValue)
      setTimeout(() => {
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd = start + 1
        }
      }, 0)
    }
  }

  const displayContent = { ...item.content }
  if (editing) {
    for (const [key, value] of Object.entries(contentEdits)) {
      displayContent[key] = value
    }
  }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Scrollable Entity Detail ── */}
      <div style={{ overflowY: 'auto', paddingRight: 4, marginBottom: 0, flex: 1, minHeight: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}15`, color,
            border: `1px solid ${color}25`,
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>
            {(label || item.type).slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(196,181,253,0.2)',
                  borderRadius: 8, padding: '6px 10px', outline: 'none', fontFamily: 'var(--font-ui)',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${color}12`, color, border: `1px solid ${color}20` }}>
                {label}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {new Date(item.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} 更新
              </span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
            概述
          </div>
          {editing ? (
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, resize: 'none',
                border: '1px solid rgba(196,181,253,0.2)', background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-ui)',
                outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
              }}
            />
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {item.summary}
            </div>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
              标签
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.tags.map((tag) => (
                <span key={tag} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content fields */}
        {Object.keys(displayContent).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
              详细数据
            </div>
            {renderContentFields(displayContent, editing, handleContentChange)}
          </div>
        )}

        {/* Edit/Save buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--glass-border)' }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setContentEdits({}) }} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--glass-border)',
                background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}>
                取消
              </button>
              <button onClick={handleSave} disabled={saving} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: 'rgba(134,239,172,0.12)', color: 'var(--accent-mint)', fontSize: 13,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500,
                opacity: saving ? 0.6 : 1,
              }}>
                <Save size={14} /> {saving ? '提交中...' : '提交修改提案'}
              </button>
            </>
          ) : (
            <button onClick={handleEdit} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: 13,
              cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              编辑
            </button>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--glass-border)', marginBottom: 4 }} />

      {/* ── AI Chat Section ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 120, maxHeight: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={12} style={{ color: 'var(--accent-violet)' }} />
          AI 调整助手
        </div>

        <div ref={chatBodyScroll.ref} onScroll={chatBodyScroll.handleScroll} style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '4px 4px 4px 0',
        }}>
          {chatMessages.length === 0 && !isChatStreaming && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', textAlign: 'center', lineHeight: 1.5 }}>
              询问 AI 关于如何调整「{item.name}」的建议。<br />
              例如：「这个设定太平淡了，帮我增加一些深度。」
            </div>
          )}

          {chatMessages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex', gap: 6,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                background: msg.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(196,181,253,0.15)',
                color: msg.role === 'user' ? 'var(--text-muted)' : 'var(--accent-violet)',
              }}>
                {msg.role === 'user' ? '你' : <Sparkles size={10} />}
              </div>
              <div style={{
                maxWidth: '85%',
                padding: '6px 10px', borderRadius: 6,
                background: msg.role === 'user' ? 'rgba(196,181,253,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(196,181,253,0.1)' : 'var(--glass-border)'}`,
              }}>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  <EntityMarkdown text={msg.content} entities={allEntities} />
                </div>
              </div>
            </div>
          ))}

          {isChatStreaming && streamText && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                background: 'rgba(196,181,253,0.15)', color: 'var(--accent-violet)',
              }}>
                <Sparkles size={10} />
              </div>
              <div style={{
                maxWidth: '85%',
                padding: '6px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)',
              }}>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  <EntityMarkdown text={streamText} entities={allEntities} />
                  <span style={{ animation: 'pulse 1s ease-in-out infinite', color: 'var(--accent-violet)', marginLeft: 2 }}>▍</span>
                </div>
              </div>
            </div>
          )}
          {isChatStreaming && !streamText && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0' }}>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>思考中...</span>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div style={{ marginTop: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 6,
            padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
          }}>
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="输入调整想法... Ctrl+Enter 换行"
              rows={1}
              style={{
                flex: 1, border: 'none', background: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-ui)',
                resize: 'none', lineHeight: '20px', padding: '2px 0', minHeight: 20,
                maxHeight: 80, overflowY: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word',
              }}
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || isChatStreaming}
              style={{
                width: 26, height: 26, borderRadius: 6, border: 'none', flexShrink: 0,
                background: chatInput.trim() && !isChatStreaming ? 'var(--accent-violet)' : 'rgba(255,255,255,0.06)',
                color: chatInput.trim() && !isChatStreaming ? 'var(--bg-deep)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: chatInput.trim() && !isChatStreaming ? 'pointer' : 'default',
                transition: 'all var(--duration) var(--ease)',
              }}
            >
              <ArrowUp size={12} />
            </button>
          </div>
        </div>
      </div>

    </div>
  )

  if (inline) return content

  return (
    <Modal open={open} onClose={onClose} title={label} wide={true}>
      {content}
    </Modal>
  )
}

function renderContentFields(content: Record<string, any>, editing: boolean, onChange: (key: string, value: string) => void) {
  const entries = Object.entries(content)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {entries.map(([key, value]) => {
        if (typeof value === 'string') {
          return (
            <div key={key}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                {formatKey(key)}
              </div>
              {editing ? (
                <textarea
                  value={value}
                  onChange={(e) => onChange(key, e.target.value)}
                  rows={Math.max(2, Math.ceil(value.length / 50))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, resize: 'none',
                    border: '1px solid rgba(196,181,253,0.2)', background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-ui)',
                    outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
                  }}
                />
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{value}</div>
              )}
            </div>
          )
        }
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                {formatKey(key)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {value.map((item, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                    fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                  }}>
                    {typeof item === 'string' ? item : renderObject(item)}
                  </div>
                ))}
              </div>
            </div>
          )
        }
        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                {formatKey(key)}
              </div>
              <div style={{
                padding: '12px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
              }}>
                {renderObject(value)}
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

function renderObject(obj: Record<string, any>) {
  return Object.entries(obj).map(([k, v]) => (
    <div key={k} style={{ marginBottom: 4 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatKey(k)}：</span>
      <span style={{ color: 'var(--text-secondary)' }}>{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</span>
    </div>
  ))
}
