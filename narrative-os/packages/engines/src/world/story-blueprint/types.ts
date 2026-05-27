export interface StoryBlueprintItem {
  subtype: 'story_blueprint'
  name: string
  summary: string
  content: {
    core_premise: string
    major_arcs: string[]
    turning_points: string[]
    ending_vision: string
    target_volumes: number
    target_chapters_per_volume: number
  }
}

export interface StoryBlueprintPayload {
  name: string
  items: StoryBlueprintItem[]
}
