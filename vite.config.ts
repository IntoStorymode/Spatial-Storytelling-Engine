/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative, sep } from 'node:path'

// COOP/COEP headers are required later (M5) for the Gaussian-splat renderer's
// SharedArrayBuffer-based GPU sort. Set now so the dev/preview env is stable.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// Emit dist/publish-manifest.json listing every generic app-shell file (all of
// dist/ EXCEPT the per-story `stories/` data and the manifest itself). The
// editor's one-click "Download website" fetches this list to re-zip the running
// app's shell together with a single story — no rebuild, no CLI. Runs on every
// `vite build`, so `preview` and `publish:site` get it for free.
function publishManifest(): Plugin {
  return {
    name: 'publish-manifest',
    apply: 'build',
    closeBundle() {
      const dist = join(process.cwd(), 'dist')
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const abs = join(dir, name)
          const rel = relative(dist, abs).split(sep).join('/')
          if (statSync(abs).isDirectory()) {
            if (rel !== 'stories') walk(abs)
          } else if (rel !== 'publish-manifest.json') {
            files.push(rel)
          }
        }
      }
      walk(dist)
      files.sort()
      // Content-hashed asset names already change per build; hashing the file
      // list gives a stable id an author's export can be checked against later.
      const appVersion = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      writeFileSync(
        join(dist, 'publish-manifest.json'),
        JSON.stringify({ appVersion, files }, null, 2),
      )
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), publishManifest()],
  test: {
    environment: 'node',
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
})
