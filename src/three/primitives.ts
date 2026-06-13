import * as THREE from 'three'

/**
 * Built-in placeholder geometry, selected by the `builtin:<kind>` model scheme.
 * Lets the demo story render a navigable 3D space with zero binary assets.
 */
export function buildPrimitive(kind: string): THREE.Object3D {
  switch (kind) {
    case 'cube':
      return buildCube()
    case 'room':
    default:
      return buildRoom()
  }
}

function floorMaterial(): THREE.Material {
  return new THREE.MeshStandardMaterial({ color: 0x252220, roughness: 0.95, metalness: 0 })
}

function buildFloor(size = 6): THREE.Mesh {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), floorMaterial())
  floor.rotation.x = -Math.PI / 2
  floor.name = 'floor'
  return floor
}

function buildCube(): THREE.Object3D {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xc17a3a, roughness: 0.6, metalness: 0.1 }),
  )
  mesh.position.y = 0.5
  group.add(mesh, buildFloor(4))
  group.name = 'builtin-cube'
  return group
}

/**
 * A simple interior: floor + three walls, with three accent objects placed near
 * the demo story's hotspot targets so each camera move frames something.
 */
function buildRoom(): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'builtin-room'
  const half = 3

  group.add(buildFloor(half * 2))

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1f1d1a,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  const wallGeo = new THREE.PlaneGeometry(half * 2, 3)

  const back = new THREE.Mesh(wallGeo, wallMat)
  back.position.set(0, 1.5, -half)
  group.add(back)

  const left = new THREE.Mesh(wallGeo, wallMat)
  left.position.set(-half, 1.5, 0)
  left.rotation.y = Math.PI / 2
  group.add(left)

  const right = new THREE.Mesh(wallGeo, wallMat)
  right.position.set(half, 1.5, 0)
  right.rotation.y = -Math.PI / 2
  group.add(right)

  // Accent objects near the three demo hotspot targets, each a distinct color
  // so camera moves are visually legible.
  const anchors: Array<{ pos: [number, number, number]; color: number; h: number }> = [
    { pos: [0, 0.5, 0], color: 0xc17a3a, h: 1.0 }, // item-01 target [0,1,0]
    { pos: [0, 0.25, 0], color: 0x6b9e6b, h: 0.5 }, // item-02 target [0,0.5,0]
    { pos: [0, 0.4, 0], color: 0x9e8b4a, h: 0.8 }, // item-03 target [0,0.8,0]
  ]
  // Spread the anchors out so they don't overlap at the origin.
  const spread: Array<[number, number]> = [
    [0, -2],
    [2, 1],
    [-1.5, 2],
  ]
  anchors.forEach((a, i) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, a.h, 0.4),
      new THREE.MeshStandardMaterial({ color: a.color, roughness: 0.5, metalness: 0.1 }),
    )
    pillar.position.set(spread[i][0], a.h / 2, spread[i][1])
    group.add(pillar)
  })

  return group
}
