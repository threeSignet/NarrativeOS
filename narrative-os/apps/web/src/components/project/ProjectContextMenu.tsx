import { useState, useRef, useEffect } from 'react'
import { Trash2, Archive, Pencil } from 'lucide-react'

interface ContextMenuProps {
  x: number
  y: number
  isHatching: boolean
  onDelete: () => void
  onArchive: () => void
  onEdit: () => void
  onClose: () => void
}

export default function ContextMenu({ x, y, isHatching, onDelete, onArchive, onEdit, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Adjust position to stay in viewport
  const menuWidth = 160
  const menuHeight = confirmDelete ? 120 : (isHatching ? 130 : 90)
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8)

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
    color: 'var(--text-secondary)', transition: 'all var(--duration) var(--ease)',
    borderRadius: 6, margin: '2px 4px',
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: adjustedX, top: adjustedY,
        width: menuWidth, zIndex: 1000,
        background: 'rgba(16,16,30,0.96)',
        backdropFilter: 'blur(40px) saturate(1.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '4px 0',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'fadeInUp 150ms var(--ease) both',
      }}
    >
      {confirmDelete ? (
        <div style={{ padding: '10px 14px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>确定删除？此操作不可恢复</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--glass-border)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
            }}>取消</button>
            <button onClick={onDelete} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
              background: 'rgba(252,165,165,0.12)', color: 'var(--accent-rose)', fontSize: 12, cursor: 'pointer',
            }}>删除</button>
          </div>
        </div>
      ) : (
        <>
          {isHatching && (
            <div
              style={itemStyle}
              onClick={() => { onEdit(); onClose() }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Pencil size={14} /> 编辑设定
            </div>
          )}
          <div
            style={itemStyle}
            onClick={() => { onArchive(); onClose() }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Archive size={14} /> 归档
          </div>
          <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 12px' }} />
          <div
            style={{ ...itemStyle, color: 'var(--accent-rose)' }}
            onClick={() => setConfirmDelete(true)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(252,165,165,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={14} /> 删除
          </div>
        </>
      )}
    </div>
  )
}
