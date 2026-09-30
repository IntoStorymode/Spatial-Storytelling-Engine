/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative, sep } from 'node:path'

// Emit dist/publish-manifest.json listing every generic app-shell file (all of
// dist/ EXCEPT the per-story `stories/` data, the `collections/` data, and the
// manifest itself). The editor's export flow fetches this list to re-zip the
// running app's shell together with the selected stories — no rebuild, no CLI.
// Runs on every `vite build`, so `preview` and `publish:site` get it for free.
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
            // Content, not shell. Vite copies public/ verbatim into dist/, so
            // without this the manifest would list every collection file and the
            // browser export would re-zip them into EVERY site — single-story
            // exports included — as well as churning appVersion.
            if (rel !== 'stories' && rel !== 'collections') walk(abs)
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
  build: {
    // A second entry for the VR viewer. It's a separate page, not a route: WebXR
    // requires setAnimationLoop and owns the camera, neither of which the shared
    // ThreeViewer can offer. publishManifest() sweeps all of dist/, so vr.html is
    // carried into every exported site for free — no change to buildSite.ts.
    rollupOptions: {
      input: { main: 'index.html', vr: 'vr.html' },
    },
  },
  test: {
    environment: 'node',
  },
})
