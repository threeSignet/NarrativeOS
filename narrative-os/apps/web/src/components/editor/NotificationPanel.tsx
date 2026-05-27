import { useState, useEffect } from 'react'
import { Bell, Check, Info, AlertTriangle, Sparkles, Settings } from 'lucide-react'
import { apiFetch } from '../../api/client'

interface Notification {
  id: string
  priority: string
  category: string
  title: string
  body: string
  sourceNode: string | null
  status: string
  createdAt: string
}

interface NotificationPanelProps {
  projectId: string
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  p0: { label: '紧急', color: '#ef4444' },
  p1: { label: '重要', color: '#f97316' },
  p2: { label: '普通', color: '#7dd3fc' },
  p3: { label: '提示', color: '#a3a3a3' },
  p4: { label: '调试', color: '#525252' },
}

const categoryIcons: Record<string, React.ReactNode> = {
  conflict: <AlertTriangle size={14} />,
  proposal: <Sparkles size={14} />,
  system: <Info size={14} />,
  retcon: <Settings size={14} />,
  preview: <Bell size={14} />,
  setting: <Check size={14} />,
}

export default function NotificationPanel({ projectId }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await apiFetch<{ notifications: Notification[] }>(`/notifications/${projectId}?limit=50`)
        setNotifications(data.notifications || [])
      } catch (err) {
        console.error('[notifications] fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
  }, [projectId])

  const handleAction = async (id: string, action: string) => {
    try {
      await apiFetch(`/notifications/${id}/${action}`, { method: 'POST' })
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, status: action } : n)
      )
    } catch { /* ignore */ }
  }

  const handleDismissAll = async () => {
    const unread = notifications.filter((n) => n.status === 'unread')
    for (const n of unread) {
      await handleAction(n.id, 'dismissed')
    }
  }

  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'transparent',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--glass-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} style={{ color: 'var(--accent-ice)' }} />
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: 15, color: 'var(--text-primary)' }}>
            通知
          </span>
          {unreadCount > 0 && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(125,211,252,0.1)', color: 'var(--accent-ice)',
              border: '1px solid rgba(125,211,252,0.15)',
            }}>
              {unreadCount} 未读
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {unreadCount > 0 && (
            <button onClick={handleDismissAll} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>
              全部已读
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
            加载中...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
            暂无通知
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {notifications.map((n) => {
              const prio = priorityConfig[n.priority] || priorityConfig.p2
              const icon = categoryIcons[n.category] || <Bell size={14} />
              const isUnread = n.status === 'unread'

              return (
                <div key={n.id} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: isUnread ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: `1px solid ${isUnread ? 'var(--glass-border-hover)' : 'transparent'}`,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  opacity: isUnread ? 1 : 0.5,
                  transition: 'all var(--duration) var(--ease)',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isUnread ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${prio.color}10`, color: prio.color,
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: `${prio.color}10`, color: prio.color,
                      }}>
                        {prio.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {n.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                      {new Date(n.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  {isUnread && (
                    <button onClick={() => handleAction(n.id, 'read')} style={{
                      width: 22, height: 22, borderRadius: 5, border: 'none',
                      background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                    }} title="标记已读">
                      <Check size={11} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
