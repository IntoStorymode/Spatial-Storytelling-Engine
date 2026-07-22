import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `debugTuning()` caches on first call (the URL can't change without a reload),
 * so each case resets the module registry and re-imports to get a fresh read.
 *
 * A minimal `window.location` stub is enough — the module only touches `search`
 * and `hash` — which keeps these tests in the fast `node` environment rather
 * than pulling in a full DOM.
 */
async function tuningFor(search: string, hash = '') {
  vi.resetModules()
  // @ts-expect-error - minimal stub; debugTuning only reads search + hash
  globalThis.window = { location: { search, hash } }
  const { debugTuning } = await import('./debugTuning')
  return debugTuning()
}

afterEach(() => {
  // @ts-expect-error - remove the stub so it can't leak into other suites
  delete globalThis.window
})

describe('debugTuning', () => {
  it('defaults to no diagnostics and high-performance GPU', async () => {
    const t = await tuningFor('')
    expect(t).toEqual({
      debug: false,
      spin: false,
      dpr: null,
      highPower: true,
      sortMs: null,
      aa: true,
    })
  })

  it('reads flags from the plain query string', async () => {
    const t = await tuningFor('?debug&spin=1&dpr=1.5')
    expect(t.debug).toBe(true)
    expect(t.spin).toBe(true)
    expect(t.dpr).toBe(1.5)
  })

  it('reads flags from the query part of a hash route', async () => {
    // Both orderings must work: /?debug#/story/x and /#/story/x?debug
    const t = await tuningFor('', '#/story/greenwich-exhibition?debug&spin=1')
    expect(t.debug).toBe(true)
    expect(t.spin).toBe(true)
  })

  it('lets the hash query override the plain query', async () => {
    const t = await tuningFor('?dpr=1', '#/story/x?dpr=2')
    expect(t.dpr).toBe(2)
  })

  it('treats a bare flag, =1 and =true as on', async () => {
    expect((await tuningFor('?spin')).spin).toBe(true)
    expect((await tuningFor('?spin=1')).spin).toBe(true)
    expect((await tuningFor('?spin=true')).spin).toBe(true)
  })

  it('treats =0 and =false as off', async () => {
    expect((await tuningFor('?spin=0')).spin).toBe(false)
    expect((await tuningFor('?spin=false')).spin).toBe(false)
  })

  it('is tri-state for highpower: absent defaults on, =0 forces off', async () => {
    expect((await tuningFor('')).highPower).toBe(true)
    expect((await tuningFor('?highpower=0')).highPower).toBe(false)
    expect((await tuningFor('?highpower=false')).highPower).toBe(false)
    expect((await tuningFor('?highpower=1')).highPower).toBe(true)
  })

  it('ignores non-numeric numeric flags rather than yielding NaN', async () => {
    const t = await tuningFor('?dpr=abc&sortms=xyz')
    expect(t.dpr).toBeNull()
    expect(t.sortMs).toBeNull()
  })

  it('reads a bare `?dpr=` as 0, not null (Number("") === 0)', async () => {
    // Recording current behaviour, not endorsing it: `?dpr=` would reach
    // renderer.setPixelRatio(0). Only reachable by typing the flag with an
    // empty value, so it is left alone here — this PR changes no behaviour.
    const t = await tuningFor('?dpr=&sortms=')
    expect(t.dpr).toBe(0)
    expect(t.sortMs).toBe(0)
  })

  it('reads ?sortms as Spark’s minimum re-sort interval', async () => {
    expect((await tuningFor('?sortms=32')).sortMs).toBe(32)
    expect((await tuningFor('')).sortMs).toBeNull()
  })

  it('is tri-state for aa: absent defaults ON, =0 turns antialiasing off', async () => {
    // Deliberately NOT defaulted off. Spark wants AA off for splats, but the
    // renderer is built before the story's format is known and meshes benefit.
    expect((await tuningFor('')).aa).toBe(true)
    expect((await tuningFor('?aa=0')).aa).toBe(false)
    expect((await tuningFor('?aa=false')).aa).toBe(false)
    expect((await tuningFor('?aa=1')).aa).toBe(true)
  })

  it('caches — a second call does not re-read the URL', async () => {
    vi.resetModules()
    // @ts-expect-error - minimal stub
    globalThis.window = { location: { search: '?dpr=1', hash: '' } }
    const { debugTuning } = await import('./debugTuning')
    expect(debugTuning().dpr).toBe(1)
    globalThis.window.location.search = '?dpr=2'
    expect(debugTuning().dpr).toBe(1)
  })
})
