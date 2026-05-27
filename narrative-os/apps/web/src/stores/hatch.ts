import { create } from 'zustand'
import { apiFetch, apiPost } from '../api/client'
import { readSSEStream } from '../utils/sse'

const OUTLINE_ENGINES = new Set(['outline-generator', 'volume-outline', 'chapter-outline'])

// Lightweight real-time token estimator (client side)
// CJK ~1.5 chars/token, other ~3.5 chars/token
function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  let other = 0
  for (const ch of text) {
    if ((ch >= '一' && ch <= '鿿') || (ch >= '㐀' && ch <= '䶿')) {
      cjk++
    } else {
      other++
    }
  }
  return Math.max(1, Math.ceil(cjk / 1.5 + other / 3.5))
}

export interface PipelineSnapshot {
  systemPrompt?: string
  userPrompt?: string
  rawOutput?: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  latencyMs?: number
}

export interface Proposal {
  id: string
  projectId: string
  sessionId: string
  type: string
  title: string
  content: Record<string, any>
  status: 'pending' | 'approved' | 'rejected' | 'superseded' | 'revision_requested'
  sourceNode: string
  reasoning?: string
  rejectionNote?: string
  revisionNotes?: string
  approvedAt?: string
  pipeline?: PipelineSnapshot
  optionGroup?: string | null
  createdAt: string
}

export interface SettingItem {
  id: string
  type: string
  name: string
  summary: string
  content: Record<string, any>
  tags: string[] | null
  proposalId: string | null
  status: string
  parentItemId: string | null
  engineSource: string | null
  itemSubtype: string | null
  createdAt: string
  updatedAt: string
}

export interface SettingItemRelation {
  id: string
  sourceItemId: string
  targetItemId: string
  relationType: string
  label: string | null
  metadata: Record<string, any> | null
}

export interface LLMStatus {
  active: boolean
  provider: string
  model: string
  label: string
  contextLimit: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ActiveLLMJob extends LLMStatus {
  jobId: string
  jobLabel: string
}

// 汇总 LLM job 状态供底部状态栏显示
// 活跃 job 决定 token 总量和模型信息；无活跃 job 时显示最近完成的 job
function aggregateLLMStatus(jobs: Record<string, ActiveLLMJob>): LLMStatus | null {
  const entries = Object.values(jobs)
  if (entries.length === 0) return null

  const activeEntries = entries.filter((j) => j.active)
  const completedEntries = entries.filter((j) => !j.active)
  // 状态栏只展示活跃 job；全部完成时展示最近一个
  const displayEntries = activeEntries.length > 0
    ? activeEntries
    : completedEntries.length > 0
      ? [completedEntries[completedEntries.length - 1]]
      : entries

  if (displayEntries.length === 1) {
    const j = displayEntries[0]
    return {
      active: activeEntries.length > 0,
      provider: j.provider,
      model: j.model,
      label: j.label,
      contextLimit: j.contextLimit,
      promptTokens: j.promptTokens,
      completionTokens: j.completionTokens,
      totalTokens: j.totalTokens,
    }
  }
  const active = activeEntries.length > 0
  const totalTokens = displayEntries.reduce((sum, j) => sum + j.totalTokens, 0)
  const promptTokens = displayEntries.reduce((sum, j) => sum + j.promptTokens, 0)
  const completionTokens = displayEntries.reduce((sum, j) => sum + j.completionTokens, 0)
  const mostRecent = displayEntries[displayEntries.length - 1]
  return {
    active,
    provider: active ? '多个' : mostRecent.provider,
    model: active ? `${activeEntries.length}个任务` : mostRecent.model,
    label: active ? `${activeEntries.length}个任务运行中` : mostRecent.label,
    contextLimit: mostRecent.contextLimit,
    promptTokens,
    completionTokens,
    totalTokens,
  }
}

export interface EngineInfo {
  type: string
  name: string
  label: string
  group: 'world' | 'studio' | 'proactive'
  dependsOn: string[]
  hasData: boolean
  itemCount: number
  items: { id: string; name: string; summary: string }[]
  hasPending: boolean
}

type HatchPhase = 'idle' | 'streaming' | 'waiting' | 'world_complete' | 'complete'

interface HatchStore {
  phase: HatchPhase
  hatchGroup: 'world' | 'studio'
  proposals: Proposal[]
  settingItems: SettingItem[]
  engines: EngineInfo[]
  streamText: string
  lastStreamText: string  // preserved after streaming ends, for reference in waiting phase
  error: string | null
  llmStatus: LLMStatus | null
  activeLLMJobs: Record<string, ActiveLLMJob>
  locked: boolean
  currentEngine: string | null
  _abortController: AbortController | null

  // Auto-popup MOU: tracks which pending proposal should auto-show
  autoPopupProposalId: string | null
  // Proposal list panel visibility
  proposalListOpen: boolean
  _lastTokenUpdate: number
  // 关系网络缓存（从 settings API 获取，供地图视图使用）
  _relations: SettingItemRelation[]

  fetchProposals: (projectId: string) => Promise<void>
  fetchSettings: (projectId: string) => Promise<void>
  fetchEngines: (projectId: string) => Promise<void>
  advanceHatching: (projectId: string) => Promise<void>
  startHatching: (projectId: string) => Promise<void>
  startStudioPhase: (projectId: string) => Promise<void>
  runEngine: (projectId: string, engine: string) => Promise<void>
  approveProposal: (proposalId: string, projectId: string) => Promise<void>
  rejectProposal: (proposalId: string) => Promise<void>
  reviseProposal: (proposalId: string, notes: string) => Promise<void>
  dismissAutoPopup: () => void
  setProposalListOpen: (open: boolean) => void
  setCurrentEngine: (engine: string | null) => void
  abort: () => void
  reset: () => void
  // LLM job registry for tracking parallel LLM activities
  registerLLMJob: (jobId: string, jobLabel: string, status: Omit<LLMStatus, 'active'>) => void
  updateLLMJob: (jobId: string, partial: Partial<LLMStatus>) => void
  unregisterLLMJob: (jobId: string) => void
  // WebSocket 事件处理：统一接收后端推送的引擎流式事件
  handleWSEvent: (event: { type: string; payload: Record<string, unknown> }) => void
  // 启动新引擎前清除上一轮已完成的 job，避免弹窗堆积
  _clearCompletedJobs: () => void
  // 共享的 SSE 流式处理：startHatching / runEngine 共用
  _executeEngineSSE: (projectId: string, engine: string, jobId: string, controller: AbortController, fetchUrl: string, fetchBody?: Record<string, unknown>) => Promise<void>
}

export const useHatchStore = create<HatchStore>((set, get) => ({
  phase: 'idle',
  hatchGroup: 'world',
  proposals: [],
  settingItems: [],
  engines: [],
  streamText: '',
  lastStreamText: '',
  error: null,
  llmStatus: null,
  activeLLMJobs: {},
  locked: false,
  currentEngine: null,
  _abortController: null,
  autoPopupProposalId: null,
  proposalListOpen: false,
  _lastTokenUpdate: 0,
  _relations: [],

  registerLLMJob: (jobId, jobLabel, status) => {
    const jobs = { ...get().activeLLMJobs }
    jobs[jobId] = { ...status, active: true, jobId, jobLabel }
    set({ activeLLMJobs: jobs, llmStatus: aggregateLLMStatus(jobs) })
  },

  updateLLMJob: (jobId, partial) => {
    const jobs = { ...get().activeLLMJobs }
    if (!jobs[jobId]) return
    jobs[jobId] = { ...jobs[jobId], ...partial }
    set({ activeLLMJobs: jobs, llmStatus: aggregateLLMStatus(jobs) })
  },

  unregisterLLMJob: (jobId) => {
    const jobs = { ...get().activeLLMJobs }
    delete jobs[jobId]
    set({ activeLLMJobs: jobs, llmStatus: aggregateLLMStatus(jobs) })
  },

  _clearCompletedJobs: () => {
    const jobs = { ...get().activeLLMJobs }
    for (const [id, job] of Object.entries(jobs)) {
      if (!job.active) delete jobs[id]
    }
    set({ activeLLMJobs: jobs, llmStatus: aggregateLLMStatus(jobs) })
  },

  // WebSocket 事件 → Store 状态映射：后端推送的流式引擎事件直接驱动前端状态
  // 关键：WS 事件可能与 SSE 回调同时到达，需复用已有 SSE job 避免重复显示
  handleWSEvent: (event) => {
    const { type, payload } = event
    switch (type) {
      case 'engine_started': {
        const engineName = payload.node as string
        if (engineName && engineName !== 'refinement') {
          set({ currentEngine: engineName })
        }
        break
      }
      case 'engine_chunk': {
        const text = payload.text as string
        if (text) {
          set({ streamText: get().streamText + text })
        }
        break
      }
      case 'engine_model': {
        const engine = payload.engine as string
        // 查找已有的活跃 SSE job（同引擎只保留一个 job，避免重复）
        const existingJobId = Object.entries(get().activeLLMJobs).find(
          ([id, job]) => !id.endsWith(':ws') && job.active
        )?.[0]
        const jobId = existingJobId || `engine:${engine}:ws`
        if (!get().activeLLMJobs[jobId]) {
          get().registerLLMJob(jobId, engine, {
            provider: (payload.provider as string) || '',
            model: (payload.model as string) || '',
            label: (payload.label as string) || '',
            contextLimit: (payload.contextLimit as number) || 1_000_000,
            promptTokens: 0, completionTokens: 0, totalTokens: 0,
          })
        }
        get().updateLLMJob(jobId, {
          provider: payload.provider as string,
          model: payload.model as string,
          label: payload.label as string,
          contextLimit: payload.contextLimit as number,
        })
        break
      }
      case 'engine_usage': {
        const engine = payload.engine as string
        // 复用已有 SSE job，避免创建重复条目
        const existingJobId = Object.entries(get().activeLLMJobs).find(
          ([id]) => !id.endsWith(':ws')
        )?.[0]
        const jobId = existingJobId || `engine:${engine}:ws`
        get().updateLLMJob(jobId, {
          promptTokens: (payload.promptTokens as number) ?? 0,
          completionTokens: (payload.completionTokens as number) ?? 0,
          totalTokens: (payload.totalTokens as number) ?? 0,
          active: false,
        })
        break
      }
      case 'engine_error': {
        const message = payload.message as string
        if (message) set({ error: message })
        break
      }
      case 'engine_done': {
        const engine = payload.engine as string
        // 标记为完成但保留展示，不立即移除
        const existingJobId = Object.entries(get().activeLLMJobs).find(
          ([id]) => !id.endsWith(':ws')
        )?.[0]
        const jobId = existingJobId || `engine:${engine}:ws`
        get().updateLLMJob(jobId, { active: false })
        break
      }
      case 'phase_changed': {
        const phase = payload.phase as string
        if (phase) {
          set({ phase: phase as HatchPhase })
          if (payload.hatchGroup) set({ hatchGroup: payload.hatchGroup as 'world' | 'studio' })
        }
        break
      }
    }
  },

  // 共享的 SSE 流式处理：startHatching 和 runEngine 共用此方法
  // 封装了 SSE 连接管理、回调处理、完成后的数据同步和阶段切换
  _executeEngineSSE: async (
    projectId: string,
    engine: string,
    jobId: string,
    controller: AbortController,
    fetchUrl: string,
    fetchBody?: Record<string, unknown>,
  ) => {
    try {
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fetchBody ? JSON.stringify(fetchBody) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      await readSSEStream(res, {
        onModel: (parsed) => {
          get().updateLLMJob(jobId, {
            provider: parsed.provider, model: parsed.model,
            label: parsed.label, contextLimit: parsed.contextLimit,
          })
        },
        onUsage: (parsed) => {
          get().updateLLMJob(jobId, {
            promptTokens: parsed.promptTokens ?? 0,
            completionTokens: parsed.completionTokens ?? 0,
            totalTokens: parsed.totalTokens ?? 0,
            active: false,
          })
        },
        onChunk: (text) => {
          const newText = get().streamText + text
          set({ streamText: newText })
          const now = Date.now()
          if (now - get()._lastTokenUpdate > 100) {
            const cur = get().activeLLMJobs[jobId]
            if (cur?.active) {
              const estimated = estimateTokens(newText)
              get().updateLLMJob(jobId, { completionTokens: estimated, totalTokens: estimated })
            }
            set({ _lastTokenUpdate: now })
          }
        },
        onError: (message) => { set({ error: message || '引擎运行出错' }) },
        onStaged: () => {
          // staged 事件后引擎名已确定，更新 LLM job 显示
          const eng = get().currentEngine
          if (eng) {
            const engines = get().engines
            const engLabel = engines.find((e: any) => e.name === eng)?.label || eng
            get().updateLLMJob(jobId, { jobLabel: engLabel } as any)
          }
          get().fetchEngines(projectId).catch(() => {})
        },
        onEvent: (eventType, data) => {
          if (eventType === 'phase' && (data.phase as string)?.startsWith('waiting_')) {
            // 等待审批状态 — 不做特殊处理，onDone 后的 fetchProposals 会处理
          } else if (eventType === 'phase' && data.phase === 'studio_engine') {
            // 切换到工作室引擎 — 由 outline store 接管
            const engineName = data.engine as string
            console.log(`[hatch] 工作室引擎 handoff: ${engineName}`)
            set({ phase: 'idle', hatchGroup: 'studio', streamText: '' })
          }
          // P0-1 修复：后端发送 engine_name 事件时立即更新前端引擎名
          if (eventType === 'engine_name' && data.engine) {
            const engName = data.engine as string
            if (engName && engName !== 'advance') {
              set({ currentEngine: engName })
              const engines = get().engines
              const engLabel = engines.find((e: any) => e.name === engName)?.label || engName
              get().updateLLMJob(jobId, { jobLabel: engLabel } as any)
            }
          }
          if (eventType === 'tool_call' && data.toolName) {
            // 工具调用事件 — 引擎正在查询数据，确保 LLM job 标签可见
            const eng = get().currentEngine
            if (eng) {
              const engines = get().engines
              const engLabel = engines.find((e: any) => e.name === eng)?.label || eng
              get().updateLLMJob(jobId, { jobLabel: engLabel } as any)
            }
          }
          if (eventType === 'generation' && data.start) {
            // 生成阶段开始 — 引擎正在撰写提案
          }
        },
        onDone: (parsed) => {
          // 从后端返回的数据中提取实际引擎名（解决 P0-2：前端引擎名可能与后端不一致）
          const backendEngine = parsed.engine as string
          const effectiveEngine = backendEngine || engine
          if (effectiveEngine && effectiveEngine !== 'advance') {
            // 首次从后端获知引擎名时立即更新，解决 P0-1
            if (!get().currentEngine || get().currentEngine === 'advance') {
              set({ currentEngine: effectiveEngine })
            }
          }
          // 更新 LLM job 标签
          const engines = get().engines
          const displayEngine = get().currentEngine || effectiveEngine
          const engLabel = engines.find((e: any) => e.name === displayEngine)?.label || displayEngine
          if (engLabel) get().updateLLMJob(jobId, { jobLabel: engLabel } as any)
          // 嵌入提案 — 使用后端返回的实际引擎名作为 sourceNode（修复 P2-12）
          if (parsed.proposals && Array.isArray(parsed.proposals)) {
            const existingIds = new Set(get().proposals.map((p) => p.id))
            const embedded: Proposal[] = (parsed.proposals as any[])
              .filter((p: any) => !existingIds.has(p.id))
              .map((p: any) => ({
                ...p, projectId,
                sourceNode: p.sourceNode || displayEngine || engine,
                content: p.content || { reasoning: p.reasoning },
                createdAt: new Date().toISOString(),
              }))
            if (embedded.length > 0) set({ proposals: [...get().proposals, ...embedded] })
          }
        },
      })

      // SSE 完成 → 同步后端数据
      await Promise.all([get().fetchProposals(projectId), get().fetchEngines(projectId), get().fetchSettings(projectId)])
      // 保留已完成的 job 供底部状态栏弹窗展示
      get().updateLLMJob(jobId, { active: false })

      // 如果控制器已被替换（新引擎已启动），不覆盖其状态
      if (get()._abortController !== controller) return

      const pendingNow = get().proposals.filter((p) => p.status === 'pending')
      // 无 pending → 重试一次（DB 写入可能有延迟）
      if (pendingNow.length === 0 && get().proposals.length === 0) {
        await new Promise((r) => setTimeout(r, 800))
        await Promise.all([get().fetchProposals(projectId), get().fetchEngines(projectId)])
      }
      const finalPending = get().proposals.filter((p) => p.status === 'pending')

      if (finalPending.length > 0) {
        // 有待审批提案 → 弹 MOU
        set({ phase: 'waiting', streamText: '', currentEngine: null, autoPopupProposalId: finalPending[0].id })
      } else if (get().proposals.length === 0) {
        console.warn(`[hatch] ${engine}: stream ended but no proposals loaded`)
        set({ phase: 'waiting', streamText: '', currentEngine: null })
      } else {
        // 无 pending 提案 → 后端自动推进中（细化循环/下一引擎），前端保持等待
        set({ phase: 'waiting', streamText: '', currentEngine: null })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      get().updateLLMJob(jobId, { active: false })
      set({
        phase: 'waiting',
        lastStreamText: get().streamText || get().lastStreamText,
        error: (err as Error).message,
        currentEngine: null,
      })
    } finally {
      if (get()._abortController === controller) {
        set({ _abortController: null })
      }
    }
  },

  abort: () => {
    const controller = get()._abortController
    if (controller) {
      controller.abort()
      const jobs = { ...get().activeLLMJobs }
      for (const key of Object.keys(jobs)) {
        jobs[key] = { ...jobs[key], active: false }
      }
      set({ _abortController: null, phase: 'idle', activeLLMJobs: jobs, llmStatus: aggregateLLMStatus(jobs) })
    }
  },

  // _computePhase 和 _findNextEngine 已移除 — 所有编排逻辑由后端 scheduler 驱动
  // 前端只根据 proposals 状态决定展示：有 pending=waiting，无 pending=idle/waiting


  fetchProposals: async (projectId) => {
    const phaseBeforeFetch = get().phase
    try {
      const list = await apiFetch<any[]>(`/hatch/${projectId}/proposals`)
      const proposals: Proposal[] = list.map((p) => ({
        ...p,
        reasoning: p.content?.reasoning,
      }))

      const pending = proposals.filter((p) => p.status === 'pending')
      const prevProposals = get().proposals
      const prevPendingIds = new Set(prevProposals.filter((p) => p.status === 'pending').map((p) => p.id))

      // MOU 自动弹窗：仅对新到达的 pending 提案触发
      const isStreaming = phaseBeforeFetch === 'streaming' || get().phase === 'streaming'
      const newPending = pending.find((p) => !prevPendingIds.has(p.id))
      const autoPopupId = isStreaming ? null
        : newPending
          ? newPending.id
          : (pending.length > 0 && get().autoPopupProposalId && pending.some(p => p.id === get().autoPopupProposalId)
            ? get().autoPopupProposalId
            : null)

      // 阶段判定：简化 — 有 pending 弹窗，无 pending 则 idle/waiting
      // 后端负责编排，前端不判定下一步
      const engines = get().engines
      let phase: HatchPhase
      if (pending.length > 0) {
        phase = 'waiting'
      } else if (phaseBeforeFetch === 'streaming') {
        phase = 'streaming'
      } else if (get().locked) {
        phase = 'complete'
      } else if (proposals.length > 0) {
        // 有历史提案但无 pending → 后端正在自动推进中
        phase = get().phase === 'streaming' ? 'streaming' : 'waiting'
      } else {
        phase = 'idle'
      }

      // 页面刷新后自动恢复 hatchGroup
      let hatchGroup = get().hatchGroup
      if (hatchGroup === 'world') {
        const hasStudioActivity = proposals.some((p) => {
          const eng = engines.find((e) => e.name === p.sourceNode)
          return eng?.group === 'studio'
        })
        if (hasStudioActivity) hatchGroup = 'studio'
      }

      set({ proposals, phase, hatchGroup, autoPopupProposalId: autoPopupId })
    } catch (err) {
      console.error('[hatch] fetchProposals failed:', err)
      if (!get().error) set({ error: '加载提案失败' })
    }
  },

  fetchSettings: async (projectId) => {
    try {
      const data = await apiFetch<{ items: SettingItem[]; locked: boolean; relations: SettingItemRelation[] }>(`/settings/${projectId}`)
      set({ settingItems: data.items || [], locked: data.locked || false })
      if (data.relations) {
        set({ _relations: data.relations })
      }
    } catch (err) {
      console.error('[hatch] fetchSettings failed:', err)
      set({ error: '加载设定集失败' })
    }
  },

  fetchEngines: async (projectId) => {
    const phaseBeforeFetch = get().phase
    try {
      const engines = await apiFetch<EngineInfo[]>(`/hatch/${projectId}/engines`)
      set({ engines })
      const proposals = get().proposals
      if (proposals.length > 0) {
        // 后端驱动编排，前端只根据 pending 状态判定展示阶段
        const pending = proposals.filter((p) => p.status === 'pending')
        if (phaseBeforeFetch !== 'streaming') {
          set({ phase: pending.length > 0 ? 'waiting' : get().phase })
        }
      }
    } catch (err) {
      console.error('[hatch] fetchEngines failed:', err)
    }
  },

  runEngine: async (projectId, engine) => {
    // Route outline engines to the outline store's SSE endpoints
    if (OUTLINE_ENGINES.has(engine)) {
      set({ phase: 'streaming', currentEngine: engine, streamText: '', lastStreamText: get().streamText, error: null })
      const jobId = `engine:${engine}:${projectId}`

      // 清除上一轮已完成的 job，注册新 job
      get()._clearCompletedJobs()
      get().registerLLMJob(jobId, get().engines.find(e => e.name === engine)?.label || engine, {
        provider: '', model: '', label: '', contextLimit: 1_000_000,
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
      })

      const { useOutlineStore } = await import('./outline')
      const outlineStore = useOutlineStore.getState()

      // Wire up model/usage callbacks
      useOutlineStore.setState({
        _onModelInfo: (info) => {
          get().updateLLMJob(jobId, {
            provider: info.provider, model: info.model,
            label: info.label, contextLimit: info.contextLimit,
          })
        },
        _onUsage: (usage) => {
          get().updateLLMJob(jobId, {
            promptTokens: usage.promptTokens ?? 0,
            completionTokens: usage.completionTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
            active: false,
          })
        },
      })

      // Subscribe to outline store's streamText for display
      const unsub = useOutlineStore.subscribe((state) => {
        if (state.streamText) set({ streamText: state.streamText })
      })
      try {
        if (engine === 'outline-generator') {
          await outlineStore.generateOutline(projectId)
        } else if (engine === 'volume-outline') {
          await outlineStore.generateVolumeOutline(projectId)
        } else if (engine === 'chapter-outline') {
          await outlineStore.fetchVolumes(projectId)
          const volumes = useOutlineStore.getState().volumes
          const confirmed = volumes.find((v) => v.status === 'confirmed')
          if (confirmed) {
            await outlineStore.generateChapterOutlines(projectId, confirmed.id)
          } else {
            set({ error: '没有已确认的卷，无法生成章纲', phase: 'idle' })
            get().updateLLMJob(jobId, { active: false })
            return
          }
        }
      } finally {
        unsub()
        useOutlineStore.setState({ _onModelInfo: null, _onUsage: null })
        // 保留已完成的 job 供底部状态栏展示
        const jobs = get().activeLLMJobs
        if (jobs[jobId]) {
          get().updateLLMJob(jobId, { active: false })
        }
      }
      // After outline engine completes, sync state — backend drives next step
      if (!get().fetchProposals) return // type guard
      await get().fetchProposals(projectId)
      const pendingNow = get().proposals.filter((p) => p.status === 'pending')
      if (pendingNow.length > 0) {
        set({ phase: 'waiting', currentEngine: null, autoPopupProposalId: pendingNow[0].id })
      } else {
        set({ phase: 'waiting', currentEngine: null })
      }
      return
    }

    // 防止竞态导致重复运行已有已批准提案的引擎（后端也有相同守卫）
    const _approvedEngines = new Set(
      get().proposals.filter((p) => p.status === 'approved').map((p) => p.sourceNode)
    )
    if (_approvedEngines.has(engine)) {
      console.warn(`[hatch] runEngine blocked: ${engine} already has an approved proposal`)
      return
    }

    const prevController = get()._abortController
    if (prevController) prevController.abort()

    const controller = new AbortController()
    const jobId = `engine:${engine}:${projectId}`
    // 清除上一轮已完成的 job
    get()._clearCompletedJobs()
    set({ phase: 'streaming', streamText: '', lastStreamText: get().streamText, error: null, currentEngine: engine, _abortController: controller, _lastTokenUpdate: 0 })
    get().registerLLMJob(jobId, engine, {
      provider: '', model: '', label: '', contextLimit: 1_000_000,
      promptTokens: 0, completionTokens: 0, totalTokens: 0,
    })

    await get()._executeEngineSSE(
      projectId, engine, jobId, controller,
      `/api/hatch/${projectId}/advance`,
    )
  },

  advanceHatching: async (projectId) => {
    const prevController = get()._abortController
    if (prevController) prevController.abort()

    const controller = new AbortController()
    const jobId = `advance:${projectId}`
    // 清除上一轮已完成的 job，避免弹窗堆积
    get()._clearCompletedJobs()
    set({ phase: 'streaming', streamText: '', lastStreamText: get().streamText, error: null, locked: false, currentEngine: null, _abortController: controller, _lastTokenUpdate: 0 })
    get().registerLLMJob(jobId, '孵化推进', {
      provider: '', model: '', label: '', contextLimit: 1_000_000,
      promptTokens: 0, completionTokens: 0, totalTokens: 0,
    })

    await get()._executeEngineSSE(
      projectId, 'advance', jobId, controller,
      `/api/hatch/${projectId}/advance`,
    )
  },

  startHatching: async (projectId) => {
    // 统一由 advanceHatching 管理
    await get().advanceHatching(projectId)
  },

  startStudioPhase: async (projectId) => {
    // 切换到工作室阶段 — 由 /advance 自动调度（getNextPhase 会返回 outline-generator）
    set({ hatchGroup: 'studio' })
    await get().advanceHatching(projectId)
  },

  approveProposal: async (proposalId, projectId) => {
    let res: { success: boolean; proposalId: string; settingItemsCreated: number; refinementPending?: any; nextEngine?: { name: string; phase: string; hatchGroup?: string } | null };
    try {
      res = await apiPost<{ success: boolean; proposalId: string; settingItemsCreated: number; refinementPending?: any; nextEngine?: { name: string; phase: string; hatchGroup?: string } | null }>(`/proposals/${proposalId}/approve`, {})
    } catch (err: any) {
      const msg = `审批失败：${err.message || '网络错误，请重试'}`
      set({ error: msg })
      throw new Error(msg)
    }
    // 检查后端返回的执行结果 — handler 可能返回 executed: false
    if (!res.success) {
      const msg = '审批执行失败，请检查提案数据是否完整'
      set({ error: msg })
      throw new Error(msg)
    }
    // Mark approved locally and supersede optionGroup siblings
    const proposals = get().proposals.map((p) =>
      p.id === proposalId ? { ...p, status: 'approved' as const } : p
    )
    const approved = proposals.find((p) => p.id === proposalId)
    if (approved?.optionGroup) {
      for (const p of proposals) {
        if (p.optionGroup === approved.optionGroup && p.id !== proposalId && p.status === 'pending') {
          const idx = proposals.indexOf(p)
          proposals[idx] = { ...p, status: 'superseded' as const }
        }
      }
    }
    set({ proposals, autoPopupProposalId: null })

    // 编排完全由后端驱动：approve 端点自动触发 onProposalsResolved
    // 前端只需同步最新数据，不做任何编排决策
    await Promise.all([
      get().fetchProposals(projectId),
      get().fetchEngines(projectId),
      get().fetchSettings(projectId),
    ])
  },

  rejectProposal: async (proposalId) => {
    const rejectedProposal = get().proposals.find((p) => p.id === proposalId)
    const sourceNode = rejectedProposal?.sourceNode
    const projectId = rejectedProposal?.projectId
    try {
      await apiPost(`/proposals/${proposalId}/reject`, {})
    } catch (err: any) {
      set({ error: `驳回失败：${err.message}` })
      return
    }
    const proposals = get().proposals.map((p) => {
      if (p.id === proposalId) return { ...p, status: 'rejected' as const }
      if (rejectedProposal?.optionGroup && p.optionGroup === rejectedProposal.optionGroup && p.status === 'pending') {
        return { ...p, status: 'superseded' as const }
      }
      return p
    })
    set({ proposals, autoPopupProposalId: null })

    // 驳回后同步数据，后端会在需要时自动推进
    if (projectId) {
      await Promise.all([
        get().fetchProposals(projectId),
        get().fetchEngines(projectId),
      ])
      const remainingPending = get().proposals.filter((p) => p.status === 'pending')
      if (remainingPending.length > 0) {
        set({ phase: 'waiting', autoPopupProposalId: remainingPending[0].id })
      } else {
        set({ phase: 'waiting' })
      }
    } else {
      set({ phase: 'waiting' })
    }
  },

  reviseProposal: async (proposalId, notes) => {
    const revisedProposal = get().proposals.find((p) => p.id === proposalId)
    const sourceNode = revisedProposal?.sourceNode
    const projectId = revisedProposal?.projectId
    try {
      await apiPost(`/proposals/${proposalId}/revise`, { notes })
    } catch (err: any) {
      set({ error: `修改请求失败：${err.message}` })
      return
    }
    const proposals = get().proposals.map((p) => {
      if (p.id === proposalId) return { ...p, status: 'revision_requested' as const }
      // Supersede optionGroup siblings so they don't re-appear with new proposals
      if (revisedProposal?.optionGroup && p.optionGroup === revisedProposal.optionGroup && p.status === 'pending') {
        return { ...p, status: 'superseded' as const }
      }
      return p
    })
    set({ proposals, autoPopupProposalId: null })
    // Re-run the same engine — the revision notes are stored in the DB for context
    if (sourceNode && projectId) {
      get().runEngine(projectId, sourceNode)
    } else {
      set({ phase: 'waiting' })
    }
  },

  dismissAutoPopup: () => {
    set({ autoPopupProposalId: null })
  },

  setProposalListOpen: (open: boolean) => {
    set({ proposalListOpen: open })
  },

  setCurrentEngine: (engine: string | null) => {
    set({ currentEngine: engine })
  },

  reset: () => {
    get()._abortController?.abort()
    set({ phase: 'idle', hatchGroup: 'world', proposals: [], settingItems: [], engines: [], streamText: '', lastStreamText: '', error: null, llmStatus: null, activeLLMJobs: {}, locked: false, currentEngine: null, _abortController: null, autoPopupProposalId: null, proposalListOpen: false, _lastTokenUpdate: 0, _relations: [] })
  },
}))
