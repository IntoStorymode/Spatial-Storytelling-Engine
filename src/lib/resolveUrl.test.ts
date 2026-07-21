import { describe, expect, it } from 'vitest'
import { resolveUrl } from './resolveUrl'

describe('resolveUrl', () => {
  it('joins a relative path onto the story basePath', () => {
    expect(resolveUrl('assets/scene.ksplat', '/stories/demo/')).toBe('/stories/demo/assets/scene.ksplat')
  })

  it('adds the missing separator when basePath has no trailing slash', () => {
    expect(resolveUrl('assets/a.jpg', '/stories/demo')).toBe('/stories/demo/assets/a.jpg')
  })

  it('does not double the separator when basePath already ends in one', () => {
    expect(resolveUrl('assets/a.jpg', '/stories/demo/')).toBe('/stories/demo/assets/a.jpg')
  })

  it.each([
    'https://example.com/scene.ply',
    'http://example.com/scene.ply',
    // Editor uploads have no path to resolve — they must pass through untouched.
    'blob:http://localhost:5173/2b0c8a1e-0000',
    'data:application/octet-stream;base64,AAAA',
    '/absolute/from/host/root.glb',
  ])('passes %s through unchanged', (url) => {
    expect(resolveUrl(url, '/stories/demo/')).toBe(url)
  })

  it('handles an empty basePath', () => {
    expect(resolveUrl('story.md', '')).toBe('/story.md')
  })
})
