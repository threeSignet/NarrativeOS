import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { SettingItem } from '../../stores/hatch'
import { typeLabels, typeColors } from '../../utils/entityConfig'

interface EntityTooltipProps {
  entity: SettingItem | null
  position: { x: number; y: number } | null
  onOpenDetail?: (entity: SettingItem) => void
  onClose: () => void
}

export default function EntityTooltip({ entity, position, onOpenDetail, onClose }: EntityTooltipProps) {
  const tipRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (entity && position) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [entity, position])

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return
    const handleClick = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 延迟绑定，避免触发 click 的是同一个 entity
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [visible, onClose])

  const handleOpenDetail = useCallback(() => {
    if (entity && onOpenDetail) {
      onOpenDetail(entity)
      onClose()
    }
  }, [entity, onOpenDetail, onClose])

  if (!entity || !position) return null

  const color = typeColors[entity.type] || '#7dd3fc'
  const label = typeLabels[entity.type] || entity.type

  // 计算 tooltip 位置（避免超出视口）
  const tipWidth = 280
  let left = position.x + 10
  if (left + tipWidth > window.innerWidth - 20) left = window.innerWidth - tipWidth - 20
  let top = position.y - 10

  return (
    <div
      ref={tipRef}
      className={`entity-tip ${visible ? 'show' : ''}`}
      style={{
        position: 'fixed',
        zIndex: 200,
        left,
        top,
        minWidth: 220,
        maxWidth: 320,
        padding: 16,
        background: 'rgba(16,16,28,0.95)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 150ms cubic-bezier(0.4,0,0.2,1), transform 150ms cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* 类型标签 */}
      <div style={{
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 6, color,
      }}>
        {label}
      </div>

      {/* 名称 */}
      <div style={{
        fontFamily: 'var(--font-brand)', fontSize: 18,
        marginBottom: 8, color: 'var(--text-primary)',
      }}>
        {entity.name}
      </div>

      {/* 描述 */}
      {entity.summary && (
        <div style={{
          fontSize: 13, color: 'var(--text-secondary)',
          lineHeight: 1.6, marginBottom: 12,
        }}>
          {entity.summary}
        </div>
      )}

      {/* 标签 */}
      {entity.tags && entity.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {entity.tags.slice(0, 5).map((tag, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 查看详情按钮 */}
      {onOpenDetail && (
        <button
          onClick={handleOpenDetail}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 6,
            border: `1px solid ${color}25`,
            background: `${color}10`,
            color,
            fontSize: 11, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${color}20` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10` }}
        >
          查看详情 <ArrowUpRight size={11} />
        </button>
      )}
    </div>
  )
}
