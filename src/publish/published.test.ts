import { describe, it, expect, afterEach } from 'vitest'
import { isPublishedSite } from './published'

// vitest runs in Node (no window); stub globalThis.window to exercise both paths.
const g = globalThis as { window?: { __SSP_PUBLISHED__?: boolean } }

afterEach(() => {
  delete g.window
})

describe('isPublishedSite', () => {
  it('is false when no window (SSR/tests) and when the marker is absent', () => {
    expect(isPublishedSite()).toBe(false)
    g.window = {}
    expect(isPublishedSite()).toBe(false)
  })

  it('is true only when window.__SSP_PUBLISHED__ === true', () => {
    g.window = { __SSP_PUBLISHED__: true }
    expect(isPublishedSite()).toBe(true)
  })
})
