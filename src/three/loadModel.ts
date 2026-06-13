import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildPrimitive } from './primitives'

const SPLAT_EXTS = new Set(['ply', 'splat', 'ksplat', 'spz'])

/**
 * Load a story's 3D model into a Three.js Object3D, dispatching by source:
 *  - `builtin:<kind>` → generated placeholder geometry (no asset needed)
 *  - `.glb` / `.gltf` → GLTFLoader
 *  - splat formats     → deferred to M5 (throws a clear message for now)
 */
export async function loadModel(url: string, basePath = ''): Promise<THREE.Object3D> {
  if (url.startsWith('builtin:')) {
    return buildPrimitive(url.slice('builtin:'.length))
  }

  const ext = url.split('.').pop()?.toLowerCase() ?? ''
  const resolved = resolveUrl(url, basePath)

  if (ext === 'glb' || ext === 'gltf') {
    const gltf = await new GLTFLoader().loadAsync(resolved)
    gltf.scene.name = 'gltf-model'
    return gltf.scene
  }

  if (SPLAT_EXTS.has(ext)) {
    throw new Error(
      `Gaussian-splat format ".${ext}" is not wired up until M5. ` +
        `Use a .glb model or "builtin:room" for now.`,
    )
  }

  throw new Error(`Unsupported model format: "${url}"`)
}

/** Resolve a story-relative asset path against the story's basePath. */
export function resolveUrl(url: string, basePath: string): string {
  if (/^https?:\/\//.test(url) || url.startsWith('/')) return url
  return basePath.replace(/\/?$/, '/') + url
}
