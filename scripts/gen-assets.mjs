// Generates the demo story's binary placeholder assets with NO network access:
//   - narration.wav : ~1s of silence (valid 16-bit PCM WAV)
//   - cube.glb       : a single cube, exported via three's GLTFExporter
// Runs on `predev`/`prebuild`. Both steps are resilient: a failure warns but
// does not abort the dev server (the demo story uses `model: builtin:room`).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(__dirname, '..', 'public', 'stories', 'demo', 'assets')
mkdirSync(ASSETS, { recursive: true })

const SPLAT_ASSETS = join(__dirname, '..', 'public', 'stories', 'splat-example', 'assets')
mkdirSync(SPLAT_ASSETS, { recursive: true })

// ── 1. Silent WAV ──────────────────────────────────────────────────────────
function silentWav(seconds = 1, sampleRate = 8000) {
  const numSamples = seconds * sampleRate
  const dataSize = numSamples * 2 // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf // remaining bytes are zero = silence
}

const wavPath = join(ASSETS, 'narration.wav')
if (!existsSync(wavPath)) {
  writeFileSync(wavPath, silentWav())
  console.log('gen-assets: wrote narration.wav')
} else {
  console.log('gen-assets: narration.wav exists, skipping')
}

// ── 2. Cube glTF (proves the GLTFLoader path) ────────────────────────────────
// Non-binary glTF export: parseAsync returns a JSON object with the geometry
// buffer embedded as a base64 data URI — no Blob/FileReader (browser-only APIs)
// needed, so it works headless in Node. GLTFLoader loads .gltf just like .glb.
const gltfPath = join(ASSETS, 'cube.gltf')
if (existsSync(gltfPath)) {
  console.log('gen-assets: cube.gltf exists, skipping')
} else {
  try {
    // GLTFExporter base64-encodes the geometry buffer via FileReader.readAsDataURL
    // (a browser API). Node 18+ has a global Blob; shim a full FileReader so the
    // export resolves headless.
    if (typeof globalThis.FileReader === 'undefined') {
      globalThis.FileReader = class {
        constructor() {
          this._l = {}
          this.result = null
        }
        addEventListener(type, cb) {
          ;(this._l[type] ||= []).push(cb)
        }
        _done() {
          if (typeof this.onloadend === 'function') this.onloadend()
          if (typeof this.onload === 'function') this.onload()
          ;(this._l.load || []).forEach((cb) => cb.call(this))
          ;(this._l.loadend || []).forEach((cb) => cb.call(this))
        }
        readAsArrayBuffer(blob) {
          Promise.resolve(blob.arrayBuffer()).then((ab) => {
            this.result = ab
            this._done()
          })
        }
        readAsDataURL(blob) {
          Promise.resolve(blob.arrayBuffer()).then((ab) => {
            const b64 = Buffer.from(ab).toString('base64')
            this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`
            this._done()
          })
        }
      }
    }

    const THREE = await import('three')
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')

    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xc17a3a, roughness: 0.6, metalness: 0.1 }),
    )
    mesh.position.y = 0.5
    scene.add(mesh)

    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(scene, { binary: false })
    writeFileSync(gltfPath, JSON.stringify(result))
    console.log('gen-assets: wrote cube.gltf')
  } catch (err) {
    console.warn(
      'gen-assets: could not generate cube.gltf (non-fatal — demo uses builtin:room).\n  ' +
        String(err),
    )
  }
}

// ── 3. Sample Gaussian splat (proves the DropInViewer path) ──────────────────
// Hand-writes a tiny scene in the antimatter15 `.splat` format (32 bytes/splat):
//   [0..11]  center  x,y,z   float32
//   [12..23] scale   x,y,z   float32 (linear std-dev)
//   [24..27] color   r,g,b,a uint8
//   [28..31] rotation w,x,y,z uint8, decoded as (b-128)/128 then normalized
// The shape is a colour sphere (normal-mapped) centred where splat-example's
// hotspots look — a clearly-3D, license-clean asset with zero downloads. A real
// scan (.ksplat from SuperSplat) drops in the same way; see the folder README.
const splatPath = join(SPLAT_ASSETS, 'scene.splat')
if (existsSync(splatPath)) {
  console.log('gen-assets: scene.splat exists, skipping')
} else {
  try {
    const N = 20000
    const radius = 0.8
    const cx = 0, cy = 0.8, cz = 0 // matches splat-example hotspot targets
    const splatScale = 0.06 // large enough that the splats overlap into a solid surface
    const buf = Buffer.alloc(N * 32)
    const golden = Math.PI * (1 + Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const k = i + 0.5
      const phi = Math.acos(1 - (2 * k) / N) // 0..π
      const theta = golden * k
      const nx = Math.sin(phi) * Math.cos(theta)
      const ny = Math.sin(phi) * Math.sin(theta)
      const nz = Math.cos(phi)

      const o = i * 32
      buf.writeFloatLE(cx + radius * nx, o)
      buf.writeFloatLE(cy + radius * ny, o + 4)
      buf.writeFloatLE(cz + radius * nz, o + 8)
      buf.writeFloatLE(splatScale, o + 12)
      buf.writeFloatLE(splatScale, o + 16)
      buf.writeFloatLE(splatScale, o + 20)
      // Normal-mapped colour, warmed slightly toward the app's copper accent.
      buf.writeUInt8(Math.min(255, Math.round((nx * 0.5 + 0.5) * 255 * 1.0)), o + 24)
      buf.writeUInt8(Math.round((ny * 0.5 + 0.5) * 255 * 0.85), o + 25)
      buf.writeUInt8(Math.round((nz * 0.5 + 0.5) * 255 * 0.8), o + 26)
      buf.writeUInt8(255, o + 27) // opaque
      // Identity rotation: w=+1 → 255, x=y=z=0 → 128.
      buf.writeUInt8(255, o + 28)
      buf.writeUInt8(128, o + 29)
      buf.writeUInt8(128, o + 30)
      buf.writeUInt8(128, o + 31)
    }
    writeFileSync(splatPath, buf)
    console.log(`gen-assets: wrote scene.splat (${N} splats, ${(buf.length / 1024) | 0} KB)`)
  } catch (err) {
    console.warn('gen-assets: could not generate scene.splat (non-fatal).\n  ' + String(err))
  }
}
