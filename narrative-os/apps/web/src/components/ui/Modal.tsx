import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose?: () => void
  title: string
  children: ReactNode
  wide?: boolean
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="glass-modal" style={{
        width: wide ? 'min(600px, 92vw)' : 'min(480px, 92vw)',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeInUp 200ms var(--ease) both',
      }}>
        {/* Fixed header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 20,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}>
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'transparent', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all var(--duration) var(--ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px 24px',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
