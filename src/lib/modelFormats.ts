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
