import { describe, it, expect } from 'vitest'
import { injectPublishedMarker, injectKiosk } from './siteTemplate.mjs'

const MARKER = `<script>window.__SSP_PUBLISHED__=true</script>`

describe('injectPublishedMarker', () => {
  it('inserts the marker just before the app module script', () => {
    const html = `<head></head><body><script type="module" src="/assets/index.js"></script></body>`
    const out = injectPublishedMarker(html)
    expect(out).toContain(MARKER)
    // marker runs before the module entry, so the global is set before React mounts
    expect(out.indexOf(MARKER)).toBeLessThan(out.indexOf('<script type="module"'))
  })

  it('falls back to before </head> when there is no module script', () => {
    const out = injectPublishedMarker(`<head><title>x</title></head><body></body>`)
    expect(out).toContain(MARKER)
    expect(out.indexOf(MARKER)).toBeLessThan(out.indexOf('</head>'))
  })

  it('coexists with the kiosk redirect (single-story export)', () => {
    const html = `<head></head><script type="module" src="/assets/index.js"></script>`
    const out = injectPublishedMarker(injectKiosk(html, 'my-story'))
    expect(out).toContain(MARKER)
    expect(out).toContain(`#/story/my-story`)
  })
})
