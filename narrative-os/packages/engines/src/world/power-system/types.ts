export type PowerSystemSubtype = 'power_system' | 'realm' | 'rule'

export interface PowerSystemItem {
  subtype: PowerSystemSubtype
  name: string
  summary: string
  content: {
    // power_system fields
    type?: string
    source?: string
    progression?: string
    limitations?: string
    // realm fields
    level?: number
    abilities?: string[]
    breakthrough_condition?: string
    // rule fields
    rule_type?: string
    description?: string
    exceptions?: string[]
  }
}

export interface PowerSystemRelation {
  sourceName: string
  targetName: string
  relationType: 'hierarchy' | 'dependency' | 'opposition' | 'reference'
  label: string
}

export interface PowerSystemPayload {
  name: string
  items: PowerSystemItem[]
  relations: PowerSystemRelation[]
}
