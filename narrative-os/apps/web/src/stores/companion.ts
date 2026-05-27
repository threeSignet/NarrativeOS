import { create } from 'zustand'
import { useHatchStore } from './hatch'

export interface ToolCallInfo {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  display?: string
}

export interface CompanionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallInfo[]
  timestamp: number
}

interface CompanionStore {
  messages: CompanionMessage[]
  sessionId: string | null
  isStreaming: boolean
  currentStreamText: string
  currentToolCalls: ToolCallInfo[]
  error: string | null
  _abortController: AbortController | null
  _lastTokenUpdate: number
  activityText: string
  activityColor: string
  initActivityLoaded: boolean
  _activityProjectId: string | null

  sendMessage: (projectId: string, content: string) => Promise<void>
  fetchInitActivity: (projectId: string) => Promise<void>
  abort: () => void
  clearChat: () => void
}

let msgCounter = 0
function nextId(): string {
  return `msg_${Date.now()}_${++msgCounter}`
}

// Lightweight real‑time token estimator (client side, not the real tokenizer)
// CJK ~1.5 chars/token, other ~3.5 chars/token — reasonable for Chinese LLMs
function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  let other = 0
  for (const ch of text) {
    if ((ch >= '\u4e00' && ch <= '\u9fff') || (ch >= '\u3400' && ch <= '\u4dbf')) {
      cjk++
    } else {
      other++
    }
  }
  return Math.max(1, Math.ceil(cjk / 1.5 + other / 3.5))
}

export const useCompanionStore = create<CompanionStore>((set, get) => ({
  messages: [],
  sessionId: null,
  isStreaming: false,
  currentStreamText: '',
  currentToolCalls: [],
  error: null,
  _abortController: null,
  _lastTokenUpdate: 0,
  activityText: '',
  activityColor: 'var(--text-muted)',
  initActivityLoaded: false,
  _activityProjectId: null,

  abort: () => {
    const controller = get()._abortController
    if (controller) {
      controller.abort()
      set({ _abortController: null, isStreaming: false })
    }
  },

  sendMessage: async (projectId, content) => {
    const controller = new AbortController()
    const jobId = `companion:${projectId}`
    const userMsg: CompanionMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    set((s) => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
      currentStreamText: '',
      currentToolCalls: [],
      error: null,
      _abortController: controller,
    }))

    try {
      const sessionId = get().sessionId
      const res = await fetch(`/api/companion/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, sessionId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentEventType = ''
      let pendingToolCalls: ToolCallInfo[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)

              if (currentEventType === 'session') {
                set({ sessionId: parsed.sessionId })
              } else if (currentEventType === 'text') {
                const chunk = parsed.content || ''
                const newText = get().currentStreamText + chunk
                set({ currentStreamText: newText })
                // Throttled token estimation: only update hatch store LLM job
                // every ~100ms to avoid excessive cross-store re-renders
                const now = Date.now()
                if (now - get()._lastTokenUpdate > 100) {
                  const cur = useHatchStore.getState().activeLLMJobs[jobId]
                  if (cur?.active) {
                    const estimated = estimateTokens(newText)
                    useHatchStore.getState().updateLLMJob(jobId, {
                      completionTokens: estimated,
                      totalTokens: estimated,
                    })
                  }
                  set({ _lastTokenUpdate: now })
                }
              } else if (currentEventType === 'tool_call') {
                const tc: ToolCallInfo = {
                  id: parsed.id,
                  name: parsed.name,
                  args: parsed.args,
                }
                pendingToolCalls = [...pendingToolCalls, tc]
                set({ currentToolCalls: [...pendingToolCalls] })
              } else if (currentEventType === 'tool_result') {
                pendingToolCalls = pendingToolCalls.map((tc) =>
                  tc.id === parsed.id
                    ? { ...tc, result: parsed.result, display: parsed.display }
                    : tc
                )
                set({ currentToolCalls: [...pendingToolCalls] })
              } else if (currentEventType === 'model_info') {
                const info = parsed.info || parsed
                useHatchStore.getState().registerLLMJob(jobId, 'AI伙伴', {
                  provider: info.provider || '',
                  model: info.model || '',
                  label: info.label || '',
                  contextLimit: info.contextLimit || 0,
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                })
              } else if (currentEventType === 'usage') {
                const u = parsed.usage || parsed
                useHatchStore.getState().updateLLMJob(jobId, {
                  promptTokens: u.promptTokens ?? 0,
                  completionTokens: u.completionTokens ?? 0,
                  totalTokens: u.totalTokens ?? 0,
                  active: false,
                })
              } else if (currentEventType === 'done') {
                // Finalize assistant message
                const streamText = get().currentStreamText
                const toolCalls = get().currentToolCalls
                if (streamText || toolCalls.length > 0) {
                  const assistantMsg: CompanionMessage = {
                    id: nextId(),
                    role: 'assistant',
                    content: streamText,
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                    timestamp: Date.now(),
                  }
                  set((s) => ({
                    messages: [...s.messages, assistantMsg],
                    currentStreamText: '',
                    currentToolCalls: [],
                  }))
                }
                // Mark LLM job as inactive
                useHatchStore.getState().updateLLMJob(jobId, { active: false })
                set({ isStreaming: false })
              } else if (currentEventType === 'error') {
                useHatchStore.getState().updateLLMJob(jobId, { active: false })
                set({ error: parsed.message, isStreaming: false })
              } else if (currentEventType === 'activity') {
                set({
                  activityText: parsed.text || '',
                  activityColor: parsed.color || 'var(--text-muted)',
                })
              }
            } catch {
              // skip malformed JSON
            }
            currentEventType = ''
          }
        }
      }

      // Safety: if stream ended without done event
      const streamText = get().currentStreamText
      if (streamText && get().isStreaming) {
        const assistantMsg: CompanionMessage = {
          id: nextId(),
          role: 'assistant',
          content: streamText,
          timestamp: Date.now(),
        }
        set((s) => ({
          messages: [...s.messages, assistantMsg],
          currentStreamText: '',
          isStreaming: false,
        }))
      }
      // 保留已完成的 job 供底部状态栏展示
      useHatchStore.getState().updateLLMJob(jobId, { active: false })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        useHatchStore.getState().updateLLMJob(jobId, { active: false })
        return
      }
      useHatchStore.getState().updateLLMJob(jobId, { active: false })
      set({ error: (err as Error).message, isStreaming: false })
    } finally {
      set({ _abortController: null })
    }
  },

  fetchInitActivity: async (projectId) => {
    // 切换项目时立即清空旧状态，避免跨项目残留
    set({ _activityProjectId: projectId, initActivityLoaded: false, activityText: '', activityColor: 'var(--text-muted)' })
    try {
      const res = await fetch(`/api/companion/${projectId}/activity-init`, { method: 'POST' })
      if (get()._activityProjectId !== projectId) return
      const data = await res.json()
      if (data?.text) {
        set({ activityText: data.text, activityColor: data.color || '#a78bfa', initActivityLoaded: true })
      }
    } catch {
      if (get()._activityProjectId !== projectId) return
      // 网络错误时静默处理，保留默认空状态
    }
  },

  clearChat: () => {
    get()._abortController?.abort()
    set({
      messages: [],
      sessionId: null,
      isStreaming: false,
      currentStreamText: '',
      currentToolCalls: [],
      error: null,
      _abortController: null,
      activityText: '',
      activityColor: 'var(--text-muted)',
      initActivityLoaded: false,
    })
  },
}))
