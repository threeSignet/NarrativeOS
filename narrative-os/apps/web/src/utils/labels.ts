// ═══════════════════════════════════════════════════════════
// Shared label mappings — single source of truth for all engine views
// ═══════════════════════════════════════════════════════════

export const SUBTYPE_LABELS: Record<string, string> = {
  parent: '概要',
  tone: '基调',
  region: '区域',
  location: '地点',
  landmark: '地标',
  power_system: '体系',
  realm: '境界',
  rule: '规则',
  faction_layout: '势力格局',
  faction_member: '势力',
  // ── Race ──
  race: '种族',
  beast: '妖兽/魔物',
  subrace: '亚种/变体',
  // ── Culture ──
  language: '语言',
  religion: '宗教/信仰',
  festival: '节日/庆典',
  art_form: '艺术形式',
  custom: '风俗/习惯',
  taboo: '禁忌',
  // ── History ──
  era: '纪元/时代',
  event: '历史事件',
  historical_figure: '历史人物',
  cataclysm: '灾难/浩劫',
  // ── Technique ──
  technique: '功法/技能',
  cultivation_method: '修炼法门',
  pill: '丹药',
  formation: '阵法',
  // ── Economy ──
  resource: '资源',
  currency: '货币',
  trade_route: '贸易路线',
  market: '市场',
  guild: '行会/商会',
  // ── Causality ──
  causal_chain: '因果链',
  ripple_effect: '涟漪效应',
  turning_point: '关键转折',
  // ── Rules ──
  world_law: '世界法则',
  regional_rule: '地域规则',
  social_rule: '社会规则',
  power_rule: '力量规则',
  protagonist: '主角',
  character: '角色',
  relationship: '关系',
  conflict: '矛盾',
  stake: '利害点',
  escalation: '升级点',
  artifact: '神器',
  common_item: '物品',
  story_blueprint: '蓝图',
  // ── Foreshadowing ──
  plant: '埋设伏笔',
  payoff: '回收伏笔',
  red_herring: '烟雾弹',
  // ── Chapter Writer ──
  chapter_draft: '章草稿',
  scene_draft: '场景草稿',
  revision_note: '修改建议',
}

export const CONTENT_LABELS: Record<string, string> = {
  // ── Tone ──
  name: '名称',
  atmosphere: '氛围',
  social_structure: '社会结构',
  technology_level: '技术水平',
  unique_rules: '独特规则',
  cultural_notes: '文化特色',
  taboos: '禁忌',

  // ── Geography ──
  climate: '气候',
  terrain: '地形',
  resources: '资源',
  cultural_significance: '文化意义',
  significance: '重要性',
  description: '描述',

  // ── Power System ──
  type: '类型',
  source: '来源',
  progression: '晋升路径',
  limitations: '限制',
  level: '等级',
  abilities: '能力',
  breakthrough_condition: '突破条件',
  rule_type: '规则类型',
  exceptions: '例外',
  core_mechanic: '核心机制',
  weaknesses: '弱点',
  cost: '代价',

  // ── Faction ──
  power_structure: '权力结构',
  major_conflicts: '主要冲突',
  scale: '规模',
  leader: '首领',
  goal: '核心目标',
  headquarters: '总部',
  territory: '势力范围',
  allies: '盟友',
  enemies: '敌人',

  // ── Race ──
  appearance: '外观特征',
  traits: '种族天赋',
  lifespan: '寿命',
  population: '人口规模',
  distribution: '分布区域',
  affinity: '能量亲和',
  inter_race_relations: '种族关系',
  racial_history: '种族历史',
  habitat: '栖息地',
  threat_level: '威胁等级',
  rarity: '稀有度',
  materials: '可采集材料',
  size: '体型',
  behavior: '习性',
  parent_race: '父种族',
  differences: '差异',
  mutation_cause: '变异原因',

  // ── Culture ──
  language_family: '语系',
  spoken_in: '使用区域',
  used_by: '使用群体',
  writing_system: '文字系统',
  features: '语言特色',
  is_common_tongue: '通用语',
  faith_type: '信仰类型',
  deities: '神祇',
  followers: '信徒',
  core_doctrines: '核心教义',
  religious_organization: '宗教组织',
  holy_sites: '圣地',
  political_influence: '政治影响',
  timing: '日期/周期',
  celebrations: '庆祝活动',
  origin_meaning: '起源/意义',
  celebrated_by: '庆祝群体',
  religious_connection: '宗教关联',
  art_type: '艺术类型',
  style_description: '风格描述',
  notable_examples: '代表作品',
  popular_in: '流行区域',
  custom_type: '风俗类型',
  practice: '具体做法',
  meaning: '含义',
  consequence: '后果',
  enforced_by: '执行者',

  // ── History ──
  era_start_event: '起始事件',
  era_end_event: '结束事件',
  era_characteristics: '时代特征',
  dominant_faction: '统治势力',
  civilization_level: '文明水平',
  approximate_duration: '持续时间',
  timeline_position: '时间点',
  era_belong_to: '所属纪元',
  event_type: '事件类型',
  involved_parties: '参与方',
  consequences: '后续影响',
  location: '地点',
  era_of_activity: '活跃时代',
  historical_role: '历史身份',
  achievements: '主要成就',
  faction_affiliation: '所属势力',
  legacy: '后世影响',
  story_relevance: '故事关联',
  cataclysm_type: '灾难类型',
  affected_area: '影响区域',
  devastation_scale: '损害程度',
  remnants: '遗迹',
  lingering_effects: '持续影响',

  // ── Technique ──
  technique_type: '功法类型',
  required_realm: '所需境界',
  element: '元素/属性',
  effects: '效果',
  origin: '功法起源',
  prerequisite_techniques: '前置功法',
  taught_by: '传授势力',
  grade: '品阶',
  method_type: '法门类型',
  requirements: '资质要求',
  cultivation_speed: '修炼速度',
  max_realm: '上限境界',
  risks: '风险',
  inherited_by: '传承势力',
  pill_type: '丹药类型',
  ingredients: '材料',
  refinement_difficulty: '炼制难度',
  side_effects: '副作用',
  refinable_by: '可炼制者',
  formation_type: '阵法类型',
  required_materials: '所需材料',
  formation_scale: '阵法规模',
  duration: '持续时间',
  known_locations: '已知布阵点',

  // ── Economy ──
  resource_type: '资源类型',
  source_regions: '产地',
  scarcity: '稀缺度',
  uses: '用途',
  controlled_by: '控制方',
  extraction_difficulty: '开采难度',
  renewable: '可再生',
  currency_form: '货币形式',
  issued_by: '发行方',
  circulation_area: '流通范围',
  exchange_rate: '兑换率',
  value_backing: '价值支撑',
  counterfeiting_issue: '假币问题',
  transport_method: '运输方式',
  origin_point: '起点',
  route_points: '途经点',
  goods_transported: '运输货物',
  hazards: '路线风险',
  tolls: '通行费用',
  route_controlled_by: '路线控制方',
  market_scale: '市场规模',
  specialty_goods: '特色商品',
  operated_by: '经营方',
  trade_rules: '交易规则',
  guild_type: '行会类型',
  member_count: '成员规模',
  monopoly: '垄断领域',
  political_connections: '政治关联',

  // ── Causality ──
  trigger_event: '起点事件',
  intermediate_events: '中间事件',
  final_effect: '最终结果',
  involved_factions: '涉及势力',
  involved_characters: '涉及角色',
  time_span: '时间跨度',
  inevitability: '必然性',
  alternative_paths: '替代路径',
  current_stage: '当前阶段',
  unresolved_tensions: '未解决张力',
  locations_involved: '涉及地点',
  source_event: '源头事件',
  affected_domains: '影响领域',
  propagation_path: '传播路径',
  intensity_decay: '强度衰减',
  unexpected_consequences: '意外后果',
  before_state: '转折前状态',
  after_state: '转折后状态',
  decision_maker: '决策者',
  decision_motive: '决策动机',
  alternatives: '替代选择',
  why_this_path: '选择原因',
  irreversible_changes: '不可逆改变',
  related_conflicts: '关联矛盾',
  retrospective: '后见之明',

  // ── Rules ──
  rule_statement: '规则表述',
  rationale: '存在理由',
  violation_consequence: '违反后果',
  exploitability: '利用方式',
  scope: '适用范围',
  law_type: '法则类型',
  mutability: '可变性',
  power_system_implications: '力量体系影响',
  applicable_regions: '适用区域',
  temporal_condition: '时间条件',
  countermeasure: '规避手段',
  origin_event: '来源事件',
  applicable_to: '适用对象',
  established_by: '制定者',
  punishment_system: '处罚体系',
  class_differential: '阶层差异',
  related_customs: '关联习俗',
  constrains_power: '约束力量',
  power_rule_type: '力量规则类型',
  breakthrough_consequence: '突破后果',
  known_breaches: '已知突破案例',

  // ── Character ──
  age: '年龄',
  identity: '身份',
  personality: '性格',
  motivation: '核心动机',
  flaw: '弱点',
  power_level: '实力',
  background: '背景',
  role: '定位',
  relationship_to_mc: '与主角关系',
  faction: '所属势力',

  // ── Conflict ──
  parties: '参与方',
  stakes: '利害关系',

  // ── Item System ──
  current_owner: '持有者',
  effect: '效果',

  // ── Story Blueprint ──
  core_premise: '核心前提',
  major_arcs: '主线',
  turning_points: '转折点',
  ending_vision: '结局',
  target_volumes: '卷数',
  target_chapters_per_volume: '章/卷',

  // ── Foreshadowing ──
  foreshadowing_content: '伏笔内容',
  foreshadowing_type: '伏笔类型',
  mystery_question: '核心谜题',
  truth: '伏笔真相',
  subtlety: '隐晦程度',
  plant_volume: '埋设卷',
  plant_chapter_range: '埋设章节',
  plant_method: '埋设方式',
  plant_suggestion: '埋设建议',
  related_entity: '关联实体',
  payoff_volume: '回收卷',
  payoff_chapter_range: '回收章节',
  payoff_method: '回收方式',
  payoff_suggestion: '回收建议',
  payoff_emotion: '回收情绪',
  combined_with: '组合回收',
  false_lead: '错误指向',
  why_plausible: '合理性',
  protected_truth: '保护真相',
  reveal_timing: '揭穿时机',
  importance: '重要性',
  abandon_reason: '废弃原因',

  // ── Chapter Writer ──
  chapter_number: '章节编号',
  chapter_title: '章节标题',
  target_word_count: '目标字数',
  scene_number: '场景序号',
  scene_type: '场景类型',
  scene_title: '场景标题',
  prose: '正文',
  word_count: '字数',
  pov_character: 'POV角色',
  scene_location: '场景地点',
  characters_present: '出场角色',
  world_references: '世界引用',
  foreshadowing_planted: '埋设伏笔',
  foreshadowing_paid_off: '回收伏笔',
  power_displays: '力量展示',
  callbacks: '前文呼应',
  emotional_tone: '情感基调',
  scene_goal: '场景目标',
  target_scene: '目标场景',
  suggestion_type: '建议类型',
  suggestion: '修改建议',
  priority: '优先级',

  // ── Misc ──
  abilities_notes: '能力说明',
}

export type MapScale = 'universe' | 'galaxy' | 'star_system' | 'planet' | 'continent' | 'region' | 'city' | 'district' | 'scene'

export const SCALE_ORDER: MapScale[] = [
  'universe', 'galaxy', 'star_system', 'planet',
  'continent', 'region', 'city', 'district', 'scene',
]

export const SCALE_LABELS: Record<MapScale, string> = {
  universe: '宇宙', galaxy: '星系', star_system: '恒星系',
  planet: '星球', continent: '大陆', region: '区域',
  city: '城市', district: '街区', scene: '场景',
}

/** Fields to skip when rendering content details */
export const CONTENT_SKIP_KEYS = new Set([
  'coordinates', 'scale', 'parentName', 'name',
])

/**
 * Format a content object into label/value pairs for display.
 * Handles nested objects, arrays of items/relations, and long strings.
 */
export function formatContent(content: Record<string, any>): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = []

  for (const [k, v] of Object.entries(content)) {
    if (CONTENT_SKIP_KEYS.has(k) || v == null || v === '') continue
    const label = CONTENT_LABELS[k] || k

    if (k === 'items' && Array.isArray(v)) {
      const names = v.map((item: any) => item?.name || item?.subtype || '').filter(Boolean).join('、')
      if (names) result.push({ label: '包含条目', value: names })
    } else if (k === 'relations' && Array.isArray(v)) {
      const rels = v.map((r: any) => r?.label ? `${r.label}(${r.sourceName}→${r.targetName})` : '').filter(Boolean).join('、')
      if (rels) result.push({ label: '关联关系', value: rels })
    } else if (Array.isArray(v)) {
      const items = v.map((item: any) => typeof item === 'string' ? item : (item?.name || JSON.stringify(item).substring(0, 40))).join('、')
      result.push({ label, value: items || '(空)' })
    } else if (typeof v === 'object') {
      const nested = formatContent(v)
      if (nested.length > 0) {
        result.push({ label, value: nested.map((f) => `${f.label}: ${f.value}`).join('；') })
      }
    } else {
      const str = String(v)
      result.push({ label, value: str.length > 200 ? str.substring(0, 200) + '...' : str })
    }
  }
  return result
}
