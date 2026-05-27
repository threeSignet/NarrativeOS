// ═══════════════════════════════════════════════════
// 共享领地引擎 — GeographyView 和 WorldView 共用
// 基于 Voronoi 图划分网格领土，计算填充路径、边界和标签位置
// ═══════════════════════════════════════════════════

export interface TerritoryResult {
  fills: Map<string, string>
  borderPath: string
  nodeLabels: Map<string, { x: number; y: number; fontSize: number }>
}

/**
 * 根据节点位置计算 Voronoi 领地划分
 *
 * 算法流程：
 * 1. 将画布划分为 gridSize x gridSize 的网格，每个网格单元分配到最近的节点（Voronoi 分配）
 * 2. 为每个节点的领土生成 SVG 水平条带路径（strip merging），用于填充渲染
 * 3. 为每个节点计算最佳标签位置：在领土内找到最靠近节点中心的水平区间作为标签锚点
 * 4. 计算领土间边界（去重，排除地图边缘）
 *
 * @param nodes - 节点数组，含 id、name、坐标
 * @param width - 画布宽度
 * @param height - 画布高度
 * @param gridSize - 网格密度，默认 70（值越大精度越高，但计算量平方增长）
 * @returns 领土填充路径映射、边界 SVG 路径、节点标签位置/字号映射
 */
export function computeTerritories(
  nodes: { id: string; name: string; x: number; y: number }[],
  width: number,
  height: number,
  gridSize: number = 70,
): TerritoryResult {
  const rows = gridSize
  const cols = gridSize
  const cellW = width / cols
  const cellH = height / rows

  if (nodes.length === 0) return { fills: new Map(), borderPath: '', nodeLabels: new Map() }

  // 1. 构建 Voronoi 分配网格 — 每个网格单元归属到距离最近的节点
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW
      const cy = (r + 0.5) * cellH
      let minD = Infinity
      let best = -1
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - cx
        const dy = nodes[i].y - cy
        const d = dx * dx + dy * dy
        if (d < minD) { minD = d; best = i }
      }
      grid[r][c] = best
    }
  }

  // 2. 为每个节点生成领土填充路径 — 水平条带合并，用 SVG 路径描述，避免 DOM 节点过多
  const fills = new Map<string, string>()
  for (let ni = 0; ni < nodes.length; ni++) {
    const strips: string[] = []
    for (let r = 0; r < rows; r++) {
      let c = 0
      while (c < cols) {
        if (grid[r][c] === ni) {
          let end = c + 1
          while (end < cols && grid[r][end] === ni) end++
          const x = c * cellW
          const w = (end - c) * cellW
          const y = r * cellH
          strips.push(`M${x.toFixed(1)},${y.toFixed(1)}h${w.toFixed(1)}v${cellH.toFixed(1)}h${-w.toFixed(1)}Z`)
          c = end
        } else {
          c++
        }
      }
    }
    if (strips.length > 0) fills.set(nodes[ni].id, strips.join(''))
  }

  // 3. 为每个节点计算最佳标签位置 — 在领土内找到最长且最靠近节点中心的行区间
  const nodeLabels = new Map<string, { x: number; y: number; fontSize: number }>()

  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni]

    // 节点在网格中的参考行（限制在网格范围内）
    const nodeGridRow = Math.min(rows - 1, Math.max(0, Math.floor(node.y / cellH)))

    // 收集该节点领土内所有连续的水平区间
    type Span = { r: number; left: number; right: number; len: number }
    const spans: Span[] = []

    for (let r = 0; r < rows; r++) {
      let c = 0
      while (c < cols) {
        if (grid[r][c] === ni) {
          let end = c + 1
          while (end < cols && grid[r][end] === ni) end++
          spans.push({ r, left: c, right: end - 1, len: end - c })
          c = end
        } else {
          c++
        }
      }
    }

    if (spans.length === 0) {
      // 极窄领土（如单单元格）— 退化到节点坐标
      nodeLabels.set(node.id, { x: node.x, y: node.y, fontSize: 14 })
      continue
    }

    // 评分：区间越长越好，距离节点行越近越好
    // score = len^1.5 / (1 + dist) — 长度权重占主导，4×长度的区间可偏移约 7 行仍胜出
    let best = spans[0]
    let bestScore = -Infinity
    for (const span of spans) {
      const dist = Math.abs(span.r - nodeGridRow)
      const score = Math.pow(span.len, 1.5) / (1 + dist)
      if (score > bestScore) {
        bestScore = score
        best = span
      }
    }

    // 最佳区间的中心点
    const lx = (best.left + best.right + 1) / 2 * cellW
    const ly = best.r * cellH + cellH / 2

    // 根据区间宽度和领土高度动态计算字号
    const spanPx = best.len * cellW
    // 区间两侧各留 1 个单元格的内边距（随网格密度缩放）
    const pad = cellW * 1.0
    const availW = Math.max(spanPx - pad * 2, 12)

    // CJK 字符 vs ASCII 字符的字宽加权估算
    const name = node.name
    let weightedLen = 0
    for (const ch of name) {
      const cp = ch.codePointAt(0) ?? 0
      // CJK 统一表意文字、片假名、平假名、韩文、全角标点 — 宽度系数 0.92
      // ASCII/拉丁字符 — 宽度系数 0.55
      weightedLen += (cp > 0x2E80) ? 0.92 : 0.55
    }
    const effectiveLen = Math.max(weightedLen, 1)

    // 垂直方向约束：计算领土跨越的行范围
    let minR2 = rows, maxR2 = -1
    for (const sp of spans) {
      if (sp.r < minR2) minR2 = sp.r
      if (sp.r > maxR2) maxR2 = sp.r
    }
    const vertPx = (maxR2 - minR2 + 1) * cellH
    const maxByHeight = vertPx * 0.48

    // 综合考虑：水平宽度、垂直高度，限制在 [10, 28] 范围内
    const fontSize = Math.max(10, Math.min(28, availW / effectiveLen, maxByHeight))

    nodeLabels.set(node.id, { x: lx, y: ly, fontSize })
  }

  // 4. 领土间边界生成 — 相邻但归属不同的网格单元之间画分割线（去重，不含地图边缘）
  const edgeSet = new Set<string>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ni = grid[r][c]
      if (c < cols - 1 && grid[r][c + 1] !== ni) {
        edgeSet.add(`v,${c + 1},${r}`)
      }
      if (r < rows - 1 && grid[r + 1][c] !== ni) {
        edgeSet.add(`h,${r + 1},${c}`)
      }
    }
  }

  const segs: string[] = []
  for (const key of edgeSet) {
    const [dir, p1, p2] = key.split(',')
    const a = parseInt(p1); const b = parseInt(p2)
    if (dir === 'v') {
      // 垂直边：按列划分
      segs.push(`M${(a * cellW).toFixed(1)},${(b * cellH).toFixed(1)}L${(a * cellW).toFixed(1)},${((b + 1) * cellH).toFixed(1)}`)
    } else {
      // 水平边：按行划分
      segs.push(`M${(b * cellW).toFixed(1)},${(a * cellH).toFixed(1)}L${((b + 1) * cellW).toFixed(1)},${(a * cellH).toFixed(1)}`)
    }
  }

  return { fills, borderPath: segs.join(''), nodeLabels }
}
