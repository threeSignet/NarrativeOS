import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { SettingItem } from '../../stores/hatch'
import { typeColors, typeLabels } from '../../utils/entityConfig'

// 实体类型 → CSS 类名映射（与 demo.html .e-char/.e-loc 等一致）
const ENTITY_CLASSES: Record<string, string> = {
  character: 'e-char',
  protagonist: 'e-char',
  location: 'e-loc',
  region: 'e-loc',
  landmark: 'e-loc',
  geography: 'e-loc',
  faction: 'e-faction',
  faction_layout: 'e-faction',
  faction_member: 'e-faction',
  item_system: 'e-item',
  artifact: 'e-item',
  common_item: 'e-item',
  power_system: 'e-tech',
  realm: 'e-tech',
  rule: 'e-tech',
  foreshadowing: 'e-foreshadow',
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildEntityPatterns(entities: SettingItem[]): Array<{ entity: SettingItem; regex: RegExp }> {
  const patterns: Array<{ entity: SettingItem; regex: RegExp }> = []
  const seen = new Set<string>()

  for (const entity of entities) {
    if (!entity.name || entity.name.length < 1) continue
    const key = `${entity.name}:${entity.type}`
    if (seen.has(key)) continue
    seen.add(key)

    patterns.push({
      entity,
      regex: new RegExp(`「?${escapeRegex(entity.name)}」?`, 'g'),
    })
  }

  // 按名称长度降序，优先匹配更长名称
  patterns.sort((a, b) => b.entity.name.length - a.entity.name.length)
  return patterns
}

// 共享的 entities 引用，由外部通过 configure 更新
let sharedEntities: SettingItem[] = []

export function updateEntityHighlightEntities(entities: SettingItem[]) {
  sharedEntities = entities
}

export interface EntityHighlightOptions {
  entities: SettingItem[]
}

export const EntityHighlight = Extension.create<EntityHighlightOptions>({
  name: 'entityHighlight',

  addOptions() {
    return {
      entities: [],
    }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('entityHighlight')

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, { doc }) {
            return DecorationSet.empty
          },
          apply(tr, oldSet) {
            if (!tr.docChanged) return oldSet
            return buildDecorations(tr.doc, sharedEntities)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
          handleClickOn(view, pos, node, nodePos, event) {
            const target = event.target as HTMLElement
            const entityEl = target.closest('[data-entity-id]') as HTMLElement | null
            if (entityEl?.dataset.entityId) {
              // 发出自定义事件到编辑器 DOM
              view.dom.dispatchEvent(new CustomEvent('entity-click', {
                detail: { entityId: entityEl.dataset.entityId },
                bubbles: true,
              }))
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})

function buildDecorations(doc: any, entities: SettingItem[]): DecorationSet {
  if (!entities || !entities.length) return DecorationSet.empty

  const decorations: Decoration[] = []
  const patterns = buildEntityPatterns(entities)
  const fullText = doc.textContent
  const covered = new Set<number>()

  for (const { entity, regex } of patterns) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(fullText)) !== null) {
      const from = match.index
      const to = from + match[0].length

      // 检查是否已被更长的实体名称覆盖
      let overlap = false
      for (let i = from; i < to; i++) {
        if (covered.has(i)) { overlap = true; break }
      }
      if (overlap) continue

      for (let i = from; i < to; i++) covered.add(i)

      const cssClass = ENTITY_CLASSES[entity.type] || 'e-char'
      const color = typeColors[entity.type] || '#7dd3fc'
      const label = typeLabels[entity.type] || entity.type

      decorations.push(
        Decoration.inline(from, to, {
          class: cssClass,
          style: `background:${color}18;border-bottom:1px solid ${color}35;padding:0 2px;border-radius:2px;cursor:pointer;transition:background 150ms`,
          'data-entity-id': entity.id,
          'data-entity-type': entity.type,
          'data-entity-name': entity.name,
          'data-entity-label': label,
          'data-entity-color': color,
          title: `${label}：${entity.name} — ${entity.summary || '暂无简介'}`,
        })
      )
    }
  }

  return DecorationSet.create(doc, decorations)
}
