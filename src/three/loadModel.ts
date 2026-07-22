import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildPrimitive } from './primitives'
import { loadSplat, type SplatContext } from './loadSplat'
import { loadPly, plyIsSplat } from './loadPly'
import { resolveUrl } from '../lib/resolveUrl'
import { isMeshExt, isSplatExt } from '../lib/modelFormats'

/**
 * Load a story's 3D model into a Three.js Object3D, dispatching by source:
 *  - `builtin:<kind>` → generated placeholder geometry (no asset needed)
 *  - `.glb` / `.gltf` → GLTFLoader
 *  - splat formats     → Spark SplatMesh (lazy-loaded)
 *
 * `splatContext` is what lets a splat wire itself into the caller's render loop
 * (Spark needs the WebGLRenderer and a redraw callback). It is optional because
 * the VR viewer calls this for MESHES only — it still has its own splat path.
 */
export async function loadModel(
  url: string,
  basePath = '',
  formatHint?: string,
  orientation?: 'flip' | 'none',
  splatContext?: SplatContext,
): Promise<THREE.Object3D> {
  if (url.startsWith('builtin:')) {
    return buildPrimitive(url.slice('builtin:'.length))
  }

  // formatHint lets uploaded blob:/data: URLs (which carry no extension) still
  // dispatch to the right loader.
  const ext = (formatHint ?? url.split('.').pop() ?? '').toLowerCase()
  const resolved = resolveUrl(url, basePath)

  if (isMeshExt(ext)) {
    const gltf = await new GLTFLoader().loadAsync(resolved)
    gltf.scene.name = 'gltf-model'
    return gltf.scene
  }

  if (isSplatExt(ext)) {
    // Two file types share `.ply` — a Gaussian-splat PLY vs an ordinary point
    // cloud / mesh. Sniff the header so a non-splat PLY renders as coloured
    // points instead of being culled to nothing by the splat loader.
    if (ext === 'ply' && !(await plyIsSplat(resolved))) {
      return loadPly(resolved)
    }
    return loadSplat(resolved, ext, orientation, splatContext)
  }

  throw new Error(`Unsupported model format: "${url}"`)
}
