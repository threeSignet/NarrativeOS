export type ItemSystemSubtype = 'artifact' | 'common_item'

export interface ItemSystemItem {
  subtype: ItemSystemSubtype
  name: string
  summary: string
  content: {
    // artifact fields
    origin?: string
    abilities?: string[]
    limitations?: string
    current_owner?: string
    // common_item fields
    type?: string
    rarity?: string
    effect?: string
    location?: string
  }
}

export interface ItemSystemRelation {
  sourceName: string
  targetName: string
  relationType: 'dependency' | 'affiliation' | 'reference'
  label: string
}

export interface ItemSystemPayload {
  name: string
  items: ItemSystemItem[]
  relations: ItemSystemRelation[]
}
