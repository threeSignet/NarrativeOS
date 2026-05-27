export const typeLabels: Record<string, string> = {
  world_rule: '世界规则',
  character: '角色',
  location: '地点',
  power_system: '力量体系',
  power_system_update: '力量体系修改',
  faction: '势力',
  faction_update: '势力修改',
  conflict: '核心矛盾',
  conflict_update: '矛盾修改',
  tone: '世界观基调',
  tone_update: '基调修改',
  plot_seed: '剧情种子',
  tone_setting: '基调设定',
  theme: '主题',
  outline: '大纲',
  volume_outline: '卷纲',
  chapter_outline: '章纲',
  content: '正文续写',
  polish: '润色',
  risk: '谏官风险',
  memory: '记忆更新',
  foreshadowing: '伏笔',
  logic_fix: '逻辑修正',
  rule: '规则修改',
  geography: '地理环境',
  character_system: '角色体系',
  item_system: '物品体系',
  story_blueprint: '故事蓝图',
  // Multi-item subtypes
  realm: '修炼境界',
  faction_layout: '势力格局',
  faction_member: '势力',
  region: '区域',
  landmark: '地标',
  artifact: '神器',
  common_item: '物品',
  protagonist: '主角',
  relationship: '角色关系',
  stake: '赌注',
  escalation: '升级节点',
}

export const typeColors: Record<string, string> = {
  world_rule: '#7dd3fc',
  character: '#86efac',
  location: '#fdba74',
  power_system: '#fda4af',
  power_system_update: '#fda4af',
  faction: '#c4b5fd',
  faction_update: '#c4b5fd',
  plot_seed: '#fcd34d',
  conflict: '#fcd34d',
  conflict_update: '#fcd34d',
  tone: '#c4b5fd',
  tone_update: '#c4b5fd',
  theme: '#fcd34d',
  outline: '#93c5fd',
  volume_outline: '#a5b4fc',
  chapter_outline: '#c4b5fd',
  content: '#7dd3fc',
  polish: '#a5f3fc',
  risk: '#fda4af',
  memory: '#d8b4fe',
  foreshadowing: '#fde047',
  logic_fix: '#fb923c',
  rule: '#7dd3fc',
  geography: '#6ee7b7',
  character_system: '#93c5fd',
  item_system: '#fcd34d',
  story_blueprint: '#f472b6',
}

// Use lucide-react icons via TypeIcon component — do NOT use emoji in UI

export function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, (c) => c.toUpperCase())
}

export const proposalStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待审批', color: '#fcd34d', bg: 'rgba(253,230,138,0.08)' },
  approved: { label: '已通过', color: '#86efac', bg: 'rgba(134,239,172,0.08)' },
  rejected: { label: '已拒绝', color: '#fda4af', bg: 'rgba(252,165,165,0.08)' },
  revision_requested: { label: '修改中', color: '#c4b5fd', bg: 'rgba(196,181,253,0.08)' },
  superseded: { label: '已替代', color: '#64748b', bg: 'rgba(255,255,255,0.04)' },
}

export function stripSchemePrefix(title: string): string {
  return title.replace(/^方案[A-Z][:：]\s*/, '')
}
