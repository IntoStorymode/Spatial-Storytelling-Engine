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
 * Supported formats (auto-detected from the path): .ply / .splat / .ksplat / .spz
 */
export async function loadSplat(resolvedUrl: string): Promise<THREE.Object3D> {
  const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')

  // Use the most compatible sort path: a plain worker sort, no GPU compute and
  // no SharedArrayBuffer. This renders even on hosts that don't send the COOP/
  // COEP isolation headers, and is plenty fast for prototype-scale scenes. (A
  // very large real scan can opt into gpuAcceleratedSort later.)
  const viewer = new GaussianSplats3D.DropInViewer({
    gpuAcceleratedSort: false,
    sharedMemoryForWorkers: false,
  })

  await viewer.addSplatScene(resolvedUrl, {
    showLoadingUI: false,
    progressiveLoad: false,
  })

  const obj = viewer as unknown as THREE.Object3D
  obj.name = 'splat-model'
  obj.userData.isSplat = true // signals ThreeViewer to dispose via the viewer's own dispose()
  // Splat bounds can confuse frustum culling; never cull the scene wholesale.
  obj.frustumCulled = false
  obj.traverse((child) => {
    child.frustumCulled = false
  })
  return obj
}
