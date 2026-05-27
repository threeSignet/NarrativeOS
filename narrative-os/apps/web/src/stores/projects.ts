import { create } from 'zustand'
import { apiFetch, apiPost } from '../api/client'

export interface Project {
  id: string
  title: string
  genre: string
  style: string | null
  targetWords: number | null
  coreCreativity: string | null
  platform: string | null
  status: string
  genreContract: unknown | null
  worldBible: unknown | null
  createdAt: string
  updatedAt: string
}

interface CreateProjectInput {
  title: string
  genre: string
  style?: string
  target_words?: number
  core_creativity?: string
  platform?: string
}

interface ProjectStore {
  projects: Project[]
  loading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, data: Partial<CreateProjectInput>) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  getProject: (id: string) => Promise<Project>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const list = await apiFetch<Project[]>('/projects')
      set({ projects: list, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  createProject: async (data) => {
    const project = await apiPost<Project>('/projects', data)
    set({ projects: [project, ...get().projects] })
    return project
  },

  updateProject: async (id, data) => {
    const updated = await apiFetch<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
    set({ projects: get().projects.map((p) => p.id === id ? updated : p) })
    return updated
  },

  deleteProject: async (id) => {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' })
    set({ projects: get().projects.filter((p) => p.id !== id) })
  },

  archiveProject: async (id) => {
    await apiPost(`/projects/${id}/archive`, {})
    set({ projects: get().projects.map((p) => p.id === id ? { ...p, status: 'archived' } : p) })
  },

  getProject: async (id) => {
    const cached = get().projects.find((p) => p.id === id)
    if (cached) return cached
    const project = await apiFetch<Project>(`/projects/${id}`)
    // 防止并发调用导致重复：检查当前 state 是否已被另一并发调用写入
    set((s) => {
      if (s.projects.some((p) => p.id === id)) return s
      return { projects: [project, ...s.projects] }
    })
    return project
  },
}))
