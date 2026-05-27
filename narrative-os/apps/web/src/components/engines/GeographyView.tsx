import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Plus, MapPin, Mountain, Building2, X, Loader2 } from 'lucide-react'
import type { SettingItem } from '../../stores/hatch'
import { apiPost } from '../../api/client'
import Dropdown from '../ui/Dropdown'
import { SUBTYPE_LABELS, CONTENT_LABELS, SCALE_ORDER, SCALE_LABELS, formatContent } from '../../utils/labels'
import type { MapScale } from '../../utils/labels'
import { computeTerritories, type TerritoryResult } from '../../utils/territories'

// ── Territory map palette ──
const SUBTYPE_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode; size: number }> = {
  region: { color: 'var(--accent-violet)', bg: 'rgba(196,181,253,0.15)', icon: <MapPin size={10} />, size: 18 },
  location: { color: 'var(--accent-ice)', bg: 'rgba(125,211,252,0.15)', icon: <Building2 size={10} />, size: 14 },
  landmark: { color: 'var(--accent-gold)', bg: 'rgba(201,165,92,0.15)', icon: <Mountain size={10} />, size: 11 },
  parent: { color: 'var(--accent-violet)', bg: 'rgba(196,181,253,0.15)', icon: <MapPin size={10} />, size: 18 },
}

const TERRITORY_COLORS: [number, number, number][] = [
  [95, 135, 175],   // steel blue
  [145, 165, 105],  // olive
  [185, 145, 105],  // tan
  [165, 125, 155],  // mauve
  [115, 155, 165],  // teal
  [175, 155, 125],  // warm sand
  [135, 130, 175],  // twilight
  [155, 165, 145],  // sage
]

interface GeoNode {
  id: string
  name: string
  subtype: string
  scale: MapScale
  parentId: string | null
  x: number
  y: number
  summary: string
  content: Record<string, any>
}

function hashPosition(seed: string): { x: number; y: number } {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return {
    x: 120 + Math.abs(h % 760),
    y: 120 + Math.abs(((h >> 9) ^ (h * 31)) % 760),
  }
}

function buildNodes(items: SettingItem[]): GeoNode[] {
  return items
    .filter((i) => i.type === 'geography' && i.status === 'confirmed')
    .map((item) => {
      const c = (item.content || {}) as Record<string, any>
      const fallback = hashPosition(item.id)
      return {
        id: item.id,
        name: item.name,
        subtype: item.itemSubtype || 'location',
        scale: (c.scale as MapScale) || inferScaleFromContext(c),
        parentId: item.parentItemId || null,
        x: c.coordinates?.x ?? fallback.x,
        y: c.coordinates?.y ?? fallback.y,
        summary: item.summary || '',
        content: c,
      }
    })
}

function inferScaleFromContext(content: Record<string, any>): MapScale {
  if (content.climate || content.terrain) return 'region'
  if (content.type === '星球' || content.type === '大陆') return 'planet'
  return 'city'
}

function getNodesAtScale(nodes: GeoNode[], scale: MapScale): GeoNode[] {
  return nodes.filter((n) => n.scale === scale)
}

// ── 层级导航树 ──

/** 构建 parentId → children[] 的层级树 */
function buildTree(nodes: GeoNode[]): Map<string | null, GeoNode[]> {
  const tree = new Map<string | null, GeoNode[]>()
  for (const node of nodes) {
    const pid = node.parentId
    if (!tree.has(pid)) tree.set(pid, [])
    tree.get(pid)!.push(node)
  }
  return tree
}

/** 从节点列表中按 ID 查找 */
function findNodeById(nodes: GeoNode[], id: string): GeoNode | undefined {
  return nodes.find((n) => n.id === id)
}

/** 获取节点的完整祖先链（用于面包屑） */
function getAncestors(nodes: GeoNode[], nodeId: string): GeoNode[] {
  const ancestors: GeoNode[] = []
  let current = findNodeById(nodes, nodeId)
  while (current) {
    ancestors.unshift(current)
    current = current.parentId ? findNodeById(nodes, current.parentId) : undefined
  }
  return ancestors
}

/** 从 navigationPath 获取当前面包屑展示路径 */
function getBreadcrumbPath(navigationPath: GeoNode[]): GeoNode[] {
  // path 始终从根层开始：如果 navPath 不为空，直接用 navPath
  // 如果 navPath 为空（在根层），面包屑为空
  return navigationPath
}

// ── Floating button style ──
const floatBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 6,
  background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--text-secondary)', cursor: 'pointer',
  backdropFilter: 'blur(8px)',
}

// ── Component ──

export default function GeographyView({ settingItems, relations, projectId, onClose }: {
  settingItems: SettingItem[]
  relations: { sourceItemId: string; targetItemId: string; relationType: string; label: string | null }[]
  projectId: string
  onClose?: () => void
}) {
  const nodes = useMemo(() => buildNodes(settingItems), [settingItems])
  const tree = useMemo(() => buildTree(nodes), [nodes])

  // 层级导航栈：从根到当前父节点的路径
  const [navigationPath, setNavigationPath] = useState<GeoNode[]>([])
  const currentParentId = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1].id : null
  const currentParent = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : null

  // 可见节点 = 当前父节点的直接子节点（根层 = parentId 为 null 的节点）
  const visibleNodes = useMemo(
    () => tree.get(currentParentId) || [],
    [tree, currentParentId]
  )

  const [selectedNode, setSelectedNode] = useState<GeoNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', subtype: 'location',
    scale: currentParent?.scale || 'continent' as MapScale,
    description: ''
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [createResult, setCreateResult] = useState<string | null>(null)

  // 当前层级的尺度（用于显示标签和创建表单默认值）
  const currentScale = currentParent?.scale ||
    (visibleNodes.length > 0 ? visibleNodes[0].scale : 'continent' as MapScale)

  // 深入下一层（即使无子节点也进入，让空状态页面提示用户需要细化）
  const drillDown = useCallback((node: GeoNode) => {
    setNavigationPath([...navigationPath, node])
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [navigationPath])

  // 面包屑回退
  const navigateToLevel = useCallback((index: number) => {
    setNavigationPath(navigationPath.slice(0, index + 1))
    setSelectedNode(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [navigationPath])

  // 回退到根层
  const navigateToRoot = useCallback(() => {
    setNavigationPath([])
    setSelectedNode(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Zoom & pan
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
      setDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  // Dynamic viewBox: match container aspect ratio so map fills space without distortion
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [svgView, setSvgView] = useState({ w: 1000, h: 1000 })
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const cw = e.contentRect.width
      const ch = e.contentRect.height
      if (cw > 0 && ch > 0) {
        const aspect = cw / ch
        if (aspect >= 1) {
          setSvgView({ w: Math.round(1000 * aspect), h: 1000 })
        } else {
          setSvgView({ w: 1000, h: Math.round(1000 / aspect) })
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ox = (svgView.w - 1000) / 2
  const oy = (svgView.h - 1000) / 2

  const geoRelations = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map((n) => n.id))
    return relations.filter((r) => nodeIds.has(r.sourceItemId) && nodeIds.has(r.targetItemId))
  }, [relations, visibleNodes])

  const territories = useMemo(() => {
    const areaNodes = visibleNodes.map((n) => ({ id: n.id, name: n.name, x: n.x + ox, y: n.y + oy }))
    return computeTerritories(areaNodes, svgView.w, svgView.h)
  }, [visibleNodes, svgView, ox, oy])

  const nodeMap = useMemo(() => {
    const map = new Map<string, GeoNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  const availableScales = useMemo(() => {
    const used = new Set(nodes.map((n) => n.scale))
    return SCALE_ORDER.filter((s) => used.has(s))
  }, [nodes])

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.description.trim()) return
    setCreateLoading(true)
    setCreateResult(null)
    try {
      const res = await apiPost<any>(`/hatch/${projectId}/engine/geography/create-item`, {
        userInput: `新增${SUBTYPE_LABELS[createForm.subtype] || '地点'}「${createForm.name}」(${SCALE_LABELS[createForm.scale]})：${createForm.description}`,
      })
      if (res.success && res.proposalCount > 0) {
        setCreateResult(`提案已创建（${res.proposalCount} 个），请在 MOU 弹窗中审批。`)
        setShowCreate(false)
        setCreateForm({ name: '', subtype: 'location', scale: currentScale, description: '' })
      } else {
        setCreateResult('创建失败，请重试。')
      }
    } catch (err: any) {
      setCreateResult(`请求失败：${err.message}`)
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* SVG Map */}
      <div ref={mapContainerRef} style={{ flex: 1, position: 'relative', background: '#080810' }}>
        <svg ref={svgRef} viewBox={`0 0 ${svgView.w} ${svgView.h}`} preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          <defs>
            {/* Organic border filter */}
            <filter id="wavy" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
            </filter>

            {/* Canvas texture */}
            <filter id="tex">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="n" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.03 0" in="n" />
            </filter>
          </defs>

          {/* Background */}
          <rect width={svgView.w} height={svgView.h} fill="#080812" />
          <rect width={svgView.w} height={svgView.h} fill="#0c0c18" filter="url(#tex)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

          {/* Territory fills */}
          {visibleNodes.map((node, i) => {
            const fillD = territories.fills.get(node.id)
            if (!fillD) return null
            const isSel = selectedNode?.id === node.id
            const [cr, cg, cb] = TERRITORY_COLORS[i % TERRITORY_COLORS.length]
            return (
              <path key={`tf-${node.id}`} d={fillD}
                fill={`rgba(${cr},${cg},${cb},${isSel ? 0.38 : 0.20})`}
                stroke={isSel ? `rgba(${cr},${cg},${cb},0.55)` : 'none'}
                strokeWidth={isSel ? 1.5 : 0}
                style={{ cursor: 'pointer', transition: 'fill 200ms var(--ease)' }}
                onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                onDoubleClick={() => drillDown(node)}
              />
            )
          })}

          {/* Territory borders */}
          {territories.borderPath && (
            <path d={territories.borderPath}
              fill="none"
              stroke="rgba(255,255,255,0.14)" strokeWidth="1"
              filter="url(#wavy)"
              style={{ pointerEvents: 'none' }} />
          )}

          {/* Relations + Nodes — centered in viewBox */}
          <g transform={`translate(${ox}, ${oy})`}>
            {geoRelations.map((rel, i) => {
            const src = nodeMap.get(rel.sourceItemId)
            const tgt = nodeMap.get(rel.targetItemId)
            if (!src || !tgt) return null
            return (
              <g key={`rel-${i}`}>
                <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke="rgba(255,255,255,0.10)" strokeWidth="1.5"
                  strokeDasharray={rel.label === '相邻' ? '6,4' : 'none'}
                  strokeLinecap="round" />
                {rel.label && (
                  <text x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 7}
                    textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="9"
                    fontFamily="var(--font-ui)">
                    {rel.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Nodes — territory labels centered on longest horizontal line */}
          {visibleNodes.map((node, i) => {
            const style = SUBTYPE_STYLE[node.subtype] || SUBTYPE_STYLE.location
            const isSelected = selectedNode?.id === node.id
            const isHovered = hoveredNode === node.id
            const [cr, cg, cb] = TERRITORY_COLORS[i % TERRITORY_COLORS.length]

            const label = territories.nodeLabels.get(node.id)
            // label.x/y are global SVG coords (with ox/oy baked in),
            // subtract since we're inside translate(ox, oy)
            const lx = label ? label.x - ox : node.x
            const ly = label ? label.y - oy : node.y
            const baseSize = label?.fontSize || 14
            const fontSize = isSelected ? baseSize + 2 : isHovered ? baseSize + 1 : baseSize

            const labelColor = isSelected
              ? style.color
              : isHovered
                ? `rgba(${cr},${cg},${cb},0.65)`
                : `rgba(${cr},${cg},${cb},0.28)`

            return (
              <g key={node.id} style={{ cursor: 'pointer' }}
                onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                onDoubleClick={() => drillDown(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <text x={lx} y={ly}
                  textAnchor="middle" alignmentBaseline="middle"
                  fill={labelColor}
                  fontSize={fontSize}
                  fontWeight={700}
                  fontFamily="var(--font-display)"
                  letterSpacing="0.08em"
                  style={{
                    transition: 'all 200ms var(--ease)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}>
                  {node.name}
                </text>
              </g>
            )
          })}
          </g>

          </g>{/* end zoom/pan transform */}

        </svg>

        {/* ═══ Floating controls (inside canvas) ═══ */}

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

        {/* Add — top-right */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setShowCreate(true)} style={{
            ...floatBtn, gap: 4, width: 'auto', padding: '0 10px',
            background: 'rgba(196,181,253,0.12)', color: 'var(--accent-violet)',
            border: '1px solid rgba(196,181,253,0.18)',
            fontSize: 11, fontWeight: 500,
          }}>
            <Plus size={12} />
            新增地点
          </button>
        </div>

        {/* Indicator — bottom-left */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          padding: '4px 10px', borderRadius: 4,
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        }}>
          {currentParent ? `${currentParent.name} 内部` : '顶层空间'} · {visibleNodes.length}地点 · {Math.round(zoom * 100)}%
        </div>

        {/* Empty state */}
        {visibleNodes.length === 0 && (
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
                  setNavigationPath(navigationPath.slice(0, -1))
                  setSelectedNode(null); setZoom(1); setPan({ x: 0, y: 0 })
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

        {/* Create form overlay */}
        {showCreate && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            zIndex: 10,
          }}>
            <div style={{
              width: 380, padding: 24, borderRadius: 12,
              background: 'rgba(16,16,28,0.95)', border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>新增地点</span>
                <button onClick={() => setShowCreate(false)} style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--glass-border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={formLabel}>名称</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="例如：青云山、黑曜城..."
                    style={formInput} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={formLabel}>类型</label>
                    <Dropdown
                      options={subtypeOptions}
                      value={createForm.subtype}
                      placeholder="选择类型"
                      nullable={false}
                      onChange={(v) => { if (v) setCreateForm({ ...createForm, subtype: v }) }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={formLabel}>尺度</label>
                    <Dropdown
                      options={scaleOptions}
                      value={createForm.scale}
                      placeholder="选择尺度"
                      nullable={false}
                      onChange={(v) => { if (v) setCreateForm({ ...createForm, scale: v as MapScale }) }}
                    />
                  </div>
                </div>

                <div>
                  <label style={formLabel}>描述想法</label>
                  <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="描述你想要的这个地点的特征、氛围、在故事中的作用..."
                    rows={4}
                    style={{ ...formInput, resize: 'vertical', minHeight: 80, fontFamily: 'var(--font-ui)' }} />
                </div>

                {createResult && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 12,
                    background: createResult.includes('失败') ? 'rgba(252,165,165,0.06)' : 'rgba(134,239,172,0.06)',
                    color: createResult.includes('失败') ? 'var(--accent-rose)' : 'var(--accent-mint)',
                    border: `1px solid ${createResult.includes('失败') ? 'rgba(252,165,165,0.12)' : 'rgba(134,239,172,0.12)'}`,
                  }}>
                    {createResult}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button onClick={() => setShowCreate(false)} style={cancelBtn}>取消</button>
                  <button onClick={handleCreate} disabled={createLoading || !createForm.name.trim() || !createForm.description.trim()}
                    style={{
                      ...submitBtn,
                      opacity: createLoading || !createForm.name.trim() || !createForm.description.trim() ? 0.5 : 1,
                    }}>
                    {createLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {createLoading ? '提交中...' : '提交提案'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating detail card */}
        {selectedNode && (
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
                  background: (SUBTYPE_STYLE[selectedNode.subtype] || SUBTYPE_STYLE.location).bg,
                  color: (SUBTYPE_STYLE[selectedNode.subtype] || SUBTYPE_STYLE.location).color,
                }}>
                  {SUBTYPE_LABELS[selectedNode.subtype] || selectedNode.subtype} · {SCALE_LABELS[selectedNode.scale]}
                </span>
                <button onClick={() => setSelectedNode(null)} style={{
                  width: 22, height: 22, borderRadius: 4, border: '1px solid var(--glass-border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <X size={12} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedNode.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{selectedNode.summary}</div>
            <button onClick={() => drillDown(selectedNode)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', marginBottom: 8, borderRadius: 6,
                background: 'rgba(196,181,253,0.10)', border: '1px solid rgba(196,181,253,0.18)',
                color: 'var(--accent-violet)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}>
                进入内部 ▸
              </button>
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

function detectBestScale(nodes: GeoNode[]): MapScale {
  for (const s of SCALE_ORDER) {
    if (nodes.some((n) => n.scale === s)) return s
  }
  return 'region'
}

const subtypeOptions = [
  { value: 'region', label: SUBTYPE_LABELS.region },
  { value: 'location', label: SUBTYPE_LABELS.location },
  { value: 'landmark', label: SUBTYPE_LABELS.landmark },
  { value: 'parent', label: SUBTYPE_LABELS.parent },
]

const scaleOptions = SCALE_ORDER.map((s) => ({ value: s, label: SCALE_LABELS[s] }))

const formLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4, display: 'block',
}

const formInput: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const cancelBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--glass-border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: 13,
  cursor: 'pointer', fontFamily: 'var(--font-ui)',
}

const submitBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: 'rgba(196,181,253,0.15)', color: 'var(--accent-violet)',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
}
