import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Mountain, Users, Swords, Package, MapPin,
  Sparkles, Globe2, BookOpen, Eye, EyeOff, Crosshair, ChevronRight, ChevronDown, X,
} from 'lucide-react'
import type { SettingItem } from '../../stores/hatch'
import { engineLabelMap } from '../../utils/engineConfig'
import { SUBTYPE_LABELS, SCALE_LABELS, formatContent } from '../../utils/labels'
import type { MapScale } from '../../utils/labels'
import { computeTerritories, type TerritoryResult } from '../../utils/territories'

// ═══════════════════════════════════════════════════
// Territory color palette
// ═══════════════════════════════════════════════════

const TERRITORY_COLORS: [number, number, number][] = [
  [95, 135, 175], [145, 165, 105], [185, 145, 105], [165, 125, 155],
  [115, 155, 165], [175, 155, 125], [135, 130, 175], [155, 165, 145],
]

// ═══════════════════════════════════════════════════
// Data builders
// ═══════════════════════════════════════════════════

function hashPosition(seed: string): { x: number; y: number } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return { x: 120 + Math.abs(h % 760), y: 120 + Math.abs(((h >> 9) ^ (h * 31)) % 760) }
}

function inferScaleFromContext(content: Record<string, any>): MapScale {
  if (content.climate || content.terrain) return 'region'
  if (content.type === '星球' || content.type === '大陆') return 'planet'
  return 'city'
}

function matchName(fieldValue: string, candidates: SettingItem[]): SettingItem | undefined {
  if (!fieldValue) return undefined
  let found = candidates.find((i) => i.name === fieldValue)
  if (found) return found
  found = candidates.find((i) => i.name.includes(fieldValue) || fieldValue.includes(i.name))
  if (found) return found
  const clean = fieldValue.replace(/[（(].+[）)]/g, '').trim()
  if (clean && clean !== fieldValue) {
    found = candidates.find((i) => i.name.includes(clean) || clean.includes(i.name))
    if (found) return found
  }
  return undefined
}

function stripScheme(name: string): string {
  return name.replace(/^方案[A-Z][:：]\s*/, '')
}

interface GeoNode {
  id: string; name: string; subtype: string; scale: MapScale
  parentId: string | null
  x: number; y: number; summary: string; content: Record<string, any>
}

interface OverlayNode {
  id: string; name: string; type: string; subtype: string
  scale: MapScale; parentId: string | null
  x: number; y: number
  summary: string; content: Record<string, any>
}

interface MapRelation {
  sourceId: string; targetId: string; label: string; type: string
}

function buildGeoNodes(items: SettingItem[]): GeoNode[] {
  return items
    .filter((i) => i.type === 'geography' && i.status === 'confirmed')
    .map((item) => {
      const c = (item.content || {}) as Record<string, any>
      const fallback = hashPosition(item.id)
      return {
        id: item.id, name: item.name,
        subtype: item.itemSubtype || 'location',
        scale: (c.scale as MapScale) || inferScaleFromContext(c),
        parentId: item.parentItemId || null,
        x: c.coordinates?.x ?? fallback.x, y: c.coordinates?.y ?? fallback.y,
        summary: item.summary || '', content: c,
      }
    })
}

function buildOverlayNodes(
  items: SettingItem[],
  geoNameMap: Map<string, { x: number; y: number; scale: MapScale }>,
): OverlayNode[] {
  const confirmed = items.filter((i) => i.status === 'confirmed')
  const result: OverlayNode[] = []

  // Collect nodes per base position for spiral offset
  const posBuckets: { node: OverlayNode; posKey: string }[] = []

  for (const item of confirmed) {
    if (item.type === 'geography') continue
    const c = (item.content || {}) as Record<string, any>
    let baseX = 500; let baseY = 500
    let scale: MapScale = 'region'

    let geoName: string | undefined
    if (item.type === 'faction') geoName = c.headquarters
    else if (item.type === 'character') geoName = c.location
    else if (item.type === 'item_system') geoName = c.location || c.current_owner

    // For current_owner → character → location chain
    if (!geoName && item.type === 'item_system' && c.current_owner) {
      const ownerItem = matchName(c.current_owner, confirmed.filter((i) => i.type === 'character'))
      if (ownerItem) {
        const oc = (ownerItem.content || {}) as Record<string, any>
        geoName = oc.location
      }
    }

    if (geoName && geoNameMap.has(geoName)) {
      const pos = geoNameMap.get(geoName)!
      baseX = pos.x; baseY = pos.y; scale = pos.scale
    }

    posBuckets.push({
      node: {
        id: item.id, name: stripScheme(item.name), type: item.type,
        subtype: item.itemSubtype || item.type,
        scale, parentId: item.parentItemId || null,
        x: baseX, y: baseY,
        summary: item.summary || '', content: c,
      },
      posKey: `${baseX.toFixed(0)},${baseY.toFixed(0)}`,
    })
  }

  // Apply spiral offset per position bucket, with type-based angle sectors
  const typeAngleBase: Record<string, number> = { faction: 0, character: 2.1, item_system: 4.2 }
  const posCounters = new Map<string, number>()

  for (const { node, posKey } of posBuckets) {
    const counter = posCounters.get(posKey) || 0
    const baseAngle = typeAngleBase[node.type] || counter * 1.8
    const r = 28 + counter * 10
    const angle = baseAngle + counter * 0.6
    result.push({
      ...node,
      x: node.x + Math.cos(angle) * r,
      y: node.y + Math.sin(angle) * r,
    })
    posCounters.set(posKey, counter + 1)
  }

  return result
}

function buildRelations(allNodes: (GeoNode | OverlayNode)[], overlayNodes: OverlayNode[]): MapRelation[] {
  const relations: MapRelation[] = []
  for (const node of overlayNodes) {
    const c = node.content
    if (node.type === 'character' && c.faction) {
      const fn = overlayNodes.find((n) => n.type === 'faction' && n.name === c.faction)
      if (fn) relations.push({ sourceId: node.id, targetId: fn.id, label: '所属', type: 'faction' })
    }
    if (node.type === 'item_system' && c.current_owner) {
      const owner = overlayNodes.find((n) => n.type === 'character' && n.name === c.current_owner)
      if (owner) relations.push({ sourceId: node.id, targetId: owner.id, label: '持有', type: 'item' })
    }
  }
  return relations
}

// ═══════════════════════════════════════════════════
// Visual config
// ═══════════════════════════════════════════════════

interface EngineVisual {
  color: string; bg: string; size: number; icon: React.ReactNode
  showOnMap: boolean; isAbstract: boolean
}

const ENGINE_VISUAL: Record<string, EngineVisual> = {
  geography: { color: 'var(--accent-mint)', bg: 'rgba(134,239,172,0.15)', size: 0, icon: <Mountain size={9} />, showOnMap: true, isAbstract: false },
  faction: { color: 'var(--accent-orange)', bg: 'rgba(255,160,80,0.18)', size: 13, icon: <Swords size={9} />, showOnMap: true, isAbstract: false },
  character: { color: 'var(--accent-ice)', bg: 'rgba(125,211,252,0.18)', size: 11, icon: <Users size={9} />, showOnMap: true, isAbstract: false },
  item_system: { color: 'var(--accent-gold)', bg: 'rgba(201,165,92,0.18)', size: 9, icon: <Package size={9} />, showOnMap: true, isAbstract: false },
  tone: { color: 'var(--accent-violet)', bg: 'rgba(196,181,253,0.1)', size: 0, icon: <Globe2 size={9} />, showOnMap: false, isAbstract: true },
  power_system: { color: 'var(--accent-rose)', bg: 'rgba(252,165,165,0.1)', size: 0, icon: <Sparkles size={9} />, showOnMap: false, isAbstract: true },
  conflict: { color: 'var(--accent-warm)', bg: 'rgba(253,230,138,0.1)', size: 0, icon: <Crosshair size={9} />, showOnMap: false, isAbstract: true },
  story_blueprint: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', size: 0, icon: <BookOpen size={9} />, showOnMap: false, isAbstract: true },
}

const RELATION_COLORS: Record<string, string> = { faction: 'rgba(255,160,80,0.22)', item: 'rgba(201,165,92,0.22)' }

// ═══════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════

export default function WorldView({ settingItems, projectId, onClose }: {
  settingItems: SettingItem[]
  projectId: string
  onClose?: () => void
}) {
  // ── Data ──
  const geoNodes = useMemo(() => buildGeoNodes(settingItems), [settingItems])

  const geoNameMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; scale: MapScale }>()
    for (const gn of geoNodes) map.set(gn.name, { x: gn.x, y: gn.y, scale: gn.scale })
    return map
  }, [geoNodes])

  const overlayNodes = useMemo(() => buildOverlayNodes(settingItems, geoNameMap), [settingItems, geoNameMap])
  const relations = useMemo(() => buildRelations([...geoNodes, ...overlayNodes], overlayNodes), [geoNodes, overlayNodes])

  const allMapNodes = useMemo(() => [...geoNodes, ...overlayNodes], [geoNodes, overlayNodes])

  // ── 层级导航（与 GeographyView 一致的导航栈模型）──
  const [navigationPath, setNavigationPath] = useState<GeoNode[]>([])
  const currentParentId = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1].id : null
  const currentParent = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : null

  const drillDown = useCallback((node: GeoNode) => {
    setNavigationPath([...navigationPath, node])
    setZoom(1); setPan({ x: 0, y: 0 })
  }, [navigationPath])
  const navigateToLevel = useCallback((index: number) => {
    setNavigationPath(navigationPath.slice(0, index + 1))
    setSelectedId(null); setZoom(1); setPan({ x: 0, y: 0 })
  }, [navigationPath])
  const navigateToRoot = useCallback(() => {
    setNavigationPath([])
    setSelectedId(null); setZoom(1); setPan({ x: 0, y: 0 })
  }, [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [expandedAbstract, setExpandedAbstract] = useState<Set<string>>(new Set())
  const [layers, setLayers] = useState<Record<string, boolean>>({
    geography: true, faction: true, character: true, item_system: true,
  })
  const toggleLayer = (key: string) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))

  // 当前层级的地理节点（子节点 = parentId 匹配 currentParentId）
  const visibleGeoNodes = useMemo(
    () => geoNodes.filter((n) => n.parentId === (currentParentId || null)),
    [geoNodes, currentParentId]
  )
  // 覆层节点跟随地理层级
  const visibleOverlayNodes = useMemo(
    () => overlayNodes.filter((n) => layers[n.type] && n.parentId === (currentParentId || null)),
    [overlayNodes, layers, currentParentId]
  )

  // ── Zoom & pan (identical to GeographyView) ──
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan

  // Attach wheel listener manually to avoid passive event warning
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const z = zoomRef.current
      const p = panRef.current
      const newZoom = Math.min(4, Math.max(0.15, z * delta))
      const scaleChange = newZoom / z
      setZoom(newZoom)
      setPan({ x: mx - (mx - p.x) * scaleChange, y: my - (my - p.y) * scaleChange })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as SVGElement
    if (target === svgRef.current || target.tagName === 'rect' || target.tagName === 'path') {
      setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  // ── Dynamic viewBox (identical to GeographyView) ──
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [svgView, setSvgView] = useState({ w: 1000, h: 1000 })
  useEffect(() => {
    const el = mapContainerRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const cw = e.contentRect.width; const ch = e.contentRect.height
      if (cw > 0 && ch > 0) {
        const aspect = cw / ch
        if (aspect >= 1) setSvgView({ w: Math.round(1000 * aspect), h: 1000 })
        else setSvgView({ w: 1000, h: Math.round(1000 / aspect) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ox = (svgView.w - 1000) / 2
  const oy = (svgView.h - 1000) / 2

  // ── Filtered relations ──
  const visibleRelations = useMemo(() => {
    const ids = new Set([...visibleGeoNodes, ...visibleOverlayNodes].map((n) => n.id))
    return relations.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId))
  }, [relations, visibleGeoNodes, visibleOverlayNodes])

  const territories = useMemo(() => {
    const areaNodes = visibleGeoNodes.map((n) => ({ id: n.id, name: n.name, x: n.x + ox, y: n.y + oy }))
    return computeTerritories(areaNodes, svgView.w, svgView.h)
  }, [visibleGeoNodes, svgView, ox, oy])

  // ── Selection ──
  const selectedNode = useMemo(
    () => allMapNodes.find((n) => n.id === selectedId) || null,
    [allMapNodes, selectedId],
  )

  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const ids = new Set<string>()
    for (const r of relations) {
      if (r.sourceId === selectedId) ids.add(r.targetId)
      if (r.targetId === selectedId) ids.add(r.sourceId)
    }
    return ids
  }, [relations, selectedId])

  const nodeMap = useMemo(() => {
    const map = new Map<string, GeoNode | OverlayNode>()
    for (const n of allMapNodes) map.set(n.id, n)
    return map
  }, [allMapNodes])

  // ── Abstract engines ──
  const abstractGroups = useMemo(() => {
    const confirmed = settingItems.filter((i) => i.status === 'confirmed')
    const groups: { type: string; label: string; vis: EngineVisual; items: SettingItem[] }[] = []
    const seen = new Set<string>()
    for (const item of confirmed) {
      const vis = ENGINE_VISUAL[item.type]
      if (!vis?.isAbstract) continue
      if (seen.has(item.type)) continue
      seen.add(item.type)
      groups.push({
        type: item.type,
        label: engineLabelMap[item.type] || item.type,
        vis,
        items: confirmed.filter((x) => x.type === item.type),
      })
    }
    return groups
  }, [settingItems])

  const toggleExpand = (id: string) => {
    setExpandedAbstract((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Layer counts (当前层级) ──
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    counts['geography'] = visibleGeoNodes.length
    for (const n of visibleOverlayNodes) { counts[n.type] = (counts[n.type] || 0) + 1 }
    return counts
  }, [visibleGeoNodes, visibleOverlayNodes])

  const layerDefs = [
    { key: 'geography', label: '地理', icon: <Mountain size={11} />, color: 'var(--accent-mint)', enabled: layers.geography, count: typeCounts['geography'] || 0 },
    { key: 'faction', label: '势力', icon: <Swords size={11} />, color: 'var(--accent-orange)', enabled: layers.faction, count: typeCounts['faction'] || 0 },
    { key: 'character', label: '角色', icon: <Users size={11} />, color: 'var(--accent-ice)', enabled: layers.character, count: typeCounts['character'] || 0 },
    { key: 'item_system', label: '物品', icon: <Package size={11} />, color: 'var(--accent-gold)', enabled: layers.item_system, count: typeCounts['item_system'] || 0 },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ═══ Left Panel ═══ */}
      <div style={{ width: 260, borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        {/* Layer toggles */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>图层</div>
          {layerDefs.map((l) => (
            <button key={l.key} onClick={() => toggleLayer(l.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '5px 8px', borderRadius: 6, border: 'none',
              background: l.enabled ? 'rgba(255,255,255,0.03)' : 'transparent',
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
              opacity: l.count > 0 ? (l.enabled ? 1 : 0.4) : 0.25,
            }}>
              <span style={{ color: l.color, display: 'flex' }}>{l.icon}</span>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: 'var(--text-primary)' }}>{l.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.count}</span>
              {l.enabled ? <Eye size={12} style={{ color: l.color }} /> : <EyeOff size={12} style={{ color: 'var(--text-muted)' }} />}
            </button>
          ))}
        </div>

        {/* Abstract engines */}
        {abstractGroups.length > 0 && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>抽象层</div>
            {abstractGroups.map((group) => {
              const isExpanded = expandedAbstract.has(group.type)
              const isSelected = selectedId && group.items.some((n) => n.id === selectedId)
              return (
                <div key={group.type} style={{ marginBottom: 2 }}>
                  <div onClick={() => toggleExpand(group.type)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6,
                    cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderLeft: isSelected ? `2px solid ${group.vis.color}` : '2px solid transparent',
                  }}>
                    {isExpanded ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ color: group.vis.color, display: 'flex' }}>{group.vis.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>{group.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{group.items.length}</span>
                  </div>
                  {isExpanded && group.items.map((child) => (
                    <div key={child.id} onClick={() => setSelectedId(child.id)} style={{
                      padding: '4px 8px 4px 34px', borderRadius: 4, cursor: 'pointer',
                      fontSize: 11, color: selectedId === child.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: selectedId === child.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {stripScheme(child.name)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Detail panel (non-geography nodes show here; geography nodes use floating card) */}
        {selectedNode && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>详情</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{selectedNode.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
              {'type' in selectedNode && selectedNode.type
                ? `${engineLabelMap[(selectedNode as OverlayNode).type] || selectedNode.type} · ${SUBTYPE_LABELS[selectedNode.subtype] || selectedNode.subtype}`
                : `${SUBTYPE_LABELS[selectedNode.subtype] || selectedNode.subtype} · ${SCALE_LABELS[selectedNode.scale]}`
              }
            </div>
            {formatContent(selectedNode.content).map((f, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{f.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.value}</div>
              </div>
            ))}
            {formatContent(selectedNode.content).length === 0 && selectedNode.summary && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedNode.summary}</div>
            )}
            {relatedIds.size > 0 && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>关联条目</div>
                {[...relatedIds].map((rid) => {
                  const rn = nodeMap.get(rid); if (!rn) return null
                  const rvis = ENGINE_VISUAL[('type' in rn ? rn.type : 'geography')]
                  return (
                    <div key={rid} onClick={() => setSelectedId(rid)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                      padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
                      color: 'var(--text-secondary)', marginBottom: 2,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: rvis?.color || 'var(--text-muted)', flexShrink: 0 }} />
                      {rn.name}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!selectedNode && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>选择地图上的节点查看详情</p>
          </div>
        )}
      </div>

      {/* ═══ Map Canvas — identical rendering to GeographyView ═══ */}
      <div ref={mapContainerRef} style={{ flex: 1, position: 'relative', background: '#080810' }}>
        <svg ref={svgRef} viewBox={`0 0 ${svgView.w} ${svgView.h}`} preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          <defs>
            <filter id="wavy-wv" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="tex-wv">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="n" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.03 0" in="n" />
            </filter>
          </defs>

          {/* Background */}
          <rect width={svgView.w} height={svgView.h} fill="#080812" />
          <rect width={svgView.w} height={svgView.h} fill="#0c0c18" filter="url(#tex-wv)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

          {/* Territory fills (same as GeographyView) */}
          {layers.geography && visibleGeoNodes.map((node, i) => {
            const fillD = territories.fills.get(node.id)
            if (!fillD) return null
            const isSel = selectedId === node.id
            const [cr, cg, cb] = TERRITORY_COLORS[i % TERRITORY_COLORS.length]
            return (
              <path key={`tf-${node.id}`} d={fillD}
                fill={`rgba(${cr},${cg},${cb},${isSel ? 0.38 : 0.20})`}
                stroke={isSel ? `rgba(${cr},${cg},${cb},0.55)` : 'none'}
                strokeWidth={isSel ? 1.5 : 0}
                style={{ cursor: 'pointer', transition: 'fill 200ms var(--ease)' }}
                onClick={() => setSelectedId(selectedId === node.id ? null : node.id)}
                onDoubleClick={() => drillDown(node)}
              />
            )
          })}

          {/* Territory borders (same as GeographyView) */}
          {layers.geography && territories.borderPath && (
            <path d={territories.borderPath} fill="none"
              stroke="rgba(255,255,255,0.14)" strokeWidth="1"
              filter="url(#wavy-wv)" style={{ pointerEvents: 'none' }} />
          )}

          {/* Inner centering group (same as GeographyView) */}
          <g transform={`translate(${ox}, ${oy})`}>

          {/* Geography relations */}
          {/* (relations are between overlay nodes, rendered below) */}

          {/* Geography labels (same smart positioning as GeographyView) */}
          {layers.geography && visibleGeoNodes.map((node, i) => {
            const isSelected = selectedId === node.id
            const isHovered = hoveredId === node.id
            const [cr, cg, cb] = TERRITORY_COLORS[i % TERRITORY_COLORS.length]

            const label = territories.nodeLabels.get(node.id)
            const lx = label ? label.x - ox : node.x
            const ly = label ? label.y - oy : node.y
            const baseSize = label?.fontSize || 14
            const fontSize = isSelected ? baseSize + 2 : isHovered ? baseSize + 1 : baseSize

            const labelColor = isSelected ? 'var(--accent-mint)'
              : isHovered ? `rgba(${cr},${cg},${cb},0.65)`
              : `rgba(${cr},${cg},${cb},0.28)`

            return (
              <g key={`gl-${node.id}`} style={{ cursor: 'pointer' }}
                onClick={() => setSelectedId(selectedId === node.id ? null : node.id)}
                onDoubleClick={() => drillDown(node)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}>
                <text x={lx} y={ly}
                  textAnchor="middle" alignmentBaseline="middle"
                  fill={labelColor} fontSize={fontSize} fontWeight={700}
                  fontFamily="var(--font-display)" letterSpacing="0.08em"
                  style={{ transition: 'all 200ms var(--ease)', pointerEvents: 'none', userSelect: 'none' }}>
                  {node.name}
                </text>
              </g>
            )
          })}

          {/* Overlay relations */}
          {visibleRelations.map((rel, i) => {
            const src = nodeMap.get(rel.sourceId); const tgt = nodeMap.get(rel.targetId)
            if (!src || !tgt) return null
            const isHighlighted = selectedId && (rel.sourceId === selectedId || rel.targetId === selectedId)
            const mx = (src.x + tgt.x) / 2; const my = (src.y + tgt.y) / 2
            const dx = tgt.x - src.x; const dy = tgt.y - src.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const cx = mx + (-dy / len) * 30; const cy = my + (dx / len) * 30
            return (
              <path key={`rel-${i}`} d={`M${src.x},${src.y} Q${cx},${cy} ${tgt.x},${tgt.y}`}
                fill="none"
                stroke={isHighlighted ? 'rgba(255,255,255,0.18)' : (RELATION_COLORS[rel.type] || 'rgba(255,255,255,0.06)')}
                strokeWidth={isHighlighted ? 1.5 : 0.8}
                strokeDasharray={rel.type === 'item' ? '3,3' : 'none'}
                style={{ pointerEvents: 'none' }} />
            )
          })}

          {/* Overlay nodes (faction/character/item_system) */}
          {visibleOverlayNodes.map((node) => {
            const vis = ENGINE_VISUAL[node.type]
            if (!vis?.showOnMap) return null
            const isSelected = selectedId === node.id
            const isRelated = relatedIds.has(node.id)
            const r = isSelected ? vis.size + 4 : vis.size

            return (
              <g key={node.id} style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(node.id) }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}>
                {(isSelected || isRelated) && (
                  <circle cx={node.x} cy={node.y} r={r + 7} fill="none"
                    stroke={vis.color} strokeWidth="1.5" opacity={isSelected ? 0.3 : 0.12} />
                )}
                {node.type === 'faction' ? (
                  <polygon points={`${node.x},${node.y - r} ${node.x + r * 0.85},${node.y + r * 0.4} ${node.x - r * 0.85},${node.y + r * 0.4}`}
                    fill={vis.bg} stroke={isSelected ? vis.color : 'rgba(255,255,255,0.08)'}
                    strokeWidth={isSelected ? 2 : 1} />
                ) : node.type === 'item_system' ? (
                  <rect x={node.x - r * 0.7} y={node.y - r * 0.7} width={r * 1.4} height={r * 1.4} rx={2}
                    fill={vis.bg} stroke={isSelected ? vis.color : 'rgba(255,255,255,0.08)'}
                    strokeWidth={isSelected ? 2 : 1} />
                ) : (
                  <circle cx={node.x} cy={node.y} r={r}
                    fill={vis.bg} stroke={isSelected ? vis.color : 'rgba(255,255,255,0.08)'}
                    strokeWidth={isSelected ? 2 : 1} />
                )}
                <text x={node.x} y={node.y + r + 10} textAnchor="middle"
                  fill={isSelected ? 'var(--text-primary)' : 'rgba(255,255,255,0.4)'}
                  fontSize={isSelected ? 10 : 8} fontWeight={isSelected ? 600 : 400}
                  fontFamily="var(--font-ui)">
                  {node.name.length > 5 ? node.name.substring(0, 4) + '…' : node.name}
                </text>
              </g>
            )
          })}

          </g>{/* end inner centering group */}

          </g>{/* end zoom/pan transform */}

        </svg>

        {/* Empty state — outside SVG so div rendering works */}
        {visibleGeoNodes.length === 0 && visibleOverlayNodes.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(8,8,18,0.85)', backdropFilter: 'blur(4px)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <MapPin size={28} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                {currentParent
                  ? `「${currentParent.name}」内部暂无细化区域`
                  : '暂无顶层地理数据'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                {currentParent
                  ? '审批通过此区域的细化提案后，子区域会显示在这里。'
                  : '请先在 MOU 中审批地理引擎的提案以生成顶层空间数据。'}
              </p>
              {navigationPath.length > 0 && (
                <button onClick={() => {
                  const newPath = navigationPath.slice(0, -1)
                  setNavigationPath(newPath)
                  setSelectedId(null); setZoom(1); setPan({ x: 0, y: 0 })
                }} style={{
                  padding: '7px 16px', borderRadius: 8,
                  background: 'rgba(196,181,253,0.12)', border: '1px solid rgba(196,181,253,0.20)',
                  color: 'var(--accent-violet)', fontSize: 12, cursor: 'pointer',
                }}>
                  ← 返回上一层
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ Floating controls ═══ */}

        {/* ── 层级面包屑 — top-left ── */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={navigateToRoot} style={{
            padding: '3px 8px', borderRadius: 4, border: 'none',
            background: navigationPath.length === 0 ? 'rgba(196,181,253,0.16)' : 'rgba(0,0,0,0.45)',
            color: navigationPath.length === 0 ? 'var(--accent-violet)' : 'var(--text-muted)',
            fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            fontWeight: navigationPath.length === 0 ? 600 : 400,
            backdropFilter: 'blur(8px)',
          }}>
            全部
          </button>
          {navigationPath.map((node, i) => (
            <span key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>›</span>
              <button onClick={() => navigateToLevel(i)} style={{
                padding: '3px 8px', borderRadius: 4, border: 'none',
                background: i === navigationPath.length - 1 ? 'rgba(196,181,253,0.16)' : 'rgba(0,0,0,0.45)',
                color: i === navigationPath.length - 1 ? 'var(--accent-violet)' : 'var(--text-muted)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                fontWeight: i === navigationPath.length - 1 ? 600 : 400,
                backdropFilter: 'blur(8px)',
                maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {node.name}
              </button>
            </span>
          ))}
        </div>

        {/* Indicator — bottom-left */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          padding: '4px 10px', borderRadius: 4,
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        }}>
          {currentParent ? `${currentParent.name} 内部` : '顶层空间'} · {visibleGeoNodes.length}地点 · {visibleOverlayNodes.filter((n) => n.type === 'faction').length}势力 · {visibleOverlayNodes.filter((n) => n.type === 'character').length}角色 · {visibleOverlayNodes.filter((n) => n.type === 'item_system').length}物品 · {Math.round(zoom * 100)}%
        </div>

        {/* Floating detail card (for geography nodes — same as GeographyView) */}
        {selectedNode && 'subtype' in selectedNode && !('type' in selectedNode) && (
          <div style={{
            position: 'absolute', top: 48, right: 12, width: 240, maxHeight: 'calc(100% - 96px)',
            padding: 14, borderRadius: 10, overflowY: 'auto', zIndex: 5,
            background: 'rgba(16,16,28,0.94)', border: '1px solid var(--glass-border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>详情</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(134,239,172,0.15)', color: 'var(--accent-mint)',
                }}>
                  {SUBTYPE_LABELS[selectedNode.subtype] || selectedNode.subtype} · {SCALE_LABELS[selectedNode.scale]}
                </span>
                <button onClick={() => setSelectedId(null)} style={{
                  width: 22, height: 22, borderRadius: 4, border: '1px solid var(--glass-border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}><X size={12} /></button>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedNode.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{selectedNode.summary}</div>
            {formatContent(selectedNode.content).map((f, i) => (
              <div key={i} style={{ fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)' }}>{f.label}: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

const floatBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 6,
  background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--text-secondary)', cursor: 'pointer',
  backdropFilter: 'blur(8px)',
}
