/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// COOP/COEP headers are required later (M5) for the Gaussian-splat renderer's
// SharedArrayBuffer-based GPU sort. Set now so the dev/preview env is stable.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  base: './',
  plugins: [react()],
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
