export type ItemType = 'text' | 'image' | 'audio' | 'video'

export interface Hotspot {
  /** Camera world position the camera animates *to* in Mode A. */
  position: [number, number, number]
  /** Look-at point the camera orients toward. */
  target: [number, number, number]
}

export interface StoryItem {
  /** Stable id from the `## [item-01]` heading. */
  id: string
  title: string
  type: ItemType
  /** Asset path exactly as authored (resolved against Story.basePath at render time). */
  src?: string
  caption?: string
  /** Freeform body text (markdown/plain). */
  body: string
  /** Optional — items without a hotspot fall back to default framing in Mode A. */
  hotspot?: Hotspot
}

export interface Frontmatter {
  title: string
  author: string
  location: string
  date: string
  /** Path to the 3D model: `.glb`/`.gltf`, a splat (`.ply`/`.splat`/`.ksplat`), or `builtin:room`. */
  model: string
}

export interface Story {
  frontmatter: Frontmatter
  items: StoryItem[]
  /** Directory the story.md was loaded from, e.g. `/stories/demo/`. Used to resolve `src`/`model`. */
  basePath: string
  /** Non-fatal parse issues, surfaced in the UI rather than thrown. */
  warnings: string[]
}
