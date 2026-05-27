export type GeographySubtype = 'region' | 'location' | 'landmark'

export type MapScale = 'universe' | 'galaxy' | 'star_system' | 'planet' | 'continent' | 'region' | 'city' | 'district' | 'scene'

export interface GeographyItem {
  subtype: GeographySubtype
  name: string
  summary: string
  content: {
    // Region fields
    climate?: string
    terrain?: string
    resources?: string
    cultural_significance?: string
    // Location fields
    type?: string
    significance?: string
    description?: string
    // Landmark / positioning
    scale?: MapScale
    coordinates?: { x: number; y: number }
    parentName?: string
  }
}

export interface GeographyRelation {
  sourceName: string
  targetName: string
  relationType: 'geographic' | 'hierarchy' | 'adjacency'
  label: string
}

export interface GeographyPayload {
  name: string
  items: GeographyItem[]
  relations: GeographyRelation[]
}

export interface GeographyMapNode {
  id: string
  name: string
  subtype: GeographySubtype
  scale: MapScale
  x: number
  y: number
  parentId: string | null
  children: GeographyMapNode[]
  summary: string
  content: Record<string, any>
}

export interface GeographyMapData {
  nodes: GeographyMapNode[]
  relations: GeographyRelation[]
  currentScale: MapScale
}
