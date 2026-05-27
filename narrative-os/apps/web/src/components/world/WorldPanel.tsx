import { memo } from 'react'
import { Eye, Compass } from 'lucide-react'
import type { EngineInfo, SettingItem } from '../../stores/hatch'
import { engineConfig } from '../../utils/engineConfig'

const WorldPanel = memo(function WorldPanel({ engines, settingItems, onOpenEngineView, onOpenWorldView, searchQuery }: {
  engines: EngineInfo[]
  settingItems: SettingItem[]
  onOpenEngineView: (engineType: string, engineLabel: string) => void
  onOpenWorldView: () => void
  searchQuery: string
}) {
  const engineMap = Object.fromEntries(engines.map((e) => [e.type, e]))
  const query = searchQuery.toLowerCase().trim()

  const visibleConfig = query
    ? engineConfig.filter((cfg) =>
        cfg.label.includes(query) || cfg.key.includes(query))
    : engineConfig

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Engine cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
      }}>
        {visibleConfig.map((cfg) => {
          const engine = engineMap[cfg.key]
          const hasData = engine?.hasData || settingItems.some((i) => i.type === cfg.key && i.status === 'confirmed')
          const itemCount = settingItems.filter((i) => i.type === cfg.key && i.status === 'confirmed').length
          const isPending = engine?.hasPending || false

          return (
            <button
              key={cfg.key}
              onClick={() => hasData && onOpenEngineView(cfg.key, cfg.label)}
              disabled={!hasData}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 8px', borderRadius: 10, border: 'none',
                background: hasData ? `${cfg.color}08` : 'rgba(255,255,255,0.02)',
                cursor: hasData ? 'pointer' : 'default',
                fontFamily: 'var(--font-ui)',
                opacity: hasData ? 1 : 0.4,
                transition: 'all var(--duration) var(--ease)',
                position: 'relative',
              }}
              onMouseEnter={(e) => { if (hasData) e.currentTarget.style.background = `${cfg.color}14` }}
              onMouseLeave={(e) => { if (hasData) e.currentTarget.style.background = `${cfg.color}08` }}
            >
              {/* Status dot */}
              <div style={{
                position: 'absolute', top: 6, right: 6,
                width: 6, height: 6, borderRadius: '50%',
                background: isPending ? 'var(--accent-warm)' : hasData ? 'var(--accent-mint)' : 'var(--text-muted)',
                boxShadow: isPending ? '0 0 6px var(--accent-warm)' : hasData ? '0 0 6px var(--accent-mint)' : 'none',
              }} />

              <div style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${cfg.color}12`, color: cfg.color,
              }}>
                {cfg.icon}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                {cfg.label}
              </div>
              {isPending && (
                <span style={{ fontSize: 9, color: 'var(--accent-warm)' }}>生成中</span>
              )}
              {hasData && !isPending && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {itemCount} 条 · 查看
                </span>
              )}
              {!hasData && !isPending && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>暂无数据</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--glass-border)', margin: '2px 0' }} />

      {/* World Dashboard button */}
      <button onClick={onOpenWorldView} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '12px 14px', borderRadius: 10,
        border: '1px solid rgba(196,181,253,0.15)',
        background: 'rgba(196,181,253,0.06)',
        cursor: 'pointer', fontFamily: 'var(--font-ui)',
        transition: 'all var(--duration) var(--ease)',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.12)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(196,181,253,0.06)' }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'rgba(196,181,253,0.12)', color: 'var(--accent-violet)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Compass size={18} />
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>世界视图</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>查看所有世界设定的地图全貌</div>
        </div>
      </button>
    </div>
  )
})

export default WorldPanel
