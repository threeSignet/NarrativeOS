import type { ReactNode } from 'react'
import TopBar from './TopBar'
import IconRail from './IconRail'
import BottomBar from './BottomBar'

export default function AppLayout({ project, activePanel, onPanelClick, onOpenProposalList, children }: {
  project: { id: string; title: string; status: string } | null
  activePanel: 'world' | 'chapters' | 'settings' | null
  onPanelClick: (panel: 'world' | 'chapters' | 'settings') => void
  onOpenProposalList: () => void
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar project={project} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <IconRail
          activePanel={activePanel}
          onPanelClick={onPanelClick}
          projectId={project?.id}
        />
        {children}
      </div>
      <BottomBar projectId={project?.id} onOpenProposalList={onOpenProposalList} />
    </div>
  )
}
