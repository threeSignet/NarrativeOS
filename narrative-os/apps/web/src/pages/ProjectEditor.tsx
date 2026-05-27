import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useProjectStore } from '../stores/projects'
import { useHatchStore } from '../stores/hatch'
import { useCompanionStore } from '../stores/companion'
import { useRealtimeStore } from '../stores/realtime'
import { useWindowManager } from '../stores/windowManager'
import type { Project } from '../stores/projects'
import type { Proposal, SettingItem } from '../stores/hatch'

import { typeLabels } from '../utils/entityConfig'
import { engineLabelMap } from '../utils/engineConfig'

import AppLayout from '../components/layout/AppLayout'
import WorldPanel from '../components/world/WorldPanel'
import ChaptersPanel from '../components/outline/ChaptersPanel'
import SettingsPanel from '../components/editor/SettingsPanel'
import HatchingView from '../components/hatching/HatchingView'
import ActiveView from '../components/outline/ActiveView'
import OutlineOverviewView from '../components/outline/OutlineOverviewView'
import GeographyView from '../components/engines/GeographyView'
import GenericEngineView from '../components/engines/GenericEngineView'
import CharacterEngineView from '../components/engines/CharacterEngineView'
import WorldView from '../components/engines/WorldView'
import CompanionWindow from '../components/companion/CompanionWindow'
import MOUModal from '../components/editor/MOUModal'
import ProposalList from '../components/editor/ProposalList'
import EntityDetailModal from '../components/editor/EntityDetailModal'
import NotificationPanel from '../components/editor/NotificationPanel'
import Window from '../components/ui/Window'

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // ── Project loading ──
  const { getProject } = useProjectStore()
  const storeProjects = useProjectStore((s) => s.projects)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProject(id)
      .then((p) => setProject(p))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, getProject])

  // Keep project state in sync with store
  useEffect(() => {
    if (!id) return
    const cached = storeProjects.find((p) => p.id === id)
    if (cached) setProject(cached)
  }, [id, storeProjects])

  // ── Initial data fetch ──
  const fetchProposals = useHatchStore((s) => s.fetchProposals)
  const fetchSettings = useHatchStore((s) => s.fetchSettings)
  const fetchEngines = useHatchStore((s) => s.fetchEngines)

  useEffect(() => {
    if (!id || !project) return
    fetchProposals(project.id)
    fetchSettings(project.id)
    fetchEngines(project.id)
  }, [id, project, fetchProposals, fetchSettings, fetchEngines])

  // ── WebSocket ──
  const realtimeConnect = useRealtimeStore((s) => s.connect)
  const realtimeDisconnect = useRealtimeStore((s) => s.disconnect)
  const realtimeOn = useRealtimeStore((s) => s.on)
  const setCurrentEngine = useHatchStore((s) => s.setCurrentEngine)

  useEffect(() => {
    if (!id) return
    realtimeConnect(id)
    return () => { realtimeDisconnect() }
  }, [id, realtimeConnect, realtimeDisconnect])

  useEffect(() => {
    // WS new_proposals：仅跨 tab 同步用。streaming 期间忽略（SSE done 统一驱动）
    // 使用 getState() 避免 stale closure，确保获取最新 phase
    const unsubNew = realtimeOn('new_proposals', () => {
      if (id && useHatchStore.getState().phase !== 'streaming') { fetchProposals(id); fetchEngines(id); }
    })
    const unsubStaged = realtimeOn('proposals_staged', () => {
      if (id && useHatchStore.getState().phase !== 'streaming') { fetchProposals(id); fetchEngines(id); }
    })
    const unsubStarted = realtimeOn('engine_started', (event: any) => {
      const engineName = event.payload?.node as string
      if (engineName) setCurrentEngine(engineName)
      if (id) fetchEngines(id)
    })
    const unsubCompleted = realtimeOn('engine_completed', () => {
      setCurrentEngine(null)
      if (id) { fetchProposals(id); fetchEngines(id); }
    })
    // 新 WS 事件：引擎流式输出 → 转发给 hatch store 统一处理
    const handleWSEvent = useHatchStore.getState().handleWSEvent
    const unsubChunk = realtimeOn('engine_chunk', (e: any) => handleWSEvent(e))
    const unsubModel = realtimeOn('engine_model', (e: any) => handleWSEvent(e))
    const unsubUsage = realtimeOn('engine_usage', (e: any) => handleWSEvent(e))
    const unsubDone = realtimeOn('engine_done', (e: any) => {
      handleWSEvent(e)
      if (id) { fetchProposals(id); fetchEngines(id); }
    })
    const unsubError = realtimeOn('engine_error', (e: any) => handleWSEvent(e))
    const unsubPhaseChanged = realtimeOn('phase_changed', (e: any) => handleWSEvent(e))
    return () => {
      unsubNew(); unsubStaged(); unsubStarted(); unsubCompleted()
      unsubChunk(); unsubModel(); unsubUsage(); unsubDone(); unsubError(); unsubPhaseChanged()
    }
  }, [id, fetchEngines, fetchProposals, setCurrentEngine, realtimeOn])

  // ── Store subscriptions (minimal — only what the orchestrator needs) ──
  const phase = useHatchStore((s) => s.phase)
  const proposals = useHatchStore((s) => s.proposals)
  const settingItems = useHatchStore((s) => s.settingItems)
  const engines = useHatchStore((s) => s.engines)
  const streamText = useHatchStore((s) => s.streamText)
  const lastStreamText = useHatchStore((s) => s.lastStreamText)
  const hatchError = useHatchStore((s) => s.error)
  const currentEngine = useHatchStore((s) => s.currentEngine)
  const startHatching = useHatchStore((s) => s.startHatching)
  const startStudioPhase = useHatchStore((s) => s.startStudioPhase)
  const hatchGroup = useHatchStore((s) => s.hatchGroup)
  const runEngine = useHatchStore((s) => s.runEngine)
  const approveProposal = useHatchStore((s) => s.approveProposal)
  const rejectProposal = useHatchStore((s) => s.rejectProposal)
  const reviseProposal = useHatchStore((s) => s.reviseProposal)
  const autoPopupProposalId = useHatchStore((s) => s.autoPopupProposalId)
  const dismissAutoPopup = useHatchStore((s) => s.dismissAutoPopup)
  const setProposalListOpen = useHatchStore((s) => s.setProposalListOpen)
  const relations = useHatchStore((s) => s._relations)
  const phaseConfirmationTarget = useHatchStore((s) => s.phaseConfirmationTarget)

  const companionActivityText = useCompanionStore((s) => s.activityText)
  const companionActivityColor = useCompanionStore((s) => s.activityColor)
  const fetchInitActivity = useCompanionStore((s) => s.fetchInitActivity)

  const windows = useWindowManager((s) => s.windows)
  const openWindow = useWindowManager((s) => s.openWindow)
  const closeWindow = useWindowManager((s) => s.closeWindow)
  const updateTitle = useWindowManager((s) => s.updateTitle)
  const updateProps = useWindowManager((s) => s.updateProps)

  // ── Local UI state ──
  const [activePanel, setActivePanel] = useState<'world' | 'chapters' | 'settings' | null>(null)
  const [editorView, setEditorView] = useState<'default' | 'outline'>('default')
  const [panelSearch, setPanelSearch] = useState('')
  const [mouProposal, setMouProposal] = useState<Proposal | null>(null)

  // ── Auto-open companion ──
  useEffect(() => {
    if (project) {
      const hasCompanion = windows.some((w) => w.type === 'companion')
      if (!hasCompanion) {
        openWindow('companion', { title: 'AI 伙伴' })
      }
      fetchInitActivity(project.id)
    }
  }, [project])

  // ── Sync companion activity to window title ──
  const companionWindowId = useMemo(() => windows.find((w) => w.type === 'companion')?.id, [windows])
  useEffect(() => {
    if (!companionWindowId) return
    useWindowManager.getState().updateProps(companionWindowId, {
      subtitle: companionActivityText || '',
      subtitleColor: companionActivityColor || 'var(--text-muted)',
    })
  }, [companionActivityText, companionActivityColor, companionWindowId])

  // ── Auto-popup MOU ──
  // 仅在非 streaming 状态下弹出 MOU，防止 LLM 流式输出未完成时弹出审批弹窗
  useEffect(() => {
    if (autoPopupProposalId && !mouProposal && useHatchStore.getState().phase !== 'streaming') {
      const p = proposals.find((p) => p.id === autoPopupProposalId)
      if (p) setMouProposal(p)
    }
  }, [autoPopupProposalId, proposals, mouProposal])

  // ── MOU handlers ──
  const handleApprove = useCallback(async (proposalId: string) => {
    // 先关闭弹窗让用户感知响应，审批在后台异步执行
    setMouProposal(null)
    dismissAutoPopup()
    try {
      await approveProposal(proposalId, project?.id ?? '')
    } catch {
      // 错误已在 store 中设置，如果审批失败则重新打开弹窗让用户看到错误
      const latest = useHatchStore.getState().proposals
      const p = latest.find((p) => p.id === proposalId)
      if (p && p.status === 'pending') {
        // 创建新引用确保 MOUModal 重新渲染
        setMouProposal({ ...p })
      }
    }
  }, [approveProposal, dismissAutoPopup, project?.id])

  const handleReject = useCallback((proposalId: string) => {
    rejectProposal(proposalId)
    setMouProposal(null)
    dismissAutoPopup()
  }, [rejectProposal, dismissAutoPopup])

  const handleRevise = useCallback((proposalId: string, notes: string) => {
    reviseProposal(proposalId, notes)
    setMouProposal(null)
    dismissAutoPopup()
  }, [reviseProposal, dismissAutoPopup])

  const handleDiscuss = useCallback((proposalId: string, message: string) => {
    reviseProposal(proposalId, `[商讨] ${message}`)
    setMouProposal(null)
    dismissAutoPopup()
  }, [reviseProposal, dismissAutoPopup])

  const handleMouClose = useCallback(() => {
    if (mouProposal && mouProposal.status !== 'pending') {
      setMouProposal(null)
      dismissAutoPopup()
    }
  }, [mouProposal, dismissAutoPopup])

  // ── Window helpers ──
  const openEntityDetail = useCallback((item: SettingItem) => {
    const label = typeLabels[item.type] || item.type
    const winId = openWindow('entity-detail', {
      title: `${label} · ${item.name}`,
      props: { entityId: item.id },
    })
    updateProps(winId, { entityItem: item })
  }, [openWindow, updateProps])

  const openOutlineDetail = useCallback((title: string, outline: Record<string, any>) => {
    const winId = openWindow('outline-detail', { title })
    updateProps(winId, { outlineData: outline })
  }, [openWindow, updateProps])

  const openProposalListWindow = useCallback(() => {
    openWindow('proposal-list', { title: '提案列表' })
    setProposalListOpen(false)
  }, [openWindow, setProposalListOpen])

  const handlePanelClick = useCallback((panel: 'world' | 'chapters' | 'settings') => {
    setActivePanel((prev) => prev === panel ? null : panel)
    setPanelSearch('')
  }, [])

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-deep)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error || '项目不存在'}</p>
        <button onClick={() => navigate('/')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>返回项目列表</button>
      </div>
    )
  }

  const isHatching = project.status === 'hatching'

  // ── Filtered windows ──
  const companionWindow = windows.find((w) => w.type === 'companion')
  const entityWindows = windows.filter((w) => w.type === 'entity-detail')
  const proposalListWindow = windows.find((w) => w.type === 'proposal-list')
  const notificationWindow = windows.find((w) => w.type === 'notification')
  const engineWindows = windows.filter((w) => {
    return ['tone', 'geography', 'power_system', 'faction', 'character', 'conflict', 'item_system', 'story_blueprint', 'world-view'].includes(w.type)
  })
  const outlineWindows = windows.filter((w) => w.type === 'outline-detail')

  const editorContent = (isHatching || phase === 'streaming' || phase === 'waiting' || phase === 'waiting_phase_confirmation' || phase === 'world_complete') ? (
    <HatchingView
      project={project}
      phase={phase}
      proposals={proposals}
      engines={engines}
      currentEngine={currentEngine}
      streamText={streamText}
      lastStreamText={lastStreamText}
      hatchError={hatchError}
      onStart={() => startHatching(project.id)}
      hatchGroup={hatchGroup}
      onStartStudio={() => startStudioPhase(project.id)}
      phaseConfirmationTarget={phaseConfirmationTarget}
      onCompletePhase={(phase) => {
        const completePhase = useHatchStore.getState().completePhase
        completePhase(project.id, phase)
      }}
    />
  ) : editorView === 'outline' ? (
    <OutlineOverviewView
      project={project}
      onBack={() => setEditorView('default')}
      onOpenOutlineDetail={openOutlineDetail}
    />
  ) : (
    <ActiveView project={project} />
  )

  return (
    <>
    <AppLayout
      project={project}
      activePanel={activePanel}
      onPanelClick={handlePanelClick}
      onOpenProposalList={openProposalListWindow}
    >
      {/* Floating Panel (sidebar drawer) */}
      {activePanel && (
        <div style={{
          position: 'absolute', top: 0, left: 52,
          width: 300, height: '100%',
          background: 'rgba(12,12,22,0.92)',
          backdropFilter: 'blur(40px) saturate(1.3)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          zIndex: 80, display: 'flex', flexDirection: 'column',
          animation: 'slideIn 200ms var(--ease) both',
        }}>
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)' }}>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
              {activePanel === 'world' ? '世界引擎' : activePanel === 'chapters' ? '工作室' : '设置'}
            </span>
          </div>
          <input
            value={panelSearch}
            onChange={(e) => setPanelSearch(e.target.value)}
            placeholder={activePanel === 'chapters' ? '搜索章节...' : '搜索实体...'}
            style={{
              margin: '16px 20px 8px', padding: '10px 14px', borderRadius: 10,
              border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
            {activePanel === 'world' && (
              <WorldPanel
                engines={engines}
                settingItems={settingItems}
                onOpenEngineView={(engineType, engineLabel) => {
                  openWindow(engineType, { title: engineLabel })
                  setActivePanel(null)
                }}
                onOpenWorldView={() => {
                  openWindow('world-view', { title: '世界视图' })
                  setActivePanel(null)
                }}
                searchQuery={panelSearch}
              />
            )}
            {activePanel === 'chapters' && (
              <ChaptersPanel
                projectId={project.id}
                searchQuery={panelSearch}
                onNavigate={(target, _id) => {
                  if (target === 'settings') {
                    setActivePanel('world')
                  } else if (target === 'outline') {
                    setActivePanel(null)
                    setEditorView('outline')
                  } else {
                    setActivePanel(null)
                  }
                }}
              />
            )}
            {activePanel === 'settings' && (
              <SettingsPanel
                project={project}
                onUpdate={async (updates) => {
                  const store = useProjectStore.getState()
                  await store.updateProject(project.id, updates)
                  const updated = await store.getProject(project.id)
                  setProject(updated)
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Editor Center */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'relative', background: 'linear-gradient(180deg, var(--bg-deep) 0%, #0e0e18 100%)',
      }}>
        {/* Click-capture overlay: when drawer is open, clicking the editor area closes the drawer */}
        {activePanel && (
          <div
            onClick={() => setActivePanel(null)}
            style={{
              position: 'absolute', inset: 0, zIndex: 70,
              cursor: 'default',
            }}
          />
        )}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0' }}>
          {editorContent}
        </div>
      </div>
    </AppLayout>

    {/* ════════════════ FLOATING WINDOWS (outside AppLayout to avoid overflow:hidden clipping) ════════════════ */}
    {companionWindow && (
      <Window window={companionWindow}>
        <CompanionWindow
          project={project}
          settingItems={settingItems}
          onEntityClick={openEntityDetail}
        />
      </Window>
    )}

    {entityWindows.map((win) => {
      const item = (win.props.entityItem as SettingItem) || null
      if (!item) return null
      return (
        <Window key={win.id} window={win}>
          <div style={{ height: '100%', padding: '16px 20px', overflowY: 'auto' }}>
            <EntityDetailModal
              open={true}
              item={item}
              allEntities={settingItems}
              projectId={project.id}
              onClose={() => closeWindow(win.id)}
              onSaved={(updated: SettingItem) => {
                const store = useHatchStore.getState()
                store.settingItems = store.settingItems.map((i) => i.id === updated.id ? updated : i)
                useHatchStore.setState({ settingItems: [...store.settingItems] })
                updateProps(win.id, { entityItem: updated })
                const label = typeLabels[updated.type] || updated.type
                updateTitle(win.id, `${label} · ${updated.name}`)
              }}
              inline
            />
          </div>
        </Window>
      )
    })}

    {proposalListWindow && (
      <Window window={proposalListWindow}>
        <ProposalList
          proposals={proposals}
          settingItems={settingItems}
          onSelect={setMouProposal}
          onClose={() => closeWindow(proposalListWindow.id)}
          inline
        />
      </Window>
    )}

    {notificationWindow && (
      <Window window={notificationWindow}>
        <NotificationPanel projectId={project.id} />
      </Window>
    )}

    {engineWindows.map((win) => {
      if (win.type === 'world-view') {
        return (
          <Window key={win.id} window={win}>
            <WorldView settingItems={settingItems} projectId={project.id} onClose={() => closeWindow(win.id)} />
          </Window>
        )
      }
      if (win.type === 'character') {
        return (
          <Window key={win.id} window={win}>
            <CharacterEngineView items={settingItems} projectId={project.id} />
          </Window>
        )
      }
      if (win.type === 'geography') {
        return (
          <Window key={win.id} window={win}>
            <GeographyView
              settingItems={settingItems}
              relations={relations || []}
              projectId={project.id}
              onClose={() => closeWindow(win.id)}
            />
          </Window>
        )
      }
      // Other engines: generic setting list (placeholder for future visualizations)
      return (
        <Window key={win.id} window={win}>
          <GenericEngineView settingItems={settingItems} engineType={win.type} projectId={project.id} onClose={() => closeWindow(win.id)} />
        </Window>
      )
    })}

    {outlineWindows.map((win) => {
      const data = (win.props.outlineData as Record<string, any>) || null
      return (
        <Window key={win.id} window={win}>
          <div style={{ height: '100%', padding: '16px 20px', overflowY: 'auto' }}>
            <pre style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", monospace)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {data ? JSON.stringify(data, null, 2) : '无数据'}
            </pre>
          </div>
        </Window>
      )
    })}

    {/* ════════════════ MOU MODAL ════════════════ */}
    <MOUModal
      open={!!mouProposal}
      proposal={mouProposal}
      siblings={mouProposal?.optionGroup
        ? proposals.filter(p => p.optionGroup === mouProposal.optionGroup && p.status !== 'superseded')
        : mouProposal ? [mouProposal] : undefined
      }
      onClose={handleMouClose}
      onApprove={handleApprove}
      onReject={handleReject}
      onRevise={handleRevise}
      onDiscuss={handleDiscuss}
      stageTitle={mouProposal ? `${engineLabelMap[mouProposal.sourceNode] || mouProposal.sourceNode || 'MOU'} - 方案选择` : undefined}
      error={hatchError}
    />
    </>
  )
}
