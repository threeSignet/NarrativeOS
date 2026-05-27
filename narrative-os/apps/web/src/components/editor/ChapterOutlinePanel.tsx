import { memo } from 'react'
import { Users, MapPin, Sparkles, CheckCircle, Circle, ChevronRight } from 'lucide-react'

interface ChapterOutlineData {
  title?: string
  summary?: string
  keyCharacters?: string[]
  keyLocations?: string[]
  keyEvents?: Array<{ event: string; completed?: boolean }>
  toPlantForeshadowings?: string[]
  toResolveForeshadowings?: string[]
  targetWords?: number
}

interface ChapterOutlinePanelProps {
  data: ChapterOutlineData
  onClose?: () => void
}

export default memo(function ChapterOutlinePanel({ data, onClose }: ChapterOutlinePanelProps) {
  return (
    <div style={{
      position: 'absolute',
      left: 12, top: 56, bottom: 12,
      width: 210,
      background: 'rgba(12, 12, 20, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: 12,
      overflowY: 'auto',
      padding: 12,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontSize: 12,
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-ice)', textTransform: 'uppercase', letterSpacing: 1 }}>章纲</span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Summary */}
      {data.summary && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', lineHeight: 1.5 }}>
          {data.summary}
        </div>
      )}

      {/* Characters */}
      {data.keyCharacters && data.keyCharacters.length > 0 && (
        <Section icon={<Users size={12} />} title="出场角色">
          {data.keyCharacters.map((name, i) => (
            <Pill key={i} color="ice">{name}</Pill>
          ))}
        </Section>
      )}

      {/* Locations */}
      {data.keyLocations && data.keyLocations.length > 0 && (
        <Section icon={<MapPin size={12} />} title="场景">
          {data.keyLocations.map((name, i) => (
            <Pill key={i} color="mint">{name}</Pill>
          ))}
        </Section>
      )}

      {/* Key events progress */}
      {data.keyEvents && data.keyEvents.length > 0 && (
        <Section icon={<Sparkles size={12} />} title="关键事件">
          {data.keyEvents.map((ev, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              {ev.completed ? (
                <CheckCircle size={12} style={{ color: 'var(--accent-mint)', flexShrink: 0, marginTop: 1 }} />
              ) : (
                <Circle size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
              )}
              <span style={{ color: ev.completed ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: ev.completed ? 'line-through' : 'none' }}>
                {ev.event}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Foreshadowing to plant */}
      {data.toPlantForeshadowings && data.toPlantForeshadowings.length > 0 && (
        <Section icon={<Sparkles size={12} />} title="伏笔植入">
          {data.toPlantForeshadowings.map((f, i) => (
            <Pill key={i} color="warm">{f}</Pill>
          ))}
        </Section>
      )}

      {/* Foreshadowing to resolve */}
      {data.toResolveForeshadowings && data.toResolveForeshadowings.length > 0 && (
        <Section icon={<Sparkles size={12} />} title="伏笔回收">
          {data.toResolveForeshadowings.map((f, i) => (
            <Pill key={i} color="violet">{f}</Pill>
          ))}
        </Section>
      )}

      {/* Target words */}
      {data.targetWords && (
        <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', fontSize: 10, color: 'var(--text-muted)' }}>
          目标字数：{data.targetWords.toLocaleString()}
        </div>
      )}
    </div>
  )
})

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {icon} {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

const PILL_COLORS = {
  ice: { bg: 'rgba(125,211,252,0.08)', color: 'var(--accent-ice)', border: 'rgba(125,211,252,0.15)' },
  mint: { bg: 'rgba(134,239,172,0.08)', color: 'var(--accent-mint)', border: 'rgba(134,239,172,0.15)' },
  warm: { bg: 'rgba(253,230,138,0.08)', color: 'var(--accent-warm)', border: 'rgba(253,230,138,0.15)' },
  violet: { bg: 'rgba(196,181,253,0.08)', color: 'var(--accent-violet)', border: 'rgba(196,181,253,0.15)' },
}

function Pill({ children, color }: { children: React.ReactNode; color: keyof typeof PILL_COLORS }) {
  const c = PILL_COLORS[color]
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      lineHeight: 1.4,
    }}>
      {children}
    </span>
  )
}
