// narrative-os/apps/web/src/components/SettingItemTimeline.tsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api/client'

interface TimelineEvent {
  id: string
  fieldPath: string
  oldValue: any
  newValue: any
  chapterNumber: number | null
  changeReason: string | null
  createdAt: string
}

export function SettingItemTimeline({ itemId }: { itemId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/api/settings/items/${itemId}/changes`)
      .then((data: any) => {
        setEvents(data.changes || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [itemId])

  if (loading) return <div className="text-sm text-gray-500">加载时间线...</div>
  if (events.length === 0) return <div className="text-gray-500 text-sm">暂无变更记录</div>

  return (
    <div className="timeline">
      <h4 className="font-medium mb-2 text-gray-800">变更历史</h4>
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="text-sm border-l-2 border-blue-300 pl-2">
            <div className="text-gray-600">
              {ev.chapterNumber ? `第 ${ev.chapterNumber} 章` : '即时变更'}
              {' · '}
              {ev.fieldPath.replace('content.', '')}
            </div>
            <div className="flex items-center gap-1 text-xs mt-0.5">
              <span className="text-red-500 line-through">
                {JSON.stringify(ev.oldValue)?.substring(0, 30) || '空'}
              </span>
              <span>→</span>
              <span className="text-green-600">
                {JSON.stringify(ev.newValue)?.substring(0, 30) || '空'}
              </span>
            </div>
            {ev.changeReason && <div className="text-gray-400 text-xs">{ev.changeReason}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
