export type FactionSubtype = 'faction_layout' | 'faction_member'

export interface FactionItem {
  subtype: FactionSubtype
  name: string
  summary: string
  content: {
    // faction_layout fields
    power_structure?: string
    major_conflicts?: string[]
    // faction_member fields
    type?: string
    scale?: string
    leader?: string
    goal?: string
    headquarters?: string
    territory?: string[]
    allies?: string[]
    enemies?: string[]
  }
}

export interface FactionRelation {
  sourceName: string
  targetName: string
  relationType: 'opposition' | 'affiliation' | 'dependency' | 'hierarchy'
  label: string
}

export interface FactionPayload {
  name: string
  items: FactionItem[]
  relations: FactionRelation[]
}
