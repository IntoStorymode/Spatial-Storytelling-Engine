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
