import type { ReactNode } from 'react'
import {
  Globe2, Mountain, Swords, MapPin, Users,
  Sparkles, BookOpen, Package,
  PawPrint, Music, Clock, Flame, Coins, GitBranch, Scale, Eye, Pen,
  FileText, Layers,
} from 'lucide-react'

export const engineConfig: { key: string; label: string; icon: ReactNode; color: string; node: string }[] = [
  { key: 'tone', label: '世界观基调', icon: <Globe2 size={16} />, color: 'var(--accent-violet)', node: 'tone' },
  { key: 'geography', label: '地理环境', icon: <Mountain size={16} />, color: 'var(--accent-mint)', node: 'geography' },
  { key: 'power_system', label: '力量体系', icon: <Swords size={16} />, color: 'var(--accent-rose)', node: 'power-system' },
  { key: 'faction', label: '势力分布', icon: <MapPin size={16} />, color: 'var(--accent-orange)', node: 'faction' },
  { key: 'race', label: '种族生物', icon: <PawPrint size={16} />, color: 'var(--accent-mint)', node: 'race' },
  { key: 'culture', label: '文化体系', icon: <Music size={16} />, color: 'var(--accent-violet)', node: 'culture' },
  { key: 'history', label: '历史年表', icon: <Clock size={16} />, color: 'var(--accent-warm)', node: 'history' },
  { key: 'technique', label: '功法技能', icon: <Flame size={16} />, color: 'var(--accent-rose)', node: 'technique' },
  { key: 'economy', label: '经济体系', icon: <Coins size={16} />, color: 'var(--accent-gold)', node: 'economy' },
  { key: 'rules', label: '规则引擎', icon: <Scale size={16} />, color: 'var(--accent-orange)', node: 'rules' },
  { key: 'character', label: '角色体系', icon: <Users size={16} />, color: 'var(--accent-ice)', node: 'character' },
  { key: 'conflict', label: '核心矛盾', icon: <Sparkles size={16} />, color: 'var(--accent-warm)', node: 'conflict' },
  { key: 'causality', label: '因果引擎', icon: <GitBranch size={16} />, color: 'var(--accent-ice)', node: 'causality' },
  { key: 'item_system', label: '物品体系', icon: <Package size={16} />, color: 'var(--accent-gold)', node: 'item-system' },
  { key: 'story_blueprint', label: '故事蓝图', icon: <BookOpen size={16} />, color: 'var(--accent-rose)', node: 'story-blueprint' },
  { key: 'foreshadowing', label: '伏笔追踪', icon: <Eye size={16} />, color: 'var(--accent-violet)', node: 'foreshadowing' },
  { key: 'outline', label: '全局大纲', icon: <FileText size={16} />, color: 'var(--accent-mint)', node: 'outline-generator' },
  { key: 'volume_outline', label: '卷纲', icon: <Layers size={16} />, color: 'var(--accent-ice)', node: 'volume-outline' },
  { key: 'chapter_outline', label: '章纲', icon: <FileText size={16} />, color: 'var(--accent-warm)', node: 'chapter-outline' },
  { key: 'chapter_writing', label: '章节写作', icon: <Pen size={16} />, color: 'var(--accent-ice)', node: 'chapter-writer' },
]

export const engineLabelMap: Record<string, string> = Object.fromEntries(
  engineConfig.map((e) => [e.node, e.label])
)
// Aliases: settingType (underscore) → label, for code that queries by item.type
engineLabelMap['power_system'] = '力量体系'
engineLabelMap['item_system'] = '物品体系'
engineLabelMap['story_blueprint'] = '故事蓝图'
engineLabelMap['outline-generator'] = '大纲'
engineLabelMap['volume-outline'] = '卷纲'
engineLabelMap['chapter-outline'] = '章纲'
