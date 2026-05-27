import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import type { SettingItem } from '../../stores/hatch'

interface GraphNode {
  id: string; name: string; type: string; subtype: string
  x: number; y: number; fx: number; fy: number
  importance: number; isExternal: boolean
}

interface GraphEdge {
  source: string; target: string; label: string; type: string
}

const EDGE_TYPES: Record<string, { color: string; dash: string; label: string }> = {
  faction: { color: 'rgba(255,160,80,0.35)', dash: '6,3', label: '同势力' },
  ally: { color: 'rgba(134,239,172,0.35)', dash: 'none', label: '盟友' },
  rival: { color: 'rgba(252,165,165,0.35)', dash: '4,2', label: '对手' },
  mentor: { color: 'rgba(196,181,253,0.35)', dash: 'none', label: '师徒' },
  family: { color: 'rgba(253,230,138,0.35)', dash: 'none', label: '亲属' },
  lover: { color: 'rgba(252,165,165,0.4)', dash: '2,2', label: '恋情' },
  neutral: { color: 'rgba(255,255,255,0.12)', dash: 'none', label: '关联' },
  external: { color: 'rgba(255,255,255,0.1)', dash: '3,3', label: '关联' },
}

const EXTERNAL_STYLES: Record<string, { color: string; bg: string }> = {
  faction: { color: 'var(--accent-orange)', bg: 'rgba(255,160,80,0.1)' },
  geography: { color: 'var(--accent-mint)', bg: 'rgba(134,239,172,0.1)' },
  item_system: { color: 'var(--accent-gold)', bg: 'rgba(201,165,92,0.1)' },
}

const SUBTYPE_COLORS: Record<string, string> = {
  protagonist: 'var(--accent-ice)', character: 'rgba(125,211,252,0.65)',
}

// ── Fuzzy name match ──
function matchName(fieldValue: string, candidates: SettingItem[]): SettingItem | undefined {
  if (!fieldValue) return undefined
  // Exact match
  let found = candidates.find((i) => i.name === fieldValue)
  if (found) return found
  // Contains match (either direction)
  found = candidates.find((i) => i.name.includes(fieldValue) || fieldValue.includes(i.name))
  if (found) return found
  // Substring match (remove parenthetical parts)
  const clean = fieldValue.replace(/[（(].+[）)]/g, '').trim()
  if (clean && clean !== fieldValue) {
    found = candidates.find((i) => i.name.includes(clean) || clean.includes(i.name))
    if (found) return found
  }
  return undefined
}

function buildBaseGraph(items: SettingItem[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const confirmed = items.filter((i) => i.status === 'confirmed' && i.type === 'character')
  const nodes: GraphNode[] = confirmed.map((item, idx) => {
    const angle = (idx / Math.max(confirmed.length, 1)) * Math.PI * 2
    const r = 240 + (Math.random() - 0.5) * 40
    return {
      id: item.id, name: item.name, type: 'character',
      subtype: item.itemSubtype || 'character',
      x: 500 + Math.cos(angle) * r, y: 500 + Math.sin(angle) * r,
      fx: 0, fy: 0,
      importance: item.itemSubtype === 'protagonist' ? 22 : 16,
      isExternal: false,
    }
  })

  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (const item of confirmed) {
    const c = (item.content || {}) as Record<string, any>
    if (c.faction) {
      const others = confirmed.filter((o) => o.id !== item.id)
      for (const other of others) {
        const oc = (other.content || {}) as Record<string, any>
        if (oc.faction === c.faction) {
          const key = [item.id, other.id].sort().join('--')
          if (!seen.has(key)) {
            seen.add(key)
            edges.push({ source: item.id, target: other.id, label: c.faction, type: 'faction' })
          }
        }
      }
    }
    if (c.relationship_to_mc && item.itemSubtype !== 'protagonist') {
      const mc = nodes.find((n) => n.subtype === 'protagonist')
      if (mc && mc.id !== item.id) {
        const key = [item.id, mc.id].sort().join('--')
        if (!seen.has(key)) {
          seen.add(key)
          edges.push({ source: item.id, target: mc.id, label: c.relationship_to_mc, type: inferRelType(c.relationship_to_mc) })
        }
      }
    }
  }
  return { nodes, edges }
}

function inferRelType(rel: string): string {
  const r = rel.toLowerCase()
  if (r.includes('敌') || r.includes('对手') || r.includes('仇')) return 'rival'
  if (r.includes('师') || r.includes('徒') || r.includes('导')) return 'mentor'
  if (r.includes('亲') || r.includes('兄') || r.includes('姐') || r.includes('父') || r.includes('母')) return 'family'
  if (r.includes('恋') || r.includes('爱') || r.includes('情')) return 'lover'
  if (r.includes('友') || r.includes('盟') || r.includes('伴') || r.includes('同')) return 'ally'
  return 'neutral'
}

function simulate(nodes: GraphNode[], edges: GraphEdge[], iterations: number) {
  const rep = 5000; const att = 0.01; const damp = 0.5
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x; let dy = nodes[i].y - nodes[j].y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.5)
        const force = rep / (dist * dist)
        nodes[i].fx += (dx / dist) * force; nodes[i].fy += (dy / dist) * force
        nodes[j].fx -= (dx / dist) * force; nodes[j].fy -= (dy / dist) * force
      }
    }
    for (const edge of edges) {
      const src = nodes.find((n) => n.id === edge.source)
      const tgt = nodes.find((n) => n.id === edge.target)
      if (!src || !tgt) continue
      const dx = tgt.x - src.x; const dy = tgt.y - src.y
      src.fx += dx * att; src.fy += dy * att
      tgt.fx -= dx * att; tgt.fy -= dy * att
    }
    for (const node of nodes) {
      node.fx += (500 - node.x) * 0.001; node.fy += (500 - node.y) * 0.001
      node.fx *= damp; node.fy *= damp
      node.x += node.fx; node.y += node.fy
      node.fx = 0; node.fy = 0
      node.x = Math.max(30, Math.min(970, node.x))
      node.y = Math.max(30, Math.min(970, node.y))
    }
  }
}

export default function CharacterGraphView({ characterItems, allItems, selectedId, onSelect }: {
  characterItems: SettingItem[]
  allItems: SettingItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const baseGraph = useMemo(() => buildBaseGraph(characterItems), [characterItems])
  const settledRef = useRef(false)

  // Run simulation once and save positions
  useEffect(() => {
    if (!settledRef.current && baseGraph.nodes.length > 0) {
      simulate(baseGraph.nodes, baseGraph.edges, 120)
      settledRef.current = true
    }
  }, [baseGraph])

  // Build full graph: base characters + optional external nodes
  const { nodes, edges } = useMemo(() => {
    const allNodes = baseGraph.nodes.map((n) => ({ ...n }))
    const allEdges = [...baseGraph.edges]

    if (selectedId) {
      const selected = allNodes.find((n) => n.id === selectedId)
      if (selected) {
        const sc = (characterItems.find((ci) => ci.id === selectedId)?.content || {}) as Record<string, any>

        // Find external faction
        if (sc.faction) {
          const factionItem = matchName(sc.faction, allItems.filter((i) => i.type === 'faction' && i.status === 'confirmed'))
          if (factionItem && !allNodes.find((n) => n.id === factionItem.id)) {
            allNodes.push({
              id: factionItem.id, name: factionItem.name, type: 'faction',
              subtype: factionItem.itemSubtype || 'faction',
              x: selected.x + 140, y: selected.y - 80, fx: 0, fy: 0,
              importance: 15, isExternal: true,
            })
            allEdges.push({ source: selected.id, target: factionItem.id, label: '所属势力', type: 'external' })
          }
        }

        // Find external location
        if (sc.location) {
          const locItem = matchName(sc.location, allItems.filter((i) => i.type === 'geography' && i.status === 'confirmed'))
          if (locItem && !allNodes.find((n) => n.id === locItem.id)) {
            allNodes.push({
              id: locItem.id, name: locItem.name, type: 'geography',
              subtype: locItem.itemSubtype || 'location',
              x: selected.x - 140, y: selected.y - 80, fx: 0, fy: 0,
              importance: 15, isExternal: true,
            })
            allEdges.push({ source: selected.id, target: locItem.id, label: '所在位置', type: 'external' })
          }
        }

        // Find external items
        const ownedItems = allItems.filter((i) => {
          if (i.type !== 'item_system' || i.status !== 'confirmed') return false
          const c = (i.content || {}) as Record<string, any>
          return c.current_owner && (c.current_owner === selected.name || c.current_owner.includes(selected.name) || selected.name.includes(c.current_owner))
        })
        ownedItems.slice(0, 4).forEach((oi, idx) => {
          if (!allNodes.find((n) => n.id === oi.id)) {
            allNodes.push({
              id: oi.id, name: oi.name, type: 'item_system',
              subtype: oi.itemSubtype || 'artifact',
              x: selected.x + (idx - 1.5) * 70, y: selected.y + 110, fx: 0, fy: 0,
              importance: 12, isExternal: true,
            })
            allEdges.push({ source: selected.id, target: oi.id, label: '持有', type: 'external' })
          }
        })
      }
    }

    return { nodes: allNodes, edges: allEdges }
  }, [baseGraph, selectedId, characterItems, allItems])

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(3, Math.max(0.2, zoom * delta))
    const scaleChange = newZoom / zoom
    setPan({ x: mx - (mx - pan.x) * scaleChange, y: my - (my - pan.y) * scaleChange })
    setZoom(newZoom)
  }, [zoom, pan])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as SVGElement
    if (target === svgRef.current || target.tagName === 'rect') {
      setDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <svg ref={svgRef} viewBox="0 0 1000 1000"
      style={{ width: '100%', height: '100%', cursor: dragging ? 'grabbing' : 'grab' }}
      onWheel={handleWheel} onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <defs>
        <pattern id="grid-cg" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.012)" strokeWidth="0.5" />
        </pattern>
      </defs>

      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        <rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#grid-cg)" />

        {/* Edges */}
        {edges.map((edge, i) => {
          const src = nodes.find((n) => n.id === edge.source)
          const tgt = nodes.find((n) => n.id === edge.target)
          if (!src || !tgt) return null
          const cfg = EDGE_TYPES[edge.type] || EDGE_TYPES.neutral
          const isHighlighted = selectedId && (edge.source === selectedId || edge.target === selectedId)
          const isExt = edge.type === 'external'

          const mx = (src.x + tgt.x) / 2; const my = (src.y + tgt.y) / 2
          const dx = tgt.x - src.x; const dy = tgt.y - src.y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          const offset = isExt ? 50 : 30
          const cx = mx + (-dy / len) * offset; const cy = my + (dx / len) * offset
          const d = `M${src.x},${src.y} Q${cx},${cy} ${tgt.x},${tgt.y}`
          const lx = mx + (-dy / len) * offset * 0.45
          const ly = my + (dx / len) * offset * 0.45

          return (
            <g key={`e-${i}`}>
              <path d={d} fill="none" stroke={cfg.color}
                strokeWidth={isHighlighted ? 2 : (isExt ? 0.8 : 1)}
                strokeDasharray={cfg.dash}
                opacity={isExt ? 0.4 : (isHighlighted ? 1 : 0.5)}
              />
              <rect x={lx - 22} y={ly - 8} width={44} height={13} rx={3}
                fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              <text x={lx} y={ly + 1} textAnchor="middle"
                fill={isHighlighted ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)'}
                fontSize="7" fontFamily="var(--font-ui)">
                {edge.label.length > 5 ? edge.label.substring(0, 5) : edge.label}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedId === node.id
          const isExt = node.isExternal
          const extStyle = isExt ? EXTERNAL_STYLES[node.type] : null
          const color = extStyle ? extStyle.color : (SUBTYPE_COLORS[node.subtype] || 'rgba(255,255,255,0.5)')
          const bg = extStyle ? extStyle.bg : (isSelected ? 'rgba(125,211,252,0.18)' : 'rgba(125,211,252,0.07)')
          const r = isSelected ? node.importance + 4 : node.importance
          const opacity = isExt ? 0.55 : 1

          return (
            <g key={node.id} style={{ cursor: 'pointer', opacity }}
              onClick={(e) => { e.stopPropagation(); if (!isExt) onSelect(node.id) }}>
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={r + 10} fill="none"
                  stroke={color} strokeWidth="2" opacity={0.2} />
              )}
              {node.type === 'faction' ? (
                <polygon
                  points={`${node.x},${node.y - r} ${node.x + r * 0.8},${node.y + r * 0.4} ${node.x - r * 0.8},${node.y + r * 0.4}`}
                  fill={isSelected ? (extStyle?.bg || bg) : bg}
                  stroke={isSelected ? color : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
              ) : node.type === 'geography' ? (
                <rect x={node.x - r * 0.7} y={node.y - r * 0.7} width={r * 1.4} height={r * 1.4} rx={3}
                  fill={isSelected ? (extStyle?.bg || bg) : bg}
                  stroke={isSelected ? color : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
              ) : node.type === 'item_system' ? (
                <rect x={node.x - r * 0.6} y={node.y - r * 0.6} width={r * 1.2} height={r * 1.2} rx={2}
                  fill={isSelected ? (extStyle?.bg || bg) : bg}
                  stroke={isSelected ? color : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
              ) : (
                <circle cx={node.x} cy={node.y} r={r} fill={bg}
                  stroke={isSelected ? color : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isSelected ? 2 : 1} />
              )}
              <text x={node.x} y={node.y + r + 12} textAnchor="middle"
                fill={isSelected ? 'var(--text-primary)' : isExt ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.5)'}
                fontSize={isSelected ? 12 : 10} fontWeight={isSelected ? 600 : 400}
                fontFamily="var(--font-ui)">
                {node.name.length > 6 ? node.name.substring(0, 5) + '…' : node.name}
              </text>
            </g>
          )
        })}
      </g>

      {nodes.length === 0 && (
        <text x={500} y={500} textAnchor="middle" fill="var(--text-muted)" fontSize={14} fontFamily="var(--font-ui)">
          暂无角色数据
        </text>
      )}
    </svg>
    {/* Fixed bottom-left indicator */}
    <div style={{
      position: 'absolute', bottom: 10, left: 12,
      fontSize: 10, color: 'rgba(255,255,255,0.15)',
      fontFamily: 'var(--font-mono)', pointerEvents: 'none',
    }}>
      {Math.round(zoom * 100)}% · 滚轮缩放 · 拖拽平移
    </div>
    </div>
  )
}
