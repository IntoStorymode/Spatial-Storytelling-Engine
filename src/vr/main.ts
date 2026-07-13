import { parseStory } from '../parser/parseStory'
import type { Story } from '../parser/types'
import { VRStoryViewer, type VRStats } from './VRStoryViewer'
import './vr.css'

interface IndexEntry {
  id: string
  title: string
  path: string
}

/**
 * The VR entry (vr.html) — a separate page, not a route in the SPA.
 *
 * WebXR needs `renderer.setAnimationLoop` and owns the camera every frame; the
 * shared ThreeViewer uses requestAnimationFrame, renders on demand, and lets
 * camera-controls write camera.position. Retrofitting a session into it would mean
 * rewriting the camera contract (getView / flyTo / placeFirstPerson). So VR lives
 * here instead, reusing the parser and loaders import-only and touching nothing.
 *
 * Open with ?story=<slug>. Both the app and this page read the same
 * stories/index.json, and vr.html is swept into every exported site by the publish
 * manifest — so a published story carries its VR view with it.
 */
const params = new URLSearchParams(location.search)
const root = document.getElementById('vr-root')!
const requested = params.get('story')

/**
 * Framerate tuning, taken from the URL so it can be A/B'd inside the headset — a rebuild
 * and redeploy per experiment costs minutes and a headset on/off each time.
 *
 *   ?scale=0.7   XR framebuffer scale (fewer pixels to shade)
 *   ?fov=1       foveation 0..1 (blur the periphery, which the lenses blur anyway)
 *   ?alpha=20    drop splats fainter than this AT LOAD — i.e. fewer splats to sort
 *
 * Measured on a Quest 3: scale and fov barely move a splat scene, which rules OUT
 * fill-rate. What's left is the per-frame depth sort — forced onto a CPU worker because
 * the library disables its GPU sort in any XR session — and that scales with splat COUNT.
 * Hence `alpha`: it's the only knob that changes the number of splats.
 */
const tuning = {
  scale: clamp(Number(params.get('scale') ?? 1), 0.3, 2),
  fov: clamp(Number(params.get('fov') ?? 1), 0, 1),
  alpha: clamp(Number(params.get('alpha') ?? 1), 1, 255),
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo
}

/** WebXR is only exposed in a secure context — so not over file://, and not over http://<LAN-IP>. */
const xrAvailable = 'xr' in navigator

/** Set once the story resolves, so error/hint copy can name it. */
let slug = requested ?? ''

boot().catch((e) => fail(String(e)))

async function boot(): Promise<void> {
  chrome('Loading story…', '')
  const story = await loadStory()

  // Paint the chrome BEFORE creating the stage — chrome() replaces root's contents,
  // so a stage appended first would be detached (and size to zero) the moment it ran.
  chrome(story.frontmatter.title || slug, describe(story))
  const stage = document.createElement('div')
  stage.className = 'vr-stage'
  root.append(stage)

  if (!xrAvailable) note(questHint())

  const viewer = new VRStoryViewer(stage, story, tuning, showStats)
  await viewer.load()
}

/**
 * Resolve which story to open, then fetch it the same way the SPA's ViewerRoute does.
 *
 * Two deliberate departures from a plain lookup:
 *
 * - **No ?story= means "the story this site is about."** A published single-story site
 *   is a kiosk: publish-site prunes stories/index.json down to that one story, so a
 *   hard-coded default like "demo" 404s on every exported site. Defaulting to the
 *   first (often only) entry makes a bare /vr.html the right URL to hand someone.
 * - **An unregistered slug falls back to the conventional path.** The real scans worth
 *   testing in a headset are gitignored and absent from the tracked index.json, because
 *   their assets aren't in the repo and a registered entry would 404 for anyone who
 *   cloned it. Convention over registry lets a local story open with nothing committed.
 */
async function loadStory(): Promise<Story> {
  const res = await fetch('stories/index.json')
  const entries: IndexEntry[] = res.ok ? ((await res.json()).stories ?? []) : []

  const entry = requested ? entries.find((s) => s.id === requested) : entries[0]
  slug = entry?.id ?? requested ?? ''
  if (!slug) {
    throw new Error(
      'This site has no stories in stories/index.json, and no ?story= was given.',
    )
  }
  const path = entry?.path ?? `stories/${slug}/story.md`

  const md = await fetch(path)
  if (!md.ok) {
    const known = entries.map((e) => e.id).join(', ') || 'none'
    throw new Error(
      `No story at "${path}" (HTTP ${md.status}). This site has: ${known}. ` +
        `Open /vr.html?story=<one of those>.`,
    )
  }
  return parseStory(await md.text(), path.replace(/[^/]+$/, ''))
}

function describe(story: Story): string {
  const { model } = story.frontmatter
  const n = story.sections.length
  const waypoints = story.frontmatter.waypoints?.length ?? 0
  return `${model} · ${n} section${n === 1 ? '' : 's'} · ${waypoints} waypoint${waypoints === 1 ? '' : 's'}`
}

/** Title + subtitle above the stage. The library/three appends its own Enter-VR button. */
function chrome(title: string, sub: string): void {
  root.innerHTML = `
    <header class="vr-head">
      <p class="vr-eyebrow">VR spike</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="vr-sub">${escapeHtml(sub)}</p>
      <p class="vr-stats" id="vr-stats"></p>
      <p class="vr-note" id="vr-note"></p>
    </header>`
}

function showStats(s: VRStats): void {
  const el = document.getElementById('vr-stats')
  if (!el) return
  const splats = s.splats ? `${(s.splats / 1e6).toFixed(2)}M splats · ` : ''
  el.textContent =
    `${s.fps} fps · ${s.backend} · ${splats}loaded in ${(s.loadMs / 1000).toFixed(1)}s · ` +
    `scale ${tuning.scale} · foveation ${tuning.fov} · alpha ${tuning.alpha}`
}

function note(msg: string): void {
  const el = document.getElementById('vr-note')
  if (el) el.textContent = msg
}

/**
 * Shown when navigator.xr is missing — which is the normal case on a desktop browser,
 * and the confusing case on a headset reached over http://<LAN-IP>. WebXR is only
 * exposed in a SECURE CONTEXT: https, or localhost. A LAN address is neither, which is
 * why the headset must be pointed at localhost through an adb tunnel.
 */
function questHint(): string {
  const port = location.port || '5174'
  const url = `localhost:${port}/vr.html?story=${slug}`
  return (
    'No WebXR here — showing the flat preview. WebXR needs a secure context, so a headset ' +
    `browser on http://<your-LAN-IP> will NOT see it either. On a Quest: enable developer mode, ` +
    `run "adb reverse tcp:${port} tcp:${port}", then open ${url} in the Quest browser. ` +
    'Or publish the story and open the HTTPS URL.'
  )
}

function fail(msg: string): void {
  root.innerHTML = `<header class="vr-head"><h1>Can't open this story</h1><p class="vr-note">${escapeHtml(msg)}</p></header>`
}

function escapeHtml(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}
