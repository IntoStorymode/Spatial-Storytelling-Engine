/**
 * The 3D model formats the engine accepts — the single source of truth.
 *
 * This list had drifted: `.sog` was added to the loader in the Spark migration
 * (PR #37) but not to the editor's upload dialogue, so a format the engine could
 * render was one the author could not select. The two lists lived in different
 * files with nothing tying them together.
 *
 * Deliberately free of any Three.js import so the editor's form components can
 * read it without dragging the whole 3D dependency graph into their bundle —
 * the same reason `resolveUrl` was extracted (PR #35).
 */

/** Mesh formats, loaded via GLTFLoader. */
export const MESH_EXTS = ['glb', 'gltf'] as const

/**
 * Gaussian-splat formats, loaded via Spark.
 *
 * `.ply` is ambiguous — it is also an ordinary point-cloud/mesh container — so
 * `loadModel` sniffs the header and routes non-splat PLYs to `loadPly` instead.
 */
export const SPLAT_EXTS = ['ply', 'splat', 'ksplat', 'spz', 'sog'] as const

export const MODEL_EXTS: readonly string[] = [...MESH_EXTS, ...SPLAT_EXTS]

/** `accept` attribute for a model file input, e.g. ".glb,.gltf,.ply,…". */
export const MODEL_ACCEPT = MODEL_EXTS.map((e) => `.${e}`).join(',')

export function isSplatExt(ext: string): boolean {
  return (SPLAT_EXTS as readonly string[]).includes(ext.toLowerCase())
}

export function isMeshExt(ext: string): boolean {
  return (MESH_EXTS as readonly string[]).includes(ext.toLowerCase())
}

/**
 * Compressed splat containers — small enough to load on the fly. A story that
 * ships one of these is doing the right thing.
 */
export const COMPRESSED_SPLAT_EXTS = ['sog', 'spz', 'ksplat'] as const

/**
 * Uncompressed splat containers. `.splat` is raw 32-bytes-per-splat; a `.ply`
 * model is either an INRIA training dump or an ordinary point cloud — both
 * large. These should be converted (SuperSplat → `.sog`) before shipping.
 */
export const RAW_SPLAT_EXTS = ['splat', 'ply'] as const

/**
 * Soft budget for a single model loaded on demand (bytes). Above this, even a
 * compressed splat is worth trimming — it matters most when a reader travels
 * between stories and the next scene loads dynamically. Advisory, not enforced.
 */
export const MODEL_SIZE_WARN_BYTES = 40 * 1024 * 1024 // ~40 MB

/** The lowercased extension of a filename, or '' if it has none. */
export function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * An author-facing advisory about a model's weight, or `null` if it's fine.
 *
 * A raw, uncompressed splat is flagged at any size (the format itself is the
 * problem — converting to `.sog` is 10–20× smaller); any other model is flagged
 * only when it exceeds {@link MODEL_SIZE_WARN_BYTES}. Pure and DOM-free so the
 * editor, the export path, and the tests can all share it.
 */
export function describeModelWeight(name: string, size: number): string | null {
  const ext = extOf(name)
  if ((RAW_SPLAT_EXTS as readonly string[]).includes(ext)) {
    return `${name} (${mb(size)}) is a raw, uncompressed splat — re-export it as .sog in SuperSplat (typically 10–20× smaller) so it loads quickly, especially when readers travel between stories.`
  }
  if (size <= MODEL_SIZE_WARN_BYTES) return null
  if (isMeshExt(ext)) {
    return `${name} (${mb(size)}) is a large mesh — consider decimating or compressing it (e.g. Draco / meshopt) so it loads quickly.`
  }
  return `${name} (${mb(size)}) is over the ~40 MB budget for smooth loading — crop stray splats or reduce the splat count in SuperSplat.`
}
