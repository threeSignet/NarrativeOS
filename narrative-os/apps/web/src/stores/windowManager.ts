import { create } from 'zustand'

export type WindowState = 'normal' | 'minimized' | 'maximized'

export interface WindowInfo {
  id: string
  type: string
  title: string
  icon?: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  minSize: { w: number; h: number }
  state: WindowState
  zIndex: number
  props: Record<string, unknown>
}

interface WindowManagerStore {
  windows: WindowInfo[]
  nextZIndex: number
  activeWindowId: string | null

  openWindow: (type: string, options?: Partial<Pick<WindowInfo, 'title' | 'position' | 'size' | 'minSize' | 'icon' | 'props'>>) => string
  closeWindow: (id: string) => void
  closeAllWindows: () => void
  focusWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  toggleMaximize: (id: string) => void
  restoreWindow: (id: string) => void
  moveWindow: (id: string, position: { x: number; y: number }) => void
  moveAndResizeWindow: (id: string, position: { x: number; y: number }, size: { w: number; h: number }) => void
  resizeWindow: (id: string, size: { w: number; h: number }) => void
  updateTitle: (id: string, title: string) => void
  updateProps: (id: string, props: Record<string, unknown>) => void
  getWindowByType: (type: string) => WindowInfo | undefined
}

let idCounter = 0

export const useWindowManager = create<WindowManagerStore>((set, get) => ({
  windows: [],
  nextZIndex: 100,
  activeWindowId: null,

  openWindow: (type, options = {}) => {
    const state = get()
    const existing = state.windows.find((w) => w.type === type && w.state !== 'minimized')
    if (existing) {
      get().focusWindow(existing.id)
      return existing.id
    }

    const minimized = state.windows.find((w) => w.type === type && w.state === 'minimized')
    if (minimized) {
      get().restoreWindow(minimized.id)
      return minimized.id
    }

    const id = `win-${++idCounter}-${Date.now()}`
    const z = state.nextZIndex + 1

    const defaults = getWindowDefaults(type)

    const win: WindowInfo = {
      id,
      type,
      title: options.title || defaults.title || type,
      icon: options.icon,
      position: options.position || defaults.position,
      size: options.size || defaults.size,
      minSize: options.minSize || defaults.minSize,
      state: 'normal',
      zIndex: z,
      props: options.props || {},
    }

    set({
      windows: [...state.windows, win],
      nextZIndex: z,
      activeWindowId: id,
    })

    return id
  },

  closeWindow: (id) => {
    set((s) => ({
      windows: s.windows.filter((w) => w.id !== id),
      activeWindowId: s.activeWindowId === id
        ? (s.windows.filter((w) => w.id !== id).sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null)
        : s.activeWindowId,
    }))
  },

  closeAllWindows: () => {
    set({ windows: [], activeWindowId: null })
  },

  focusWindow: (id) => {
    set((s) => {
      const win = s.windows.find((w) => w.id === id)
      if (!win) return s
      const z = s.nextZIndex + 1
      return {
        windows: s.windows.map((w) => w.id === id ? { ...w, zIndex: z } : w),
        nextZIndex: z,
        activeWindowId: id,
      }
    })
  },

  minimizeWindow: (id) => {
    set((s) => ({
      windows: s.windows.map((w) => w.id === id ? { ...w, state: 'minimized' as WindowState } : w),
      activeWindowId: s.activeWindowId === id
        ? (s.windows.filter((w) => w.id !== id && w.state !== 'minimized').sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null)
        : s.activeWindowId,
    }))
  },

  toggleMaximize: (id) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, state: w.state === 'maximized' ? 'normal' as WindowState : 'maximized' as WindowState }
          : w
      ),
    }))
  },

  restoreWindow: (id) => {
    const z = get().nextZIndex + 1
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, state: 'normal' as WindowState, zIndex: z } : w
      ),
      nextZIndex: z,
      activeWindowId: id,
    }))
  },

  moveWindow: (id, position) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, position } : w
      ),
    }))
  },

  // 合并 move + resize 为单次 store 更新，避免 resize 时触发两次 re-render
  moveAndResizeWindow: (id, position, size) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, position, size: { w: Math.max(w.minSize.w, size.w), h: Math.max(w.minSize.h, size.h) } } : w
      ),
    }))
  },

  resizeWindow: (id, size) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, size: { w: Math.max(w.minSize.w, size.w), h: Math.max(w.minSize.h, size.h) } } : w
      ),
    }))
  },

  updateTitle: (id, title) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, title } : w
      ),
    }))
  },

  updateProps: (id, props) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, props: { ...w.props, ...props } } : w
      ),
    }))
  },

  getWindowByType: (type) => {
    return get().windows.find((w) => w.type === type)
  },
}))

function getWindowDefaults(type: string): { title: string; position: { x: number; y: number }; size: { w: number; h: number }; minSize: { w: number; h: number } } {
  const headerHeight = 52
  const railWidth = 52
  const footerHeight = 28
  const maxWidth = window.innerWidth - railWidth
  const maxHeight = window.innerHeight - headerHeight - footerHeight

  const getPosition = (w: number, h: number) => ({
    x: Math.min(Math.max(railWidth, window.innerWidth / 2 - w / 2), window.innerWidth - w),
    y: Math.min(Math.max(headerHeight, window.innerHeight / 2 - h / 2), window.innerHeight - h - footerHeight),
  })

  const getSize = (w: number, h: number) => ({
    w: Math.min(w, maxWidth),
    h: Math.min(h, maxHeight),
  })

  switch (type) {
    case 'companion':
      const companionSize = getSize(380, 600)
      return {
        title: 'AI 伙伴',
        position: { x: Math.max(railWidth, window.innerWidth - companionSize.w), y: Math.max(headerHeight, window.innerHeight - companionSize.h - footerHeight) },
        size: companionSize,
        minSize: { w: Math.min(300, maxWidth), h: Math.min(400, maxHeight) },
      }
    case 'entity-detail':
      const entitySize = getSize(580, 640)
      return {
        title: '设定详情',
        position: getPosition(entitySize.w, entitySize.h),
        size: entitySize,
        minSize: { w: Math.min(400, maxWidth), h: Math.min(400, maxHeight) },
      }
    case 'proposal-list':
      const proposalSize = getSize(640, 560)
      return {
        title: '提案列表',
        position: getPosition(proposalSize.w, proposalSize.h),
        size: proposalSize,
        minSize: { w: Math.min(480, maxWidth), h: Math.min(360, maxHeight) },
      }
    case 'geography':
      const geoSize = getSize(960, 640)
      return {
        title: '地理引擎',
        position: getPosition(geoSize.w, geoSize.h),
        size: geoSize,
        minSize: { w: Math.min(600, maxWidth), h: Math.min(400, maxHeight) },
      }
    case 'character':
      const charSize = getSize(960, 600)
      return {
        title: '角色体系',
        position: getPosition(charSize.w, charSize.h),
        size: charSize,
        minSize: { w: Math.min(700, maxWidth), h: Math.min(450, maxHeight) },
      }
    case 'world-view':
      const worldSize = getSize(1100, 700)
      return {
        title: '世界视图',
        position: getPosition(worldSize.w, worldSize.h),
        size: worldSize,
        minSize: { w: Math.min(800, maxWidth), h: Math.min(500, maxHeight) },
      }
    default:
      const defaultSize = getSize(500, 450)
      return {
        title: type,
        position: getPosition(defaultSize.w, defaultSize.h),
        size: defaultSize,
        minSize: { w: Math.min(300, maxWidth), h: Math.min(250, maxHeight) },
      }
  }
}
