export type CharacterSubtype = 'protagonist' | 'character' | 'relationship'

export interface CharacterItem {
  subtype: CharacterSubtype
  name: string
  summary: string
  content: {
    // protagonist / character fields
    age?: string
    identity?: string
    personality?: string
    motivation?: string
    flaw?: string
    power_level?: string
    background?: string
    role?: string
    relationship_to_mc?: string
    faction?: string
    location?: string
    // relationship fields
    source?: string
    target?: string
    type?: string
    dynamic?: string
  }
}

export interface CharacterRelation {
  sourceName: string
  targetName: string
  relationType: 'affiliation' | 'opposition' | 'dependency' | 'reference'
  label: string
}

export interface CharacterPayload {
  name: string
  items: CharacterItem[]
  relations: CharacterRelation[]
}
