import { useState } from 'react'
import {
  Check, ChevronRight,
  Filter, RotateCcw, ShieldAlert, Layers,
} from 'lucide-react'
import type { Proposal, SettingItem } from '../../stores/hatch'
import { typeLabels, typeColors, proposalStatusConfig, stripSchemePrefix } from '../../utils/entityConfig'
import TypeIcon from './TypeIcon'

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected' | 'revision_requested'

interface ProposalListProps {
  proposals: Proposal[]
  settingItems: SettingItem[]
  onSelect: (proposal: Proposal) => void
  onClose: () => void
  onBulkApprove?: (ids: string[]) => void
  inline?: boolean
}

const filterConfig: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'revision_requested', label: '修改中' },
]

export default function ProposalList({ proposals, settingItems, onSelect, onClose, onBulkApprove, inline }: ProposalListProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  // Filter out superseded proposals by default — they are noisy and not actionable
  const visibleProposals = proposals.filter((p) => p.status !== 'superseded')

  const filtered = filter === 'all'
    ? visibleProposals
    : visibleProposals.filter((p) => p.status === filter)

  const pendingIds = visibleProposals.filter((p) => p.status === 'pending').map((p) => p.id)
  const counts = {
    all: visibleProposals.length,
    pending: visibleProposals.filter((p) => p.status === 'pending').length,
    approved: visibleProposals.filter((p) => p.status === 'approved').length,
    rejected: visibleProposals.filter((p) => p.status === 'rejected').length,
    revision_requested: visibleProposals.filter((p) => p.status === 'revision_requested').length,
  }

  const getImpactSetting = (proposal: Proposal): SettingItem | undefined => {
    return settingItems.find((s) => s.proposalId === proposal.id)
  }

  // Deduplicate by optionGroup: show only the first proposal per group, with option count badge
  const optionGroupCounts = new Map<string, number>()
  for (const p of filtered) {
    if (p.optionGroup) {
      optionGroupCounts.set(p.optionGroup, (optionGroupCounts.get(p.optionGroup) || 0) + 1)
    }
  }
  const seenGroups = new Set<string>()
  const deduped = filtered.filter((p) => {
    if (!p.optionGroup) return true
    if (seenGroups.has(p.optionGroup)) return false
    seenGroups.add(p.optionGroup)
    return true
  })

  const inner = (
    <div style={{
      ...(inline ? {} : { width: 'min(720px, 92vw)', maxHeight: '80vh' }),
      height: '100%',
      background: inline ? 'transparent' : 'rgba(16,16,30,0.96)',
      backdropFilter: inline ? 'none' : 'blur(40px) saturate(1.3)',
      border: inline ? 'none' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: inline ? 0 : 16,
      boxShadow: inline ? 'none' : '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px', borderBottom: '1px solid var(--glass-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-brand)', fontSize: 18,
            color: 'var(--text-primary)', marginBottom: 2,
          }}>
            提案列表
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            共 {visibleProposals.length} 个提案 · {counts.pending} 待审批 · {counts.approved} 已通过
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pendingIds.length > 1 && onBulkApprove && (
            <button
              onClick={() => onBulkApprove(pendingIds)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(134,239,172,0.2)',
                background: 'rgba(134,239,172,0.1)', color: 'var(--accent-mint)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >
              <Check size={13} /> 全部通过 ({pendingIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid var(--glass-border)',
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <Filter size={13} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
        {filterConfig.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: filter === f.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: filter === f.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              transition: 'all var(--duration) var(--ease)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {f.label}
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: filter === f.key ? 'var(--text-secondary)' : 'var(--text-muted)',
            }}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Proposal list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            {filter === 'all' ? '暂无提案' : `暂无${filterConfig.find(f => f.key === filter)?.label || ''}提案`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deduped.map((p) => {
              const color = typeColors[p.type] || 'var(--accent-ice)'
              const label = typeLabels[p.type] || p.type
              const iconEl = <TypeIcon type={p.type} size={16} />
              const statusCfg = proposalStatusConfig[p.status]
              const impactSetting = getImpactSetting(p)
              const isPending = p.status === 'pending'
              const optionCount = p.optionGroup ? optionGroupCounts.get(p.optionGroup) || 1 : 1

              return (
                <div
                  key={p.id}
                  onClick={() => onSelect(p)}
                  style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: isPending ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${isPending ? 'var(--glass-border-hover)' : 'var(--glass-border)'}`,
                    cursor: 'pointer',
                    transition: 'all var(--duration) var(--ease)',
                    display: 'flex', alignItems: 'center', gap: 14,
                    opacity: isPending ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.borderColor = 'var(--glass-border-hover)'
                    e.currentTarget.style.opacity = '1'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isPending ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'
                    e.currentTarget.style.borderColor = isPending ? 'var(--glass-border-hover)' : 'var(--glass-border)'
                    e.currentTarget.style.opacity = isPending ? '1' : '0.7'
                  }}
                >
                  {/* Type icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${color}12`, color,
                    fontSize: 16,
                  }}>
                    {iconEl}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {stripSchemePrefix(p.title)}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 4,
                        background: `${color}08`, color,
                      }}>
                        {label}
                      </span>
                      {optionCount > 1 && (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          background: 'rgba(196,181,253,0.08)', color: 'var(--accent-violet)',
                        }}>
                          {optionCount} 选项
                        </span>
                      )}
                      {/* Multi-item badge */}
                      {p.content?.payload?.items?.length > 0 && (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          background: 'rgba(125,211,252,0.08)', color: 'var(--accent-ice)',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <Layers size={10} />
                          {p.content.payload.items.length} items
                        </span>
                      )}
                      {/* Advisor flag for risk type */}
                      {p.type === 'risk' && (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          background: 'rgba(252,165,165,0.08)', color: 'var(--accent-rose)',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <ShieldAlert size={10} /> 谏官
                        </span>
                      )}
                    </div>

                    {/* Reasoning preview */}
                    {p.reasoning && (
                      <div style={{
                        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 420,
                      }}>
                        {p.reasoning}
                      </div>
                    )}

                    {/* Impact info for resolved proposals */}
                    {!isPending && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                        {impactSetting && (
                          <span style={{ color: 'var(--accent-mint)' }}>
                            → 已写入：{impactSetting.name}
                          </span>
                        )}
                        {p.status === 'revision_requested' && (
                          <span style={{ color: 'var(--accent-violet)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <RotateCcw size={10} /> 重新生成中
                          </span>
                        )}
                      </div>
                    )}

                    {/* Pending indicator */}
                    {isPending && (
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--accent-warm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-warm)', animation: 'pulse 2s ease-in-out infinite' }} />
                        等待你的审批
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, flexShrink: 0,
                    background: statusCfg?.bg || 'rgba(255,255,255,0.04)',
                    color: statusCfg?.color || 'var(--text-muted)',
                    border: `1px solid ${statusCfg?.color || 'var(--text-muted)'}20`,
                  }}>
                    {statusCfg?.label || p.status}
                  </span>

                  {/* Click arrow */}
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  if (inline) return inner

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 450,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      animation: 'fadeInUp 200ms var(--ease) both',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {inner}
    </div>
  )
}
