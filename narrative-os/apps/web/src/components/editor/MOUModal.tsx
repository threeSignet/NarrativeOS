import { useState } from 'react'
import {
  Check, X, MessageCircle, Sparkles, Brain, FileText,
  ShieldAlert, Link, BarChart3, Scroll, PenLine, Clock,
  ChevronDown, ChevronRight, Terminal, User, FileCode, Zap,
  GitBranch, Box, Layers,
} from 'lucide-react'
import Modal from '../ui/Modal'
import type { Proposal } from '../../stores/hatch'
import { typeLabels, typeColors, formatKey, proposalStatusConfig, stripSchemePrefix } from '../../utils/entityConfig'
import TypeIcon from './TypeIcon'

interface MOUModalProps {
  open: boolean
  proposal: Proposal | null
  siblings?: Proposal[]
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRevise: (id: string, notes: string) => void
  onDiscuss: (id: string, message: string) => void
  stageTitle?: string
  error?: string | null
}

function MultiItemPreview({ items, relations }: { items: any[]; relations?: any[] }) {
  const relMap = new Map<string, { target: string; label: string; type: string }[]>()
  if (relations) {
    for (const rel of relations) {
      const list = relMap.get(rel.sourceName) || []
      list.push({ target: rel.targetName, label: rel.label, type: rel.relationType })
      relMap.set(rel.sourceName, list)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Item tree */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item: any, i: number) => (
          <div key={i} style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Box size={14} style={{ color: 'var(--accent-ice)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {item.name}
              </span>
              {item.subtype && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(125,211,252,0.08)', color: 'var(--accent-ice)',
                  border: '1px solid rgba(125,211,252,0.15)',
                }}>
                  {item.subtype}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
              {item.summary}
            </div>
            {item.content && typeof item.content === 'object' && (
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: 'rgba(0,0,0,0.15)', fontSize: 12,
                color: 'var(--text-muted)', lineHeight: 1.5,
              }}>
                {Object.entries(item.content).slice(0, 4).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{formatKey(k)}: </span>
                    <span>{typeof v === 'string' ? v.substring(0, 60) : JSON.stringify(v).substring(0, 60)}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Relations for this item */}
            {relMap.has(item.name) && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {relMap.get(item.name)!.map((rel, ri) => (
                  <span key={ri} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4,
                    background: 'rgba(201,165,92,0.08)', color: 'var(--accent-gold)',
                    border: '1px solid rgba(201,165,92,0.15)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <GitBranch size={10} />
                    {rel.label} → {rel.target}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary badge */}
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(134,239,172,0.04)', border: '1px solid rgba(134,239,172,0.1)',
        fontSize: 12, color: 'var(--accent-mint)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Layers size={14} />
        此方案将创建 {items.length} 个设定条目
        {relations && relations.length > 0 ? `，${relations.length} 条关系` : ''}
      </div>
    </div>
  )
}

function renderPayload(payload: Record<string, any>) {
  // Multi-item payload: render structured preview
  if (payload.items && Array.isArray(payload.items)) {
    return <MultiItemPreview items={payload.items} relations={payload.relations} />
  }

  const arrayFields = new Set([
    'realms', 'rules', 'unique_rules', 'cultural_notes', 'taboos',
    'foreshadowing', 'foreshadowingPlanted', 'foreshadowingResolved',
    'connectionsToPrevious', 'connectionsToFuture', 'callbackTo',
    'keyEvents',
  ])
  const objectArrayFields = new Set([
    'factions', 'volumes', 'chapters', 'scenes', 'majorCharacters',
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(payload).map(([key, value]) => {
        if (value == null) return null

        if (objectArrayFields.has(key) && Array.isArray(value)) {
          return (
            <div key={key}>
              <FieldLabel>{formatKey(key)}</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {value.map((item: any, i: number) => (
                  <div key={i} style={{
                    padding: '14px 18px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                  }}>
                    {typeof item === 'object' && item !== null
                      ? Object.entries(item).map(([k, v]) => (
                          <div key={k} style={{ marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>{formatKey(k)}：</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                          </div>
                        ))
                      : String(item)}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        if (arrayFields.has(key) && Array.isArray(value)) {
          return (
            <div key={key}>
              <FieldLabel>{formatKey(key)}</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {value.map((item: string, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'baseline', gap: 10,
                    padding: '8px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid var(--glass-border)',
                    fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)',
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, minWidth: 18 }}>{i + 1}.</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        if (typeof value === 'string') {
          return (
            <div key={key}>
              <FieldLabel>{formatKey(key)}</FieldLabel>
              <div style={{
                fontSize: 15, lineHeight: 1.9, color: 'rgba(255,255,255,0.8)',
                padding: '14px 18px', borderRadius: 10,
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
              }}>{value}</div>
            </div>
          )
        }

        return (
          <div key={key}>
            <FieldLabel>{formatKey(key)}</FieldLabel>
            <div style={{
              padding: '12px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
              fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
            }}>
              {renderObject(value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function renderContent(content: Record<string, any>) {
  const skip = new Set(['reasoning'])
  const entries = Object.entries(content).filter(([k]) => !skip.has(k))
  if (entries.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {entries.map(([key, value]) => (
        <div key={key}>
          {key === 'payload' && typeof value === 'object' && value !== null ? (
            renderPayload(value)
          ) : typeof value === 'string' ? (
            <div style={{
              fontSize: 15, lineHeight: 1.9, color: 'rgba(255,255,255,0.8)',
              padding: '16px 20px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
              ...(value.length > 200 ? { textIndent: '2em' } : {}),
            }}>{value}</div>
          ) : Array.isArray(value) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {value.map((item, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                  fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                }}>
                  {typeof item === 'string' ? item : renderObject(item)}
                </div>
              ))}
            </div>
          ) : typeof value === 'object' && value !== null ? (
            <div style={{
              padding: '12px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
              fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
            }}>
              {renderObject(value)}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{String(value)}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function renderObject(obj: Record<string, any>) {
  return Object.entries(obj).map(([k, v]) => (
    <div key={k} style={{ marginBottom: 4 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatKey(k)}：</span>
      <span style={{ color: 'var(--text-secondary)' }}>{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</span>
    </div>
  ))
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {icon}
      {children}
    </div>
  )
}

function PipelineBlock({ label, icon, content }: { label: string; icon: React.ReactNode; content: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!content) return null
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: 'transparent', border: 'none', padding: '6px 0', color: 'var(--text-secondary)',
        fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
      }}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon}
        {label}
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{content.length} 字符</span>
      </button>
      {expanded && (
        <pre style={{
          marginTop: 4, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
          fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 300, overflow: 'auto',
        }}>{content}</pre>
      )}
    </div>
  )
}

export default function MOUModal({ open, proposal, siblings, onClose, onApprove, onReject, onRevise: _onRevise, onDiscuss, stageTitle, error }: MOUModalProps) {
  if (!proposal) return null

  const [authorNotes, setAuthorNotes] = useState('')
  const [activeAction, setActiveAction] = useState<'none' | 'reject' | 'discuss'>('none')
  const [pipelineExpanded, setPipelineExpanded] = useState(false)

  const allSiblings = siblings || [proposal]
  const isMultiOption = allSiblings.length > 1
  const [selectedIdx, setSelectedIdx] = useState(() => allSiblings.findIndex(s => s.id === proposal.id))
  const active = allSiblings[selectedIdx] || proposal

  const isPending = active.status === 'pending'
  const isRevisionRequested = active.status === 'revision_requested'
  const canAct = isPending || isRevisionRequested
  const color = typeColors[active.type] || 'var(--accent-ice)'
  const label = typeLabels[active.type] || active.type
  const icon = <TypeIcon type={active.type} size={12} />
  const statusCfg = proposalStatusConfig[active.status]
  const pipeline = active.pipeline
  const modalTitle = stageTitle || 'MOU 提案审批'

  const handleApprove = () => {
    onApprove(active.id)
  }

  const handleReject = () => {
    if (activeAction === 'reject') {
      onReject(active.id)
    } else {
      setActiveAction('reject')
    }
  }

  const handleDiscuss = () => {
    // If user already typed feedback, submit immediately without showing sub-panel
    if (authorNotes.trim()) {
      onDiscuss(active.id, authorNotes.trim())
      setAuthorNotes('')
      setActiveAction('none')
      return
    }
    // Otherwise toggle the discuss sub-panel
    if (activeAction === 'discuss') {
      setActiveAction('none')
    } else {
      setActiveAction('discuss')
    }
  }

  const handleDiscussSubmit = () => {
    if (authorNotes.trim()) {
      onDiscuss(active.id, authorNotes.trim())
      setAuthorNotes('')
      setActiveAction('none')
    }
  }

  return (
    <Modal
      open={open}
      onClose={canAct ? undefined : onClose}
      title={modalTitle}
      wide
    >
      {/* ── Multi-Option Selector ── */}
      {isMultiOption && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel icon={<Sparkles size={12} />}>选择方案（{allSiblings.length} 个选项）</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allSiblings.map((s, i) => {
              const isActive = i === selectedIdx
              return (
                <button key={s.id} onClick={() => setSelectedIdx(i)} style={{
                  padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                  border: isActive ? `1px solid ${color}50` : '1px solid var(--glass-border)',
                  background: isActive ? `${color}12` : 'rgba(255,255,255,0.02)',
                  fontFamily: 'var(--font-ui)', textAlign: 'left', maxWidth: 260,
                  transition: 'all var(--duration) var(--ease)',
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? color : 'var(--text-primary)',
                    marginBottom: 4, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {stripSchemePrefix(s.title)}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.reasoning?.substring(0, 60) || '无说明'}...
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Proposal Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px',
            borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
            background: `${color}10`, color, border: `1px solid ${color}20`,
          }}>
            {icon}{label}
          </span>
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'var(--text-primary)' }}>
            {stripSchemePrefix(active.title)}
          </span>
        </div>
        {!canAct && statusCfg && (
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6,
            background: statusCfg.bg, color: statusCfg.color,
            border: `1px solid ${statusCfg.color}20`,
          }}>
            {statusCfg.label}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
        来自 {active.sourceNode || 'AI Engine'} · {new Date(active.createdAt).toLocaleString('zh-CN')}
      </div>

      {/* ── AI Reasoning ── */}
      {active.reasoning && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel icon={<Brain size={12} />}>AI 推理</SectionLabel>
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
            fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)',
          }}>
            {active.reasoning}
          </div>
        </div>
      )}

      {/* ── Proposal Content ── */}
      {active.content && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel icon={<FileText size={12} />}>提案内容</SectionLabel>
          {renderContent(active.content)}
        </div>
      )}

      {/* ── AI Pipeline (collapsible) ── */}
      {pipeline && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setPipelineExpanded(!pipelineExpanded)} style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            background: 'transparent', border: 'none', padding: '6px 0',
            color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-ui)',
          }}>
            {pipelineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Terminal size={12} />
            AI 推理管线
          </button>
          {pipelineExpanded && (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {/* Pipeline stats */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {pipeline.model && (
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4,
                    background: 'rgba(125,211,252,0.08)', color: 'var(--accent-ice)',
                    border: '1px solid rgba(125,211,252,0.15)',
                  }}>
                    <Zap size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {pipeline.model}
                  </span>
                )}
                {pipeline.totalTokens != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {pipeline.promptTokens || 0} + {pipeline.completionTokens || 0} = {pipeline.totalTokens} tokens
                  </span>
                )}
                {pipeline.latencyMs != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {(pipeline.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              <PipelineBlock label="系统提示词" icon={<Terminal size={11} />} content={pipeline.systemPrompt || ''} />
              <PipelineBlock label="用户提示词" icon={<User size={11} />} content={pipeline.userPrompt || ''} />
              <PipelineBlock label="原始输出" icon={<FileCode size={11} />} content={pipeline.rawOutput || ''} />
            </div>
          )}
        </div>
      )}

      {/* ── Meta Grid ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel icon={<Sparkles size={12} />}>关联信息</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MetaItem icon={<Link size={13} style={{ color: 'var(--accent-ice)' }} />} label="提案类型" value={label} />
          <MetaItem icon={<ShieldAlert size={13} style={{ color: 'var(--accent-rose)' }} />} label="来源节点" value={active.sourceNode || '--'} />
          <MetaItem icon={<BarChart3 size={13} style={{ color: 'var(--accent-mint)' }} />} label="当前状态" value={statusCfg?.label || active.status} />
          <MetaItem icon={<Clock size={13} style={{ color: 'var(--accent-violet)' }} />} label="提交时间" value={new Date(active.createdAt).toLocaleString('zh-CN')} />
        </div>
      </div>

      {/* ── Resolved Proposal: Decision History ── */}
      {!canAct && (
        <div style={{
          marginTop: 20, padding: '14px 16px', borderRadius: 10,
          background: active.status === 'approved' ? 'rgba(134,239,172,0.04)' : 'rgba(252,165,165,0.04)',
          border: `1px solid ${active.status === 'approved' ? 'rgba(134,239,172,0.1)' : 'rgba(252,165,165,0.1)'}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scroll size={12} />
            决策记录
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {active.status === 'approved' && '此提案已通过审批，相关设定已写入世界引擎。'}
            {active.status === 'rejected' && '此提案已被作者驳回。'}
            {active.status === 'superseded' && '此提案已被选中的方案替代。'}
            {active.status === 'revision_requested' && '此提案正在根据作者的修改意见重新生成。'}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            提案 ID: {active.id.slice(0, 8)}...
          </div>
        </div>
      )}

      {/* ── Author Notes (always visible when actionable) ── */}
      {canAct && (
        <div style={{ marginTop: 20 }}>
          <SectionLabel icon={<PenLine size={12} />}>你的批示</SectionLabel>
          <textarea
            value={authorNotes}
            onChange={(e) => setAuthorNotes(e.target.value)}
            placeholder="在此输入你的意见、修改要求、补充说明...&#10;&#10;例如：批准，但最后一段描写再克制一些"
            rows={3}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10,
              border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-ui)',
              outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, resize: 'vertical',
              transition: 'border-color var(--duration) var(--ease)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(120,160,255,0.4)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)' }}
          />
        </div>
      )}

      {/* ── Discuss Sub-Panel ── */}
      {canAct && activeAction === 'discuss' && (
        <div style={{
          marginTop: 12, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(253,230,138,0.04)', border: '1px solid rgba(253,230,138,0.12)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--accent-warm)', marginBottom: 8, fontWeight: 500 }}>
            商讨模式 — AI 将根据你的反馈重新考虑此提案
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setActiveAction('none'); setAuthorNotes('') }} style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--glass-border)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            }}>取消</button>
            <button onClick={handleDiscussSubmit} disabled={!authorNotes.trim()} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: authorNotes.trim() ? 'rgba(253,230,138,0.16)' : 'rgba(253,230,138,0.06)',
              color: 'var(--accent-warm)', fontSize: 13, cursor: authorNotes.trim() ? 'pointer' : 'default',
              fontWeight: 500, fontFamily: 'var(--font-ui)',
            }}>发起商讨</button>
          </div>
        </div>
      )}

      {/* ── Reject Confirm ── */}
      {canAct && activeAction === 'reject' && (
        <div style={{
          marginTop: 12, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(252,165,165,0.04)', border: '1px solid rgba(252,165,165,0.12)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--accent-rose)', marginBottom: 8, fontWeight: 500 }}>
            确认驳回此提案？该操作不可撤销。
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setActiveAction('none')} style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--glass-border)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            }}>取消</button>
            <button onClick={handleReject} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'rgba(252,165,165,0.16)', color: 'var(--accent-rose)', fontSize: 13,
              cursor: 'pointer', fontWeight: 500, fontFamily: 'var(--font-ui)',
            }}>确认驳回</button>
          </div>
        </div>
      )}

      {/* ── Error message ── */}
      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(252,165,165,0.08)', border: '1px solid rgba(252,165,165,0.2)',
          fontSize: 13, color: 'var(--accent-rose)', lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      {/* ── Action Buttons ── */}
      {canAct && (
        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--glass-border)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={handleReject} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(252,165,165,0.2)',
            background: 'rgba(252,165,165,0.12)', color: 'var(--accent-rose)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(252,165,165,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(252,165,165,0.12)' }}
          >
            <X size={15} /> 驳回
          </button>
          <button onClick={handleDiscuss} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(253,230,138,0.2)',
            background: 'rgba(253,230,138,0.12)', color: 'var(--accent-warm)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(253,230,138,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(253,230,138,0.12)' }}
          >
            <MessageCircle size={15} /> 商讨
          </button>
          <button onClick={handleApprove} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(134,239,172,0.2)',
            background: 'rgba(134,239,172,0.12)', color: 'var(--accent-mint)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(134,239,172,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(134,239,172,0.12)' }}
          >
            <Check size={15} /> {isMultiOption ? '选择此方案' : '批准'}
          </button>
        </div>
      )}

      {/* ── Close button for resolved proposals ── */}
      {!canAct && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid var(--glass-border)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 13,
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
            transition: 'all var(--duration) var(--ease)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            关闭
          </button>
        </div>
      )}
    </Modal>
  )
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8,
      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)',
    }}>
      {icon}
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
        <div>{value}</div>
      </div>
    </div>
  )
}
