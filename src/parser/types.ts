export type SectionType = 'text' | 'image' | 'audio' | 'video'

export interface Hotspot {
  /** Camera world position the camera animates *to* in Mode A. */
  position: [number, number, number]
  /** Look-at point the camera orients toward. */
  target: [number, number, number]
}

/**
 * A named camera position for the story's scan. Sections and `start` reference a
 * waypoint by `name` (unique within a story), so several sections can share one
 * view. Defined once in the frontmatter `waypoints` list.
 */
export interface Waypoint extends Hotspot {
  /** Human name, referenced by sections/`start` (e.g. "north-window"). */
  name: string
}

export interface Section {
  /** Stable id from the `## [item-01]` heading. */
  id: string
  title: string
  type: SectionType
  /** Asset path exactly as authored (resolved against Story.basePath at render time). */
  src?: string
  caption?: string
  /** Freeform body text (markdown/plain). */
  body: string
  /**
   * Name of the waypoint this section flies to in Mode A (see Frontmatter.waypoints).
   * Optional — sections without a waypoint fall back to default framing.
   */
  waypoint?: string
  /**
   * Auto-play this section's clip in the immersive view (Mode A) as the reader
   * arrives at it. Applies to `audio`/`video` sections only; absent/false = the
   * reader presses play. Page view (Mode B) never auto-plays. Browsers may still
   * block audible autoplay until the reader has interacted; controls stay shown.
   */
  autoplay?: boolean
}

export interface Frontmatter {
  title: string
  author: string
  location: string
  date: string
  /** Path to the 3D model: `.glb`/`.gltf`, a splat (`.ply`/`.splat`/`.ksplat`), or `builtin:room`. */
  model: string
  /**
   * Named camera positions for this story's scan. Sections and `start` reference
   * these by name; several sections may share one. Absent/empty = no named views.
   */
  waypoints?: Waypoint[]
  /**
   * Name of the waypoint used as the story's opening view — the first view the
   * reader sees in Mode A (and the initial framing in Mode B). Falls back to
   * model bounding-box framing when absent or the name doesn't resolve.
   */
  start?: string
  /**
   * The reader's *default* Mode A camera navigation: `orbit` circles the model,
   * `firstPerson` looks around in place (+ WASD walk on desktop). Absent = firstPerson.
   * The reader can still switch live via the in-viewer toggle.
   */
  navigation?: 'orbit' | 'firstPerson'
  /**
   * Override the automatic splat up-axis correction. Absent = **auto**: `.ply`
   * splats get the 180° upright flip, other splat formats are left as-is. `flip`
   * forces the upright flip (e.g. a SuperSplat `.splat` repacked from an INRIA
   * `.ply` that inherits the flipped orientation); `none` disables it. Affects
   * splat models only — meshes are Y-up by spec.
   */
  orientation?: 'flip' | 'none'
}

export interface Story {
  frontmatter: Frontmatter
  sections: Section[]
  /** Directory the story.md was loaded from, e.g. `/stories/demo/`. Used to resolve `src`/`model`. */
  basePath: string
  /** Non-fatal parse issues, surfaced in the UI rather than thrown. */
  warnings: string[]
}
