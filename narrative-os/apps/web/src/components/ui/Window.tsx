import { memo, useRef, useCallback, useState, useEffect, type ReactNode } from 'react'
import { X, Minus, Square, Maximize2 } from 'lucide-react'
import { useWindowManager, type WindowInfo } from '../../stores/windowManager'

interface WindowProps {
  window: WindowInfo
  children: ReactNode
}

// ═══════════════════════════════════════════════════
// 拖拽性能优化：
// - backdrop-filter blur 是卡顿的主因：拖拽时临时关闭
// - box-shadow 在拖拽期间削弱以减轻 paint 压力
// - 其余保持原有定位方式 (left/top)，稳定可靠
// ═══════════════════════════════════════════════════

function WindowInner({ window: win, children }: WindowProps) {
  const focusWindow = useWindowManager((s) => s.focusWindow)
  const closeWindow = useWindowManager((s) => s.closeWindow)
  const minimizeWindow = useWindowManager((s) => s.minimizeWindow)
  const toggleMaximize = useWindowManager((s) => s.toggleMaximize)
  const moveWindow = useWindowManager((s) => s.moveWindow)
  const moveAndResizeWindow = useWindowManager((s) => s.moveAndResizeWindow)
  const isActive = useWindowManager((s) => s.activeWindowId === win.id)

  const draggingRef = useRef(false)
  const resizingRef = useRef(false)
  const resizeDirRef = useRef<'n' | 'w' | 'nw'>('nw')
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (win.state === 'maximized') return
    e.preventDefault()
    focusWindow(win.id)
    dragOffsetRef.current = { x: e.clientX - win.position.x, y: e.clientY - win.position.y }
    draggingRef.current = true
    setDragging(true)
  }, [win.id, win.position.x, win.position.y, win.state, focusWindow])

  const handleResizeStart = useCallback((e: React.MouseEvent, dir: 'n' | 'w' | 'nw') => {
    if (win.state === 'maximized') return
    e.preventDefault()
    e.stopPropagation()
    focusWindow(win.id)
    resizeDirRef.current = dir
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: win.size.w, h: win.size.h, px: win.position.x, py: win.position.y }
    resizingRef.current = true
    setResizing(true)
  }, [win.id, win.size.w, win.size.h, win.position.x, win.position.y, win.state, focusWindow])

  // 拖拽：取消前次 RAF 避免事件堆积，保持跟手
  useEffect(() => {
    if (!dragging) return
    let rafId = 0
    let active = true
    const onMove = (e: MouseEvent) => {
      if (!active) return
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const x = Math.max(52, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - win.size.w))
        const y = Math.max(52, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - win.size.h - 28))
        moveWindow(win.id, { x, y })
      })
    }
    const onUp = () => {
      active = false
      cancelAnimationFrame(rafId)
      draggingRef.current = false
      setDragging(false)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      active = false
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, win.id, win.size.w, win.size.h, moveWindow])

  // 缩放：合并 move + resize 为单次 store 更新
  useEffect(() => {
    if (!resizing) return
    let rafId = 0
    let active = true
    const onMove = (e: MouseEvent) => {
      if (!active) return
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const dir = resizeDirRef.current
        const dx = e.clientX - resizeStartRef.current.x
        const dy = e.clientY - resizeStartRef.current.y
        const { w: startW, h: startH, px: startPx, py: startPy } = resizeStartRef.current

        let newX = startPx
        let newY = startPy
        let newW = startW
        let newH = startH

        if (dir === 'w' || dir === 'nw') {
          const maxLeftW = startW + (startPx - 52)
          newW = Math.max(win.minSize.w, Math.min(startW - dx, maxLeftW))
          newX = startPx + startW - newW
        }

        if (dir === 'n' || dir === 'nw') {
          const maxTopH = startH + (startPy - 52)
          newH = Math.max(win.minSize.h, Math.min(startH - dy, maxTopH))
          newY = startPy + startH - newH
        }

        moveAndResizeWindow(win.id, { x: newX, y: newY }, { w: newW, h: newH })
      })
    }
    const onUp = () => {
      active = false
      cancelAnimationFrame(rafId)
      resizingRef.current = false
      setResizing(false)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      active = false
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizing, win.id, win.minSize.w, win.minSize.h, moveAndResizeWindow])

  if (win.state === 'minimized') return null

  const isMaximized = win.state === 'maximized'
  const isInteractive = dragging || resizing

  return (
    <div
      className="glass-window"
      style={{
        position: 'fixed',
        left: isMaximized ? 0 : win.position.x,
        top: isMaximized ? 52 : win.position.y,
        width: isMaximized ? undefined : win.size.w,
        height: isMaximized ? undefined : win.size.h,
        right: isMaximized ? 0 : undefined,
        bottom: isMaximized ? 40 : undefined,
        zIndex: win.zIndex,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isMaximized ? 0 : 12,
        overflow: 'hidden',
        // 拖拽时将 blur 降到极小值以减轻 GPU 开销（这是卡顿的最大来源）
        // 不用 'none' 而是 blur(3px)，避免切换时浏览器销毁/重建 compositor 层产生闪烁
        backdropFilter: isInteractive ? 'blur(3px) saturate(1.1)' : 'blur(40px) saturate(1.3)',
        background: isInteractive
          ? 'rgba(16, 16, 30, 0.98)'
          : isActive
            ? 'rgba(16, 16, 30, 0.96)'
            : 'rgba(16, 16, 30, 0.92)',
        border: isActive
          ? '1px solid rgba(255,255,255,0.12)'
          : '1px solid rgba(255,255,255,0.06)',
        // 拖拽时削弱阴影
        boxShadow: isInteractive
          ? '0 4px 16px rgba(0,0,0,0.45)'
          : isActive
            ? '0 16px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
            : '0 8px 32px rgba(0,0,0,0.3)',
        animation: 'fadeInUp 200ms var(--ease) both',
        // 拖拽期间关闭所有 transition 和动画，避免与鼠标位置不同步
        transition: isInteractive ? 'none' : 'box-shadow 200ms var(--ease), border-color 200ms var(--ease)',
      }}
      onMouseDown={() => focusWindow(win.id)}
    >
      <div
        style={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          cursor: isMaximized ? 'default' : 'grab',
          flexShrink: 0,
          userSelect: 'none',
        }}
        onMouseDown={handleDragStart}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {win.title}
        </span>
        {(win.props.subtitle as string | undefined) && (
          <span style={{
            fontSize: 11,
            color: String(win.props.subtitleColor || 'var(--text-muted)'),
            fontFamily: 'var(--font-ui)',
            letterSpacing: 0.3,
            marginLeft: 8,
            flexShrink: 0,
          }}>
            {String(win.props.subtitle)}
          </span>
        )}
        <span style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <WindowButton onClick={() => minimizeWindow(win.id)} title="最小化">
            <Minus size={13} />
          </WindowButton>
          <WindowButton onClick={() => toggleMaximize(win.id)} title={isMaximized ? '还原' : '最大化'}>
            {isMaximized ? <Square size={11} /> : <Maximize2 size={12} />}
          </WindowButton>
          <WindowButton onClick={() => closeWindow(win.id)} title="关闭" isClose>
            <X size={14} />
          </WindowButton>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
      }}>
        {children}
      </div>

      {!isMaximized && (
        <>
          <div
            onMouseDown={(e) => handleResizeStart(e, 'w')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'ew-resize',
              zIndex: 1,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 'n')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: 6,
              right: 0,
              cursor: 'ns-resize',
              zIndex: 1,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 16,
              height: 16,
              cursor: 'nwse-resize',
              zIndex: 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.2 }}>
              <line x1="2" y1="6" x2="6" y2="2" stroke="white" strokeWidth="1" />
              <line x1="2" y1="10" x2="10" y2="2" stroke="white" strokeWidth="1" />
              <line x1="2" y1="2" x2="2" y2="2" stroke="white" strokeWidth="1.5" />
            </svg>
          </div>
        </>
      )}
    </div>
  )
}

export default memo(WindowInner)

function WindowButton({ onClick, title, isClose, children }: {
  onClick: () => void; title: string; isClose?: boolean; children: ReactNode
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 120ms var(--ease)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isClose ? 'rgba(252,165,165,0.15)' : 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = isClose ? '#fca5a5' : 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      {children}
    </button>
  )
}
