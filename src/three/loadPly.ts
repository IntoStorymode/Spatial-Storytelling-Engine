import * as THREE from 'three'

/**
 * Plain PLY support — for `.ply` files that are ordinary point clouds or meshes
 * rather than Gaussian splats. Two very different file types share the `.ply`
 * extension: an INRIA Gaussian-splat PLY (position + `f_dc`/`opacity`/`scale`/
 * `rot`) vs. a photogrammetry point cloud / mesh (position + `red/green/blue`,
 * optional faces). The splat library force-parses everything as a splat, so a
 * point cloud with no `opacity` gets every point culled → nothing renders. Here
 * we sniff the header and, when it's not a splat, load it with three's PLYLoader
 * as coloured points (or a vertex-coloured mesh).
 *
 * The PLYLoader is dynamically imported so it stays out of the initial bundle,
 * mirroring loadSplat's lazy import of the splat library.
 */

const HEADER_READ_CAP = 128 * 1024 // stop reading the header after this many bytes

/**
 * Read only the PLY header (ASCII in both ascii and binary PLY) and decide
 * whether the file is a Gaussian splat. Streams the response and cancels once
 * `end_header` is seen, so we never download the whole model just to classify it
 * (free for in-memory blob: URLs, a tiny range for http). Defaults to `true`
 * (splat) if the header can't be read, preserving the previous behavior.
 */
export async function plyIsSplat(url: string): Promise<boolean> {
  try {
    const res = await fetch(url)
    if (!res.ok || !res.body) return true
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let header = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      header += decoder.decode(value, { stream: true })
      const end = header.indexOf('end_header')
      if (end !== -1) {
        header = header.slice(0, end)
        break
      }
      if (header.length >= HEADER_READ_CAP) break
    }
    await reader.cancel().catch(() => {})
    return headerLooksLikeSplat(header)
  } catch {
    return true // unreadable → keep the current (splat) routing
  }
}

/** Gaussian-splat PLYs carry SH/opacity/scale/rot props or compressed-format markers. */
export function headerLooksLikeSplat(header: string): boolean {
  const h = header.toLowerCase()
  if (h.includes('f_dc_0')) return true // INRIA V1 spherical-harmonics colour
  if (h.includes('scale_0') && h.includes('rot_0')) return true // gaussian scale + rotation
  if (h.includes('element chunk') || h.includes('packed_')) return true // PlayCanvas compressed
  if (h.includes('codebook_centers')) return true // INRIA V2
  return false
}

/** Load a non-splat PLY as a THREE.Points (point cloud) or THREE.Mesh (has faces). */
export async function loadPly(resolvedUrl: string): Promise<THREE.Object3D> {
  const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js')
  const geometry = await new PLYLoader().loadAsync(resolvedUrl)

  const hasColor = geometry.hasAttribute('color')
  if (hasColor) sRGBToLinearColors(geometry) // PLY uchar RGB is sRGB-encoded

  // A PLY with faces parses to an indexed geometry → render as a mesh; otherwise
  // it's a point cloud → render as points.
  if (geometry.index) {
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: hasColor,
        color: hasColor ? 0xffffff : 0xcfcac2,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    )
    mesh.name = 'ply-mesh'
    orientZUpToYUp(mesh)
    return mesh
  }

  geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere?.radius ?? 1
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      // World-space size (sizeAttenuation) keeps the depth cue, but points shrink
      // up close, so bias it larger to avoid looking sparse when you walk in.
      size: Math.max(radius * 0.004, 0.01), // scaled to the scan; tune for density
      sizeAttenuation: true,
      vertexColors: hasColor,
      color: hasColor ? 0xffffff : 0xcfcac2,
    }),
  )
  points.name = 'ply-points'
  orientZUpToYUp(points)
  return points
}

/**
 * Scan/photogrammetry point clouds (Scaniverse, LiDAR, COLMAP) are typically
 * exported Z-up, so they land flat/top-down in Three.js's Y-up world. Rotate the
 * object −90° about X to bring Z-up → Y-up. `Box3.setFromObject` (used for camera
 * framing) accounts for this rotation, so framing stays correct.
 */
function orientZUpToYUp(obj: THREE.Object3D): void {
  obj.rotation.x = -Math.PI / 2
}

/**
 * Convert a geometry's per-vertex `color` attribute from sRGB to linear in place.
 * PLYLoader reads `uchar red/green/blue` as normalized values but leaves them in
 * the sRGB encoding they were authored in; three's colour management expects
 * linear working-space values, so without this the cloud looks washed-out/bright.
 */
function sRGBToLinearColors(geometry: THREE.BufferGeometry): void {
  const attr = geometry.getAttribute('color')
  const arr = attr.array as Float32Array
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i]
    arr[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  attr.needsUpdate = true
}
