import { useState, useMemo } from 'react'
import { Sparkles, PenLine, MessageCircle, Trash2, Loader2 } from 'lucide-react'
import EngineIDEView from './EngineIDEView'
import CharacterGraphView from './CharacterGraphView'
import type { SettingItem } from '../../stores/hatch'
import { engineLabelMap } from '../../utils/engineConfig'
import { SUBTYPE_LABELS, CONTENT_LABELS, formatContent } from '../../utils/labels'
import { apiPost } from '../../api/client'

function filterCharacters(items: SettingItem[]): SettingItem[] {
  return items.filter((i) => i.type === 'character')
}

export default function CharacterEngineView({ items, projectId }: {
  items: SettingItem[]
  projectId: string
}) {
  const characterItems = useMemo(() => filterCharacters(items), [items])
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [reviseInput, setReviseInput] = useState('')
  const [showRevise, setShowRevise] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createInput, setCreateInput] = useState('')

  const handleAction = async (itemId: string, action: string) => {
    setActionStatus(action)
    try {
      if (action === 'refine') {
        const res = await apiPost<any>(`/proposals/${itemId}/revise`, {
          notes: '请完善此条目的所有字段，补充缺失信息。',
        })
        setActionStatus(res.success ? 'done-refine' : 'error')
      } else if (action === 'revise') {
        if (!reviseInput.trim()) return
        const res = await apiPost<any>(`/settings/items/${itemId}/propose-update`, {
          reasoning: reviseInput,
        })
        setActionStatus(res.success ? 'done-revise' : 'error')
        setReviseInput('')
        setShowRevise(false)
      } else if (action === 'delete') {
        const res = await apiPost<any>(`/settings/items/${itemId}/propose-delete`, {
          reasoning: '作者请求删除此角色条目',
        })
        setActionStatus(res.success ? 'done-delete' : 'error')
      }
    } catch (err: any) {
      setActionStatus(`error: ${err.message}`)
    }
    setTimeout(() => setActionStatus(null), 3000)
  }

  const handleCreate = async () => {
    if (!createInput.trim()) return
    setActionStatus('create')
    try {
      const res = await apiPost<any>(`/hatch/${projectId}/engine/character/create-item`, {
        userInput: createInput,
      })
      setActionStatus(res.success ? 'done-create' : 'error')
      setCreateInput(''); setShowCreate(false)
    } catch (err: any) {
      setActionStatus(`error: ${err.message}`)
    }
    setTimeout(() => setActionStatus(null), 3000)
  }

  const renderDetail = (item: SettingItem, _onAction: (action: string) => void) => {
    const fields = formatContent((item.content || {}) as Record<string, any>)
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Detail content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {item.name.replace(/^方案[A-Z][:：]\s*/, '')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
            角色 · {SUBTYPE_LABELS[item.itemSubtype || ''] || item.itemSubtype || '未知'}
          </div>

          {fields.length > 0 ? fields.map((f, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{f.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {f.value}
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {item.summary || '暂无详细信息'}
            </div>
          )}

          {/* Status message */}
          {actionStatus && (
            <div style={{
              marginTop: 10, padding: '6px 10px', borderRadius: 6, fontSize: 11,
              background: actionStatus.startsWith('done') ? 'rgba(134,239,172,0.06)' : actionStatus.startsWith('error') ? 'rgba(252,165,165,0.06)' : 'rgba(255,255,255,0.03)',
              color: actionStatus.startsWith('done') ? 'var(--accent-mint)' : actionStatus.startsWith('error') ? 'var(--accent-rose)' : 'var(--text-muted)',
              border: `1px solid ${actionStatus.startsWith('done') ? 'rgba(134,239,172,0.12)' : actionStatus.startsWith('error') ? 'rgba(252,165,165,0.12)' : 'var(--glass-border)'}`,
            }}>
              {actionStatus === 'done-refine' ? '完善提案已创建，请在 MOU 弹窗中审批。' :
               actionStatus === 'done-revise' ? '修订提案已创建，请在 MOU 弹窗中审批。' :
               actionStatus === 'done-delete' ? '删除提案已创建，含影响分析，请在 MOU 弹窗中审批。' :
               actionStatus === 'refine' ? '正在生成完善提案...' :
               actionStatus === 'delete' ? '正在分析删除影响...' :
               actionStatus?.startsWith('error') ? actionStatus : ''}
            </div>
          )}

          {/* Revise input */}
          {showRevise && (
            <div style={{ marginTop: 10 }}>
              <textarea value={reviseInput} onChange={(e) => setReviseInput(e.target.value)}
                placeholder="描述你想要的修改..."
                rows={3}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-primary)', fontSize: 11, outline: 'none',
                  resize: 'vertical', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => handleAction(item.id, 'revise')}
                  disabled={!reviseInput.trim()} style={actionBtn('var(--accent-ice)')}>
                  提交修订
                </button>
                <button onClick={() => setShowRevise(false)} style={cancelBtn}>取消</button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => handleAction(item.id, 'refine')} style={actionBtn('var(--accent-violet)')}>
            <Sparkles size={13} /> 完善此条目
          </button>
          <button onClick={() => { setShowRevise(!showRevise); setReviseInput('') }} style={actionBtn('var(--accent-ice)')}>
            <PenLine size={13} /> 修订
          </button>
          <button onClick={() => handleAction(item.id, 'delete')} style={actionBtn('var(--accent-rose)')}>
            <Trash2 size={13} /> 删除（含影响分析）
          </button>
        </div>
      </div>
    )
  }

  return (
    <EngineIDEView
      items={characterItems}
      engineType="character"
      projectId={projectId}
      onCreateItem={() => setShowCreate(true)}
      renderDetail={renderDetail}
    >
      {(selectedItem, onSelect) => (
        <>
          <CharacterGraphView
            characterItems={characterItems}
            allItems={items}
            selectedId={selectedItem?.id || null}
            onSelect={onSelect}
          />
          {/* Create form overlay */}
          {showCreate && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            }}>
              <div style={{
                width: 380, padding: 20, borderRadius: 12,
                background: 'rgba(16,16,28,0.96)', border: '1px solid var(--glass-border)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  新增角色
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  描述你想创建的角色，AI 将基于已有世界观生成提案
                </div>
                <textarea value={createInput} onChange={(e) => setCreateInput(e.target.value)}
                  placeholder="例如：新增一个角色「铁无双」，是太古盟的长老，外表粗犷内心细腻，擅长锻造神兵..."
                  rows={4}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                    resize: 'vertical', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
                  }}
                />
                {actionStatus && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11,
                    background: actionStatus.startsWith('done') ? 'rgba(134,239,172,0.06)' : actionStatus.startsWith('error') ? 'rgba(252,165,165,0.06)' : 'rgba(255,255,255,0.03)',
                    color: actionStatus.startsWith('done') ? 'var(--accent-mint)' : actionStatus.startsWith('error') ? 'var(--accent-rose)' : 'var(--text-muted)',
                  }}>
                    {actionStatus === 'done-create' ? '提案已提交，请在 MOU 弹窗中审批。' :
                     actionStatus === 'create' ? '正在生成提案...' :
                     actionStatus?.startsWith('error') ? actionStatus : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => { setShowCreate(false); setCreateInput('') }}
                    style={cancelBtn}>取消</button>
                  <button onClick={handleCreate} disabled={!createInput.trim()}
                    style={submitBtn(!createInput.trim())}>生成提案</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </EngineIDEView>
  )
}

const actionBtn = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: `1px solid ${color}18`, background: `${color}08`,
  color, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
})

const cancelBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--glass-border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: 11,
  cursor: 'pointer', fontFamily: 'var(--font-ui)',
}

const submitBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: 'rgba(196,181,253,0.15)', color: 'var(--accent-violet)',
  fontSize: 12, fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'var(--font-ui)', opacity: disabled ? 0.4 : 1,
})
