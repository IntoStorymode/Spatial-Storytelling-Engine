/**
 * TEMPORARY splat-performance diagnostic harness (branch: diagnostic/splat-perf).
 *
 * Reads experiment flags from the URL so we can A/B the splat render path across
 * devices (desktop Chrome vs iPad) WITHOUT a rebuild. Flags are read from both the
 * normal query string AND the query part of the hash route, so appending
 * `?debug&spin=1` works after either — e.g.
 *   /?debug&spin=1#/story/greenwich-exhibition
 *   /#/story/greenwich-exhibition?debug&spin=1
 *
 * Flags:
 *   ?debug        show the DebugHud overlay (FPS, buffer size, GPU, isolation…)
 *   ?spin=1       force continuous rendering + a slow auto-orbit (identical motion
 *                 on both devices → comparable steady-state FPS)
 *   ?dpr=<n>      force an exact renderer pixel ratio (isolates fill-rate/overdraw)
 *   ?highpower=0  force WebGLRenderer powerPreference back to the browser default —
 *                 reproduces the pre-fix choppiness. The viewer now defaults to
 *                 'high-performance' (highPower true unless ?highpower=0 is set).
 *   ?sortms=<n>   Spark's minSortIntervalMs — floor on how often the splat depth
 *                 sort re-runs. Decouples sort rate from frame rate, a lever the
 *                 previous library had no equivalent for.
 *   ?aa=0         turn WebGL antialiasing off. Spark recommends AA off for splats,
 *                 but measured on Greenwich it made no fps difference — we are not
 *                 fill-rate bound — so AA stays on, which is what meshes want too.
 *                 The flag remains for re-measuring on other hardware.
 *
 * The diagnosis (2026-07): desktop choppiness was frame-pacing from Chrome binding
 * the integrated GPU. The fix — 'high-performance' by default — ships in
 * ThreeViewer; this harness stays for future perf work.
 *
 * Removed with the Spark migration: ?alpha (Spark has no splatAlphaRemovalThreshold)
 * and ?gpusort (Spark's WASM counting sort has no SharedArrayBuffer fast path to
 * opt into — that whole class of flag is gone).
 */
export interface DebugTuning {
  debug: boolean
  spin: boolean
  dpr: number | null
  /** Renderer powerPreference: true → 'high-performance' (default), false → 'default'. */
  highPower: boolean
  /** Floor on Spark's splat re-sort interval, in ms. null → Spark's own default. */
  sortMs: number | null
  /** WebGL antialiasing: on by default; ?aa=0 turns it off to A/B splat fill rate. */
  aa: boolean
}

function readParams(): URLSearchParams {
  const merged = new URLSearchParams(window.location.search)
  const hash = window.location.hash
  const q = hash.indexOf('?')
  if (q >= 0) {
    new URLSearchParams(hash.slice(q + 1)).forEach((v, k) => merged.set(k, v))
  }
  return merged
}

const isOn = (p: URLSearchParams, k: string): boolean => {
  const v = p.get(k)
  return v === '' || v === '1' || v === 'true'
}

const num = (p: URLSearchParams, k: string): number | null => {
  const v = p.get(k)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Tri-state boolean: absent → default; '0'/'false' → false; anything else → true.
const boolOr = (p: URLSearchParams, k: string, dflt: boolean): boolean => {
  const v = p.get(k)
  if (v === null) return dflt
  return v !== '0' && v !== 'false'
}

let cached: DebugTuning | null = null

/** Parsed URL flags (cached; they only change on reload). */
export function debugTuning(): DebugTuning {
  if (cached) return cached
  const p = readParams()
  cached = {
    debug: p.has('debug'),
    spin: isOn(p, 'spin'),
    dpr: num(p, 'dpr'),
    highPower: boolOr(p, 'highpower', true),
    sortMs: num(p, 'sortms'),
    aa: boolOr(p, 'aa', true),
  }
  return cached
}
