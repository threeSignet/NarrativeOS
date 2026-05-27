import type { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>
}

export default function GlassPanel({ children, className = '', hover = false, onClick, onContextMenu }: GlassPanelProps) {
  return (
    <div
      className={`glass-panel ${hover ? 'glass-panel-hover cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </div>
  )
}
