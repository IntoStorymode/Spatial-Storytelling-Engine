import * as THREE from 'three'

/**
 * Load a Gaussian-splat scene as a THREE.Object3D (a DropInViewer Group) that
 * plugs straight into our existing scene + camera + RAF loop. The DropInViewer
 * drives its own per-frame sort via an internal callback mesh, so the normal
 * `renderer.render(scene, camera)` is enough — no engine changes required.
 *
 * The heavy splat library is dynamically imported so it only loads for users who
 * actually open a splat-backed story; it stays out of the initial bundle.
 *
 * Supported formats: .ply / .splat / .ksplat / .spz. The library normally infers
 * the format from the URL's file extension, but an uploaded `blob:`/`data:` URL
 * carries none — so callers pass `ext` and we map it to the explicit `format`
 * option, which the loader honours over path-based inference.
 */
const SCENE_FORMAT_BY_EXT: Record<string, 'Ply' | 'Splat' | 'KSplat' | 'Spz'> = {
  ply: 'Ply',
  splat: 'Splat',
  ksplat: 'KSplat',
  spz: 'Spz',
}

export async function loadSplat(resolvedUrl: string, ext?: string): Promise<THREE.Object3D> {
  const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')

  // Use the most compatible sort path: a plain worker sort, no GPU compute and
  // no SharedArrayBuffer. This renders even on hosts that don't send the COOP/
  // COEP isolation headers, and is plenty fast for prototype-scale scenes. (A
  // very large real scan can opt into gpuAcceleratedSort later.)
  const viewer = new GaussianSplats3D.DropInViewer({
    gpuAcceleratedSort: false,
    sharedMemoryForWorkers: false,
  })

  const normExt = ext?.toLowerCase()
  const formatKey = normExt ? SCENE_FORMAT_BY_EXT[normExt] : undefined
  const format = formatKey ? GaussianSplats3D.SceneFormat[formatKey] : undefined

  await viewer.addSplatScene(resolvedUrl, {
    showLoadingUI: false,
    progressiveLoad: false,
    ...(format !== undefined ? { format } : {}),
  })

  const obj = viewer as unknown as THREE.Object3D
  obj.name = 'splat-model'
  obj.userData.isSplat = true // signals ThreeViewer to dispose via the viewer's own dispose()
  // Splat bounds can confuse frustum culling; never cull the scene wholesale.
  obj.frustumCulled = false
  obj.traverse((child) => {
    child.frustumCulled = false
  })

  // INRIA-format .ply splats use a Y-down / Z-forward (COLMAP) convention, so
  // they land upside-down in Three.js's Y-up world. Correct with a 180° rotation
  // about X — a true rotation (det +1, no mirroring), pivoted on the model's own
  // bounding-box centre so its world position is preserved. Other splat formats
  // (.splat/.ksplat/.spz) are typically already Y-up from conversion, so we leave
  // them alone. See loadModel's formatHint for how uploads carry their extension.
  if (normExt === 'ply') {
    orientPlyUpright(viewer)
  }

  return obj
}

/** Flip an INRIA .ply splat 180° about X around its own centre (Y-up correction). */
function orientPlyUpright(viewer: import('@mkkellogg/gaussian-splats-3d').DropInViewer): void {
  const obj = viewer as unknown as THREE.Object3D
  const splatMesh = viewer.splatMesh
  if (!splatMesh) return

  const center = splatMesh.computeBoundingBox(true).getCenter(new THREE.Vector3())
  // Rotate child point p to world = C + R·(p − C), with R = 180° about X mapping
  // (x,y,z) → (x,−y,−z). That expands to world = R·p + (0, 2·Cy, 2·Cz), so:
  obj.rotation.x = Math.PI
  obj.position.set(0, 2 * center.y, 2 * center.z)
}
