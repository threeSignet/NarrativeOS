import { useState } from 'react'
import {
  ChevronRight, Settings, Brain, Zap, PenLine,
} from 'lucide-react'
import type { Project } from '../../stores/projects'

export default function SettingsPanel({ project, onUpdate }: {
  project: Project
  onUpdate: (updates: Record<string, any>) => Promise<void>
}) {
  const [section, setSection] = useState<'main' | 'model' | 'api'>('main')
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = (field: string, value: any) => {
    setEditField(field)
    setEditValue(String(value ?? ''))
  }
  const saveEdit = async () => {
    if (!editField) return
    setSaving(true)
    try { await onUpdate({ [editField]: editValue }) } catch { /* */ }
    setSaving(false)
    setEditField(null)
  }

  const modelFields = [
    { label: '写作风格', field: 'writingStyle', value: project.style },
    { label: '目标字数', field: 'targetWords', value: project.targetWords },
    { label: '目标章节', field: 'targetChapters', value: (project as any).targetChapters },
    { label: '自定义要求', field: 'customInstructions', value: (project as any).customInstructions },
  ]

  if (section === 'model') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setSection('main')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
          <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> 返回设置
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>模型配置</div>
        {modelFields.map(({ label, field, value }) => (
          <div key={field} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            {editField === field ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-ui)' }} />
                <button onClick={saveEdit} disabled={saving} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(134,239,172,0.15)', color: 'var(--accent-mint)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>{saving ? '...' : '保存'}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => startEdit(field, value)}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{value || '未设置'}</span>
                <PenLine size={12} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (section === 'api') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setSection('main')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
          <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> 返回设置
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>API 密钥</div>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(252,165,165,0.04)', border: '1px solid rgba(252,165,165,0.1)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          API 密钥由服务端 .env 文件配置，前端无法直接修改。请在服务器端修改后重启服务。
        </div>
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>当前供应商</div>
          <span style={{ fontSize: 13, color: 'var(--accent-ice)' }}>服务端配置</span>
        </div>
      </div>
    )
  }

  const mainItems = [
    { label: '项目设置', icon: <Settings size={16} />, desc: '写作风格、目标字数等', section: 'model' as const },
    { label: '模型配置', icon: <Brain size={16} />, desc: 'AI 模型和生成参数', section: 'model' as const },
    { label: 'API 密钥', icon: <Zap size={16} />, desc: 'LLM 供应商配置', section: 'api' as const },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{project.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(125,211,252,0.08)', color: 'var(--accent-ice)', border: '1px solid rgba(125,211,252,0.15)' }}>{project.genre || '未设定'}</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(196,181,253,0.08)', color: 'var(--accent-violet)', border: '1px solid rgba(196,181,253,0.15)' }}>{project.status}</span>
        </div>
      </div>

      {mainItems.map(({ label, icon, desc, section: sec }) => (
        <div key={label} onClick={() => setSection(sec)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all var(--duration) var(--ease)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)' }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      ))}
    </div>
  )
}
