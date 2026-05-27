import { useState, useMemo } from 'react'
import { Plus, Search, ChevronRight } from 'lucide-react'
import type { SettingItem } from '../../stores/hatch'
import { engineLabelMap } from '../../utils/engineConfig'
import { SUBTYPE_LABELS } from '../../utils/labels'

function stripScheme(name: string): string {
  return name.replace(/^方案[A-Z][:：]\s*/, '')
}

export interface EngineIDEProps {
  items: SettingItem[]
  engineType: string
  projectId: string
  onClose?: () => void
  onCreateItem?: () => void
  children: (selectedItem: SettingItem | null, onSelect: (id: string) => void) => React.ReactNode
  renderDetail: (item: SettingItem, onAction: (action: string) => void) => React.ReactNode
}

export default function EngineIDEView({ items, engineType, projectId, onClose, onCreateItem, children, renderDetail }: EngineIDEProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const confirmed = useMemo(
    () => items.filter((i) => i.status === 'confirmed'),
    [items],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return confirmed
    return confirmed.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.summary || '').toLowerCase().includes(q) ||
      (i.itemSubtype || '').toLowerCase().includes(q),
    )
  }, [confirmed, search])

  const selectedItem = useMemo(
    () => confirmed.find((i) => i.id === selectedId) || null,
    [confirmed, selectedId],
  )

  // Auto-select first item
  if (selectedId === null && confirmed.length > 0 && !confirmed.find((i) => i.id === selectedId)) {
    // Will select on next render
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ═══ Left: Item List (220px) ═══ */}
      <div style={{
        width: 220, borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Search */}
        <div style={{ padding: '10px 10px 6px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              style={{
                width: '100%', padding: '6px 8px 6px 26px', borderRadius: 6,
                border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-primary)', fontSize: 11, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-ui)',
              }}
            />
          </div>
        </div>

        {/* Item list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map((item) => {
            const isSelected = selectedId === item.id
            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px', cursor: 'pointer',
                  background: isSelected ? 'rgba(196,181,253,0.06)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--accent-violet)' : '2px solid transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  transition: 'all var(--duration) var(--ease)',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isSelected ? 'var(--accent-violet)' : 'var(--text-muted)',
                  flexShrink: 0, opacity: isSelected ? 1 : 0.4,
                }} />
                <span style={{
                  flex: 1, fontSize: 12, fontWeight: isSelected ? 500 : 400,
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {stripScheme(item.name)}
                </span>
                {item.itemSubtype && item.itemSubtype !== 'parent' && (
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {SUBTYPE_LABELS[item.itemSubtype] || item.itemSubtype}
                  </span>
                )}
                <ChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.3 }} />
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
              {search ? '无匹配结果' : '暂无条目'}
            </div>
          )}
        </div>

        {/* Create button */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--glass-border)' }}>
          <button onClick={onCreateItem} style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(196,181,253,0.2)',
            background: 'rgba(196,181,253,0.04)', color: 'var(--accent-violet)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>
            <Plus size={14} />
            新增{engineLabelMap[engineType] || ''}
          </button>
        </div>
      </div>

      {/* ═══ Center: Visualization ═══ */}
      <div style={{ flex: 1, position: 'relative', background: '#080810', overflow: 'hidden' }}>
        {children(selectedItem, setSelectedId)}
      </div>

      {/* ═══ Right: Detail + Actions (260px) ═══ */}
      <div style={{
        width: 260, borderLeft: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
      }}>
        {selectedItem ? (
          renderDetail(selectedItem, (action) => {
            // Action callback handled by parent
          })
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {confirmed.length === 0 ? '暂无条目，点击下方按钮新增' : '选择左侧条目查看详情'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
