import { memo, useRef, useState, useCallback } from 'react'
import { Sparkles, ArrowUp, Loader2 } from 'lucide-react'
import { useCompanionStore } from '../../stores/companion'
import type { SettingItem } from '../../stores/hatch'
import type { Project } from '../../stores/projects'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import EntityMarkdown from '../editor/EntityMarkdown'

const CompanionWindow = memo(function CompanionWindow({
  project, settingItems, onEntityClick,
}: {
  project: Project
  settingItems: SettingItem[]
  onEntityClick: (item: SettingItem) => void
}) {
  const messages = useCompanionStore((s) => s.messages)
  const isStreaming = useCompanionStore((s) => s.isStreaming)
  const currentStreamText = useCompanionStore((s) => s.currentStreamText)
  const currentToolCalls = useCompanionStore((s) => s.currentToolCalls)
  const sendMessage = useCompanionStore((s) => s.sendMessage)

  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const msgScroll = useAutoScroll(messages.length + currentStreamText)

  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const lineHeight = 20
    const maxHeight = lineHeight * 6
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  }, [])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    sendMessage(project.id, input.trim())
    setInput('')
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }, 0)
  }, [input, isStreaming, project.id, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value
      setInput(value.substring(0, start) + '\n' + value.substring(end))
      setTimeout(() => {
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd = start + 1
          autoResizeTextarea()
        }
      }, 0)
    }
  }, [handleSend, autoResizeTextarea])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div ref={msgScroll.ref} onScroll={msgScroll.handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              background: 'rgba(196,181,253,0.15)', color: 'var(--accent-violet)', border: '1px solid rgba(196,181,253,0.2)',
            }}>
              <Sparkles size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>AI</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <EntityMarkdown text={`欢迎来到「${project.title}」的创作空间。有什么可以帮你的？`} entities={settingItems} />
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              background: msg.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(196,181,253,0.15)',
              color: msg.role === 'user' ? 'var(--text-muted)' : 'var(--accent-violet)',
              border: `1px solid ${msg.role === 'user' ? 'var(--glass-border)' : 'rgba(196,181,253,0.2)'}`,
            }}>
              {msg.role === 'user' ? '你' : <Sparkles size={14} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                {msg.role === 'user' ? '你' : 'AI'}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <EntityMarkdown
                  text={msg.content}
                  entities={settingItems}
                  onEntityClick={onEntityClick}
                />
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {msg.toolCalls.map((tc: any) => (
                    <div key={tc.id} style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', padding: '4px 8px',
                      borderRadius: 6, background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)', color: 'var(--text-muted)',
                    }}>
                      <span style={{ color: 'var(--accent-ice)' }}>{tc.name}</span>
                      {tc.display && <span style={{ marginLeft: 8 }}>{tc.display}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && currentStreamText && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              background: 'rgba(196,181,253,0.15)', color: 'var(--accent-violet)', border: '1px solid rgba(196,181,253,0.2)',
            }}>
              <Sparkles size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>AI</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <EntityMarkdown
                  text={currentStreamText}
                  entities={settingItems}
                  onEntityClick={onEntityClick}
                />
                <span style={{ animation: 'pulse 1s ease-in-out infinite', color: 'var(--accent-violet)' }}>▍</span>
              </div>
              {currentToolCalls.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {currentToolCalls.map((tc: any) => (
                    <div key={tc.id} style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', padding: '4px 8px',
                      borderRadius: 6, background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)', color: 'var(--text-muted)',
                    }}>
                      <span style={{ color: 'var(--accent-ice)' }}>{tc.name}</span>
                      {tc.display && <span style={{ marginLeft: 8 }}>{tc.display}</span>}
                      {!tc.result && <span style={{ marginLeft: 8, animation: 'pulse 1s ease-in-out infinite' }}>...</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {isStreaming && !currentStreamText && currentToolCalls.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            思考中...
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
          transition: 'border-color var(--duration) var(--ease)',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResizeTextarea()
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入指令或问题..."
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'var(--font-ui)',
              resize: 'none',
              lineHeight: '20px',
              padding: '4px 0',
              minHeight: '20px',
              maxHeight: '120px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              alignSelf: 'center',
            }}
          />
          <button
            onClick={handleSend}
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: input.trim() ? 'var(--accent-violet)' : 'rgba(255,255,255,0.06)',
              color: input.trim() ? 'var(--bg-deep)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'all var(--duration) var(--ease)',
            }}
          >
            <ArrowUp size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Enter 发送</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Ctrl+Enter 换行</span>
        </div>
      </div>
    </div>
  )
})

export default CompanionWindow
