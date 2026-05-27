import { create } from 'zustand'
import { apiFetch, apiPost } from '../api/client'
import { readSSEStream } from '../utils/sse'

export interface OutlineItem {
  id: string
  projectId: string
  title: string
  summary: string | null
  content: Record<string, any>
  status: 'draft' | 'confirmed' | 'archived'
  proposalId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface VolumeItem {
  id: string
  projectId: string
  volumeNumber: number
  title: string
  summary: string | null
  outline: Record<string, any> | null
  status: 'draft' | 'confirmed' | 'archived'
  proposalId: string | null
  wordCountTarget: number | null
  createdAt: string
  updatedAt: string
}

export interface ChapterItem {
  id: string
  projectId: string
  volumeId: string
  chapterNumber: number
  title: string
  summary: string | null
  outline: Record<string, any> | null
  status: 'draft' | 'confirmed' | 'archived'
  proposalId: string | null
  wordCountTarget: number | null
  createdAt: string
  updatedAt: string
}

type OutlinePhase = 'idle' | 'streaming' | 'done'

interface OutlineStore {
  phase: OutlinePhase
  outlines: OutlineItem[]
  volumes: VolumeItem[]
  chapters: ChapterItem[]
  streamText: string
  error: string | null
  generatingNode: string | null
  _abortController: AbortController | null
  // LLM activity callbacks — set by hatch store to track model/usage events
  _onModelInfo: ((info: { provider: string; model: string; contextLimit: number; label: string }) => void) | null
  _onUsage: ((usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void) | null

  fetchOutlines: (projectId: string) => Promise<void>
  fetchVolumes: (projectId: string) => Promise<void>
  fetchChapters: (projectId: string, volumeId: string) => Promise<void>
  generateOutline: (projectId: string) => Promise<void>
  generateVolumeOutline: (projectId: string) => Promise<void>
  generateChapterOutlines: (projectId: string, volumeId: string) => Promise<void>
  createVolume: (projectId: string, data: { title?: string; summary?: string }) => Promise<void>
  createChapter: (projectId: string, volumeId: string, data: { title?: string; summary?: string }) => Promise<void>
  abort: () => void
  reset: () => void
}

export const useOutlineStore = create<OutlineStore>((set, get) => ({
  phase: 'idle',
  outlines: [],
  volumes: [],
  chapters: [],
  streamText: '',
  error: null,
  generatingNode: null,
  _abortController: null,
  _onModelInfo: null,
  _onUsage: null,

  fetchOutlines: async (projectId) => {
    try {
      const data = await apiFetch<{ outlines: OutlineItem[] }>(`/outline/${projectId}/outline`)
      set({ outlines: data.outlines || [] })
    } catch (err) {
      console.error('[outline] fetchOutlines failed:', err)
    }
  },

  fetchVolumes: async (projectId) => {
    try {
      const data = await apiFetch<{ volumes: VolumeItem[] }>(`/outline/${projectId}/volumes`)
      set({ volumes: data.volumes || [] })
    } catch (err) {
      console.error('[outline] fetchVolumes failed:', err)
    }
  },

  fetchChapters: async (projectId, volumeId) => {
    try {
      const data = await apiFetch<{ chapters: ChapterItem[] }>(`/outline/${projectId}/volumes/${volumeId}/chapters`)
      set({ chapters: data.chapters || [] })
    } catch (err) {
      console.error('[outline] fetchChapters failed:', err)
    }
  },

  generateOutline: async (projectId) => {
    const controller = new AbortController()
    set({ phase: 'streaming', streamText: '', error: null, generatingNode: 'outline-generator', _abortController: controller })
    try {
      const res = await fetch(`/api/outline/${projectId}/outline/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      await readSSEStream(res, {
        onChunk: (text) => { set((s) => ({ streamText: s.streamText + text })) },
        onModel: get()._onModelInfo ?? undefined,
        onUsage: get()._onUsage ?? undefined,
      })
      await get().fetchOutlines(projectId)
      // Refresh MOU proposals so new outline proposals appear for review
      try {
        const { useHatchStore } = await import('./hatch')
        await useHatchStore.getState().fetchProposals(projectId)
      } catch { /* non-critical */ }
      set({ phase: 'done', generatingNode: null })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      set({ phase: 'idle', error: (err as Error).message, generatingNode: null })
    } finally {
      set({ _abortController: null })
    }
  },

  generateVolumeOutline: async (projectId) => {
    const controller = new AbortController()
    set({ phase: 'streaming', streamText: '', error: null, generatingNode: 'volume-outline', _abortController: controller })
    try {
      const res = await fetch(`/api/outline/${projectId}/volumes/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      await readSSEStream(res, {
        onChunk: (text) => { set((s) => ({ streamText: s.streamText + text })) },
        onModel: get()._onModelInfo ?? undefined,
        onUsage: get()._onUsage ?? undefined,
      })
      await get().fetchVolumes(projectId)
      // Refresh MOU proposals so new volume outline proposals appear for review
      try {
        const { useHatchStore } = await import('./hatch')
        await useHatchStore.getState().fetchProposals(projectId)
      } catch { /* non-critical */ }
      set({ phase: 'done', generatingNode: null })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      set({ phase: 'idle', error: (err as Error).message, generatingNode: null })
    } finally {
      set({ _abortController: null })
    }
  },

  generateChapterOutlines: async (projectId, volumeId) => {
    const controller = new AbortController()
    set({ phase: 'streaming', streamText: '', error: null, generatingNode: 'chapter-outline', _abortController: controller })
    try {
      const res = await fetch(`/api/outline/${projectId}/volumes/${volumeId}/chapters/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      await readSSEStream(res, {
        onChunk: (text) => { set((s) => ({ streamText: s.streamText + text })) },
        onModel: get()._onModelInfo ?? undefined,
        onUsage: get()._onUsage ?? undefined,
      })
      await Promise.all([get().fetchVolumes(projectId), get().fetchChapters(projectId, volumeId)])
      // Refresh MOU proposals so new chapter outline proposals appear for review
      try {
        const { useHatchStore } = await import('./hatch')
        await useHatchStore.getState().fetchProposals(projectId)
      } catch { /* non-critical */ }
      set({ phase: 'done', generatingNode: null })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      set({ phase: 'idle', error: (err as Error).message, generatingNode: null })
    } finally {
      set({ _abortController: null })
    }
  },

  createVolume: async (projectId, data) => {
    try {
      await apiPost(`/outline/${projectId}/volumes`, data)
      await get().fetchVolumes(projectId)
    } catch (err) {
      console.error('[outline] createVolume failed:', err)
    }
  },

  createChapter: async (projectId, volumeId, data) => {
    try {
      await apiPost(`/outline/${projectId}/volumes/${volumeId}/chapters`, data)
      await get().fetchChapters(projectId, volumeId)
    } catch (err) {
      console.error('[outline] createChapter failed:', err)
    }
  },

  abort: () => {
    const controller = get()._abortController
    if (controller) {
      controller.abort()
      set({ _abortController: null, phase: 'idle', generatingNode: null })
    }
  },

  reset: () => {
    get()._abortController?.abort()
    set({ phase: 'idle', outlines: [], volumes: [], chapters: [], streamText: '', error: null, generatingNode: null, _abortController: null, _onModelInfo: null, _onUsage: null })
  },
}))

