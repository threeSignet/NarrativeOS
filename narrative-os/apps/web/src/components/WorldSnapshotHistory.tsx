// narrative-os/apps/web/src/components/WorldSnapshotHistory.tsx
import { useState, useEffect } from 'react'
import { apiFetch, apiPost } from '../api/client'

interface Snapshot {
  id: string
  snapshotType: string
  itemCount: number
  relationCount: number
  createdAt: string
  chapterId: string | null
}

export function WorldSnapshotHistory({ projectId }: { projectId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selectedA, setSelectedA] = useState<string | null>(null)
  const [selectedB, setSelectedB] = useState<string | null>(null)
  const [diff, setDiff] = useState<any>(null)

  useEffect(() => {
    apiFetch(`/api/projects/${projectId}/snapshots`).then((data: any) => {
      setSnapshots(data.snapshots || [])
    })
  }, [projectId])

  const compare = async () => {
    if (!selectedA || !selectedB) return
    const result = await apiPost('/api/world/snapshots/compare', {
      snapshotIdA: selectedA,
      snapshotIdB: selectedB,
    })
    setDiff(result)
  }

  return (
    <div className="snapshot-history p-4">
      <h3 className="font-bold mb-2 text-gray-900">世界状态快照</h3>
      <div className="snapshot-list space-y-1 max-h-60 overflow-auto">
        {snapshots.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50 rounded">
            <input
              type="radio"
              name="snapA"
              checked={selectedA === s.id}
              onChange={() => setSelectedA(s.id)}
            />
            <input
              type="radio"
              name="snapB"
              checked={selectedB === s.id}
              onChange={() => setSelectedB(s.id)}
            />
            <span>{new Date(s.createdAt).toLocaleString()}</span>
            <span className="text-gray-500">({s.snapshotType})</span>
            <span className="text-gray-400">{s.itemCount} 条目</span>
          </div>
        ))}
      </div>
      <button
        className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        disabled={!selectedA || !selectedB}
        onClick={compare}
      >
        对比选中快照
      </button>

      {diff && (
        <div className="diff-result mt-4 space-y-2">
          {diff.added?.length > 0 && (
            <div className="text-green-600 text-sm">新增: {diff.added.length} 项</div>
          )}
          {diff.removed?.length > 0 && (
            <div className="text-red-500 text-sm">移除: {diff.removed.length} 项</div>
          )}
          {diff.modified?.length > 0 && (
            <div className="text-blue-600 text-sm">修改: {diff.modified.length} 项</div>
          )}
        </div>
      )}
    </div>
  )
}
