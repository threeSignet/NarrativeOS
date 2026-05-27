export type ConflictSubtype = 'conflict' | 'stake' | 'escalation'

export interface ConflictItem {
  subtype: ConflictSubtype
  name: string
  summary: string
  content: {
    // conflict fields
    type?: string
    parties?: string[]
    stakes?: string
    origin?: string
    // stake fields
    affected_parties?: string[]
    consequence?: string
    // escalation fields
    trigger?: string
    stages?: string[]
    resolution?: string
  }
}

export interface ConflictRelation {
  sourceName: string
  targetName: string
  relationType: 'dependency' | 'opposition' | 'reference' | 'hierarchy'
  label: string
}

export interface ConflictPayload {
  name: string
  items: ConflictItem[]
  relations: ConflictRelation[]
}
