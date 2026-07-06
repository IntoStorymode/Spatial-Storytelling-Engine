import type { Frontmatter, Hotspot, Waypoint } from './types'

/**
 * Resolve a waypoint reference (a name) to its camera, looking it up in the
 * story's frontmatter `waypoints` list. Returns undefined when the name is
 * missing or doesn't match — callers then fall back to default framing.
 */
export function resolveWaypoint(
  fm: Pick<Frontmatter, 'waypoints'>,
  name: string | undefined,
): Waypoint | undefined {
  if (!name) return undefined
  return fm.waypoints?.find((w) => w.name === name)
}

/**
 * Upsert a named waypoint into a `waypoints` list (pure — returns a new array).
 * If `name` already exists its camera is replaced in place; otherwise the
 * waypoint is appended. Used by the editor to translate a captured view into a
 * named waypoint the section/start can reference.
 */
export function upsertWaypoint(
  waypoints: Waypoint[] | undefined,
  name: string,
  camera: Hotspot,
): Waypoint[] {
  const next = waypoints ? [...waypoints] : []
  const wp: Waypoint = { name, position: camera.position, target: camera.target }
  const idx = next.findIndex((w) => w.name === name)
  if (idx === -1) next.push(wp)
  else next[idx] = wp
  return next
}

/**
 * Drop a waypoint by name if nothing references it any more (`referenced`
 * false). Pure — returns a new array (or the same list unchanged). Keeps the
 * frontmatter list from accumulating orphans as the editor clears views.
 */
export function pruneWaypoint(
  waypoints: Waypoint[] | undefined,
  name: string,
  referenced: boolean,
): Waypoint[] | undefined {
  if (!waypoints || referenced) return waypoints
  const next = waypoints.filter((w) => w.name !== name)
  return next.length ? next : undefined
}
