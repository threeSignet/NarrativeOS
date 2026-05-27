import { useState } from 'react'
import { Sparkles, PenLine, Trash2 } from 'lucide-react'
import EngineIDEView from './EngineIDEView'
import type { SettingItem } from '../../stores/hatch'
import { engineLabelMap } from '../../utils/engineConfig'
import { SUBTYPE_LABELS, CONTENT_LABELS, formatContent } from '../../utils/labels'
import { apiPost } from '../../api/client'

export default function GenericEngineView({ settingItems, engineType, projectId, onClose }: {
  settingItems: SettingItem[]
  engineType: string
  projectId: string
  onClose?: () => void
}) {
  const items = settingItems.filter((i) => i.type === engineType)
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
      } else if (action === 'revise' && reviseInput.trim()) {
        const res = await apiPost<any>(`/settings/items/${itemId}/propose-update`, {
          reasoning: reviseInput,
        })
        setActionStatus(res.success ? 'done-revise' : 'error')
        setReviseInput(''); setShowRevise(false)
      } else if (action === 'delete') {
        const res = await apiPost<any>(`/settings/items/${itemId}/propose-delete`, {})
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
      const res = await apiPost<any>(`/hatch/${projectId}/engine/${engineType}/create-item`, {
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {item.name.replace(/^方案[A-Z][:：]\s*/, '')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
            {engineLabelMap[engineType] || engineType} · {SUBTYPE_LABELS[item.itemSubtype || ''] || item.itemSubtype || ''}
          </div>

          {item.summary && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              {item.summary}
            </div>
          )}

          {fields.map((f, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{f.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {f.value}
              </div>
            </div>
          ))}

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
               actionStatus === 'done-create' ? '创建提案已提交，请在 MOU 弹窗中审批。' :
               actionStatus?.startsWith('error') ? actionStatus :
               actionStatus === 'create' ? '正在生成提案...' : ''}
            </div>
          )}

          {showRevise && (
            <div style={{ marginTop: 10 }}>
              <textarea value={reviseInput} onChange={(e) => setReviseInput(e.target.value)}
                placeholder="描述你想要的修改..."
                rows={3}
                style={textAreaStyle} />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button onClick={() => handleAction(item.id, 'revise')}
                  disabled={!reviseInput.trim()} style={actionBtn('var(--accent-ice)')}>
                  提交修订
                </button>
                <button onClick={() => setShowRevise(false)} style={cancelBtnStyle}>取消</button>
              </div>
            </div>
          )}
        </div>

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
      items={items}
      engineType={engineType}
      projectId={projectId}
      renderDetail={renderDetail}
      onCreateItem={() => setShowCreate(!showCreate)}
    >
      {(selectedItem, _onSelect) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, padding: 20 }}>
          {/* Create form overlay */}
          {showCreate && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            }}>
              <div style={{
                width: 360, padding: 20, borderRadius: 12,
                background: 'rgba(16,16,28,0.96)', border: '1px solid var(--glass-border)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>新增条目</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  描述你想创建的{engineLabelMap[engineType] || engineType}内容
                </div>
                <textarea value={createInput} onChange={(e) => setCreateInput(e.target.value)}
                  placeholder="例如：新增一个势力「青云宗」，是正道第一大宗门..."
                  rows={3} style={textAreaStyle} />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => setShowCreate(false)} style={cancelBtnStyle}>取消</button>
                  <button onClick={handleCreate} disabled={!createInput.trim()}
                    style={actionBtn('var(--accent-violet)')}>提交提案</button>
                </div>
              </div>
            </div>
          )}

          {/* Center: show detail when selected, otherwise placeholder */}
          {selectedItem ? (
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                {selectedItem.name.replace(/^方案[A-Z][:：]\s*/, '')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {selectedItem.summary || '在右侧面板查看和编辑详细信息'}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {items.length === 0 ? '暂无数据，点击左下角按钮新增条目' : '选择左侧条目查看详情'}
              </p>
            </div>
          )}
        </div>
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

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--glass-border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: 11,
  cursor: 'pointer', fontFamily: 'var(--font-ui)',
}

const textAreaStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-primary)', fontSize: 12, outline: 'none',
  resize: 'vertical', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
}
