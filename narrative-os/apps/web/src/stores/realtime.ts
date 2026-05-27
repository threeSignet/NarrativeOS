import { create } from 'zustand'

export interface RealtimeEvent {
  type: 'new_proposals' | 'proposal_status_changed' | 'engine_started' | 'engine_completed' | 'proposals_staged' | 'project_activated' | 'notification' | 'error' | 'pong'
    | 'engine_chunk' | 'engine_model' | 'engine_usage' | 'engine_done' | 'engine_error' | 'phase_changed'
  payload: Record<string, unknown>
}

interface RealtimeStore {
  connected: boolean
  _ws: WebSocket | null
  _reconnectTimer: ReturnType<typeof setTimeout> | null
  _listeners: Map<string, Set<(event: RealtimeEvent) => void>>

  connect: (projectId: string) => void
  disconnect: () => void
  on: (eventType: string, handler: (event: RealtimeEvent) => void) => () => void
}

const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
// 优先使用环境变量指定的 WS 端口，回退到后端默认端口 3001
const WS_PORT = (window as any).__WS_PORT__ || 3001;
const WS_BASE = `${WS_PROTO}://${window.location.hostname}:${WS_PORT}`

export const useRealtimeStore = create<RealtimeStore>((set, get) => ({
  connected: false,
  _ws: null,
  _reconnectTimer: null,
  _listeners: new Map(),

  connect: (projectId: string) => {
    const existing = get()._ws
    if (existing && existing.readyState === WebSocket.OPEN) {
      // 检查是否连接到同一项目 — 切换项目时需要断开重连
      const currentUrl = existing.url
      const expectedUrl = `${WS_BASE}/ws/${projectId}`
      if (currentUrl === expectedUrl) return
      // 不同项目，断开旧连接
      existing.close()
    }

    const ws = new WebSocket(`${WS_BASE}/ws/${projectId}`)

    let intentionalClose = false

    ws.onopen = () => {
      set({ connected: true, _ws: ws })
    }

    ws.onmessage = (event) => {
      try {
        const data: RealtimeEvent = JSON.parse(event.data)
        const listeners = get()._listeners
        const handlers = listeners.get(data.type)
        if (handlers) {
          for (const handler of handlers) {
            handler(data)
          }
        }
        const wildcardHandlers = listeners.get('*')
        if (wildcardHandlers) {
          for (const handler of wildcardHandlers) {
            handler(data)
          }
        }
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      set({ connected: false, _ws: null })
      if (intentionalClose) return
      const timer = setTimeout(() => {
        if (get()._ws === null) {
          get().connect(projectId)
        }
      }, 3000)
      set({ _reconnectTimer: timer })
    }

    ws.onerror = () => {
      console.error('[realtime] WebSocket error, will reconnect...')
      ws.close()
    }

    set({ _ws: ws })
  },

  disconnect: () => {
    const { _ws, _reconnectTimer } = get()
    if (_reconnectTimer) clearTimeout(_reconnectTimer)
    if (_ws) {
      _ws.onclose = null // prevent auto-reconnect
      _ws.close()
    }
    set({ connected: false, _ws: null, _reconnectTimer: null })
  },

  on: (eventType: string, handler: (event: RealtimeEvent) => void) => {
    const listeners = get()._listeners
    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set())
    }
    listeners.get(eventType)!.add(handler)

    // Return unsubscribe function
    return () => {
      listeners.get(eventType)?.delete(handler)
    }
  },
}))
