// narrative-os/apps/web/src/components/CharterForm.tsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { apiFetch } from '../api/client'

interface CharterFormProps {
  projectId: string
}

const DEFAULT_CHARTER = {
  storySeed: '',
  mainLineBlueprint: {
    structureMode: 'three_act',
    acts: [] as Array<{ actNumber: number; title: string; summary: string; keyEvents: string[] }>,
    totalVolumes: 3,
    totalChapters: 100,
  },
  coreCharacters: [] as Array<{
    name: string
    role: string
    archetype: string
    personality: string
    motivation: string
    growthArc: string
  }>,
  worldRules: [] as Array<{ category: string; rule: string; implications: string[] }>,
  narrativeRules: {
    writingStyle: '',
    pace: 'medium',
    pov: 'third_person_limited',
    tone: '',
    dialogueStyle: '',
    descriptionDensity: 'moderate',
  },
  version: 1,
  lastModifiedAt: new Date().toISOString(),
}

// Simple debounce hook
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => callback(...args), delay)
    },
    [callback, delay]
  )
}

export function CharterForm({ projectId }: CharterFormProps) {
  const [charter, setCharter] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    apiFetch(`/projects/${projectId}/charter`)
      .then((data: any) => {
        setCharter(data.charter || DEFAULT_CHARTER)
      })
      .catch((err) => {
        setError(`加载创作宪章失败: ${err.message}`)
        setCharter(DEFAULT_CHARTER)
      })
  }, [projectId])

  const doSave = useCallback(
    async (nextCharter: any) => {
      setSaving(true)
      setError(null)
      nextCharter.lastModifiedAt = new Date().toISOString()
      try {
        await apiFetch(`/projects/${projectId}/charter`, {
          method: 'PATCH',
          body: JSON.stringify({ charter: nextCharter }),
        })
      } catch (err: any) {
        setError(`保存失败: ${err.message}`)
      } finally {
        setSaving(false)
      }
    },
    [projectId]
  )

  const saveCharter = useDebouncedCallback(doSave, 500)

  if (error && !charter) {
    return <div className="p-4 text-red-500">{error}</div>
  }
  if (!charter) return <div className="p-4 text-gray-500">加载中...</div>

  return (
    <div className="charter-form space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">五维度创作宪章</h2>
        <div className="flex items-center gap-2">
          {saving && <span className="text-sm text-gray-500">保存中...</span>}
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      </div>

      <section>
        <label className="block font-medium mb-1 text-gray-700">故事种子（一句话核心创意）</label>
        <textarea
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          rows={2}
          value={charter.storySeed}
          onChange={(e) => {
            const next = { ...charter, storySeed: e.target.value }
            setCharter(next)
            saveCharter(next)
          }}
          placeholder="例如：如果修仙是一个可编程的系统"
        />
      </section>

      <section>
        <label className="block font-medium mb-1 text-gray-700">主线蓝图</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <select
            className="border rounded-md p-2"
            value={charter.mainLineBlueprint?.structureMode || 'three_act'}
            onChange={(e) => {
              const next = {
                ...charter,
                mainLineBlueprint: { ...(charter.mainLineBlueprint || DEFAULT_CHARTER.mainLineBlueprint), structureMode: e.target.value },
              }
              setCharter(next)
              saveCharter(next)
            }}
          >
            <option value="three_act">三幕式</option>
            <option value="five_act">五幕式</option>
            <option value="heros_journey">英雄之旅</option>
            <option value="kishotenketsu">起承转合</option>
          </select>
          <input
            type="number"
            className="border rounded-md p-2"
            placeholder="总卷数"
            value={charter.mainLineBlueprint?.totalVolumes || 3}
            onChange={(e) => {
              const next = {
                ...charter,
                mainLineBlueprint: { ...(charter.mainLineBlueprint || DEFAULT_CHARTER.mainLineBlueprint), totalVolumes: parseInt(e.target.value) || 1 },
              }
              setCharter(next)
              saveCharter(next)
            }}
          />
          <input
            type="number"
            className="border rounded-md p-2"
            placeholder="总章数"
            value={charter.mainLineBlueprint?.totalChapters || 100}
            onChange={(e) => {
              const next = {
                ...charter,
                mainLineBlueprint: { ...(charter.mainLineBlueprint || DEFAULT_CHARTER.mainLineBlueprint), totalChapters: parseInt(e.target.value) || 1 },
              }
              setCharter(next)
              saveCharter(next)
            }}
          />
        </div>
      </section>

      <section>
        <label className="block font-medium mb-1 text-gray-700">核心角色</label>
        {(charter.coreCharacters || []).map((char: any, idx: number) => (
          <div key={idx} className="border p-3 rounded-md mb-2 bg-white">
            <input
              className="w-full mb-1 border rounded-md p-2"
              placeholder="角色名"
              value={char.name || ''}
              onChange={(e) => {
                const chars = [...(charter.coreCharacters || [])]
                chars[idx] = { ...char, name: e.target.value }
                const next = { ...charter, coreCharacters: chars }
                setCharter(next)
                saveCharter(next)
              }}
            />
            <textarea
              className="w-full border rounded-md p-2"
              placeholder="性格描述"
              value={char.personality || ''}
              onChange={(e) => {
                const chars = [...(charter.coreCharacters || [])]
                chars[idx] = { ...char, personality: e.target.value }
                const next = { ...charter, coreCharacters: chars }
                setCharter(next)
                saveCharter(next)
              }}
            />
          </div>
        ))}
        <button
          className="text-sm text-blue-600 hover:text-blue-800"
          onClick={() => {
            const next = {
              ...charter,
              coreCharacters: [...(charter.coreCharacters || []), { name: '', role: 'protagonist', archetype: '', personality: '', motivation: '', growthArc: '' }],
            }
            setCharter(next)
            saveCharter(next)
          }}
        >
          + 添加角色
        </button>
      </section>

      <section>
        <label className="block font-medium mb-1 text-gray-700">世界法则</label>
        {(charter.worldRules || []).map((rule: any, idx: number) => (
          <div key={idx} className="flex gap-2 mb-1">
            <select
              className="border rounded-md p-2"
              value={rule.category || 'physics'}
              onChange={(e) => {
                const rules = [...(charter.worldRules || [])]
                rules[idx] = { ...rule, category: e.target.value }
                const next = { ...charter, worldRules: rules }
                setCharter(next)
                saveCharter(next)
              }}
            >
              <option value="physics">物理法则</option>
              <option value="power_system">力量体系</option>
              <option value="society">社会结构</option>
              <option value="economy">经济规则</option>
              <option value="culture">文化习俗</option>
            </select>
            <input
              className="flex-1 border rounded-md p-2"
              placeholder="法则描述"
              value={rule.rule || ''}
              onChange={(e) => {
                const rules = [...(charter.worldRules || [])]
                rules[idx] = { ...rule, rule: e.target.value }
                const next = { ...charter, worldRules: rules }
                setCharter(next)
                saveCharter(next)
              }}
            />
          </div>
        ))}
        <button
          className="text-sm text-blue-600 hover:text-blue-800"
          onClick={() => {
            const next = {
              ...charter,
              worldRules: [...(charter.worldRules || []), { category: 'physics', rule: '', implications: [] }],
            }
            setCharter(next)
            saveCharter(next)
          }}
        >
          + 添加法则
        </button>
      </section>

      <section>
        <label className="block font-medium mb-1 text-gray-700">叙事法则</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="border rounded-md p-2"
            placeholder="写作风格"
            value={charter.narrativeRules?.writingStyle || ''}
            onChange={(e) => {
              const next = {
                ...charter,
                narrativeRules: { ...(charter.narrativeRules || DEFAULT_CHARTER.narrativeRules), writingStyle: e.target.value },
              }
              setCharter(next)
              saveCharter(next)
            }}
          />
          <select
            className="border rounded-md p-2"
            value={charter.narrativeRules?.pace || 'medium'}
            onChange={(e) => {
              const next = {
                ...charter,
                narrativeRules: { ...(charter.narrativeRules || DEFAULT_CHARTER.narrativeRules), pace: e.target.value },
              }
              setCharter(next)
              saveCharter(next)
            }}
          >
            <option value="fast">快节奏</option>
            <option value="medium">中节奏</option>
            <option value="slow">慢节奏</option>
          </select>
        </div>
      </section>
    </div>
  )
}
