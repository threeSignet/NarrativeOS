import { memo } from 'react'
import { useWindowManager } from '../../stores/windowManager'
import { X } from 'lucide-react'

const TaskBar = memo(function TaskBar() {
  const windows = useWindowManager((s) => s.windows)
  const activeWindowId = useWindowManager((s) => s.activeWindowId)
  const focusWindow = useWindowManager((s) => s.focusWindow)
  const restoreWindow = useWindowManager((s) => s.restoreWindow)
  const closeWindow = useWindowManager((s) => s.closeWindow)

  if (windows.length === 0) return <span />

  return (
    <>
      {windows.map((win) => {
        const isActive = activeWindowId === win.id && win.state !== 'minimized'
        const isMinimized = win.state === 'minimized'

        return (
          <div
            key={win.id}
            onClick={() => isMinimized ? restoreWindow(win.id) : focusWindow(win.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '2px 5px 2px 7px',
              height: 28,
              cursor: 'pointer',
              flexShrink: 0,
              background: 'transparent',
              position: 'relative',
              userSelect: 'none',
              transition: 'background 120ms var(--ease)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {/* Active indicator — underline spanning full tab width */}
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: 2,
                borderRadius: '1px 1px 0 0',
                background: 'var(--accent-violet)',
              }} />
            )}

            <span style={{
              fontSize: 11,
              color: isActive ? 'var(--text-primary)' : isMinimized ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontWeight: isActive ? 500 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-ui)',
              opacity: isMinimized ? 0.4 : 1,
              maxWidth: 72,
            }}>
              {win.title}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); closeWindow(win.id) }}
              style={{
                width: 13,
                height: 13,
                borderRadius: 3,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                opacity: 0,
                transition: 'opacity 120ms var(--ease)',
                padding: 0,
                marginLeft: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.color = '#fca5a5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <X size={8} />
            </button>
          </div>
        )
      })}
    </>
  )
})

export default TaskBar
