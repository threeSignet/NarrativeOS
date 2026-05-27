import {
  Globe2, User, MapPin, Swords, Building2, Sprout, Palette,
  Zap, Drama, ListChecks, PenLine, Sparkles, ShieldAlert,
  Brain, Link2, Wrench, ScrollText, HelpCircle,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  world_rule: Globe2,
  character: User,
  location: MapPin,
  power_system: Swords,
  faction: Building2,
  plot_seed: Sprout,
  tone_setting: Palette,
  tone: Globe2,
  conflict: Zap,
  theme: Drama,
  outline: ListChecks,
  content: PenLine,
  polish: Sparkles,
  risk: ShieldAlert,
  memory: Brain,
  foreshadowing: Link2,
  logic_fix: Wrench,
  rule: ScrollText,
}

export default function TypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = iconMap[type] || HelpCircle
  return <Icon size={size} />
}
