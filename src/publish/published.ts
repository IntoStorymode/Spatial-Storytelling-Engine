// Whether the app is running as a *published* (exported/hosted) site — a
// read-only deployment with no authoring UI. The export pipeline injects
// `window.__SSP_PUBLISHED__ = true` into index.html before the app loads (see
// injectPublishedMarker in siteTemplate.mjs); a plain build (dev / preview / a
// hosted editor) carries no marker, so this returns false there.

declare global {
  interface Window {
    __SSP_PUBLISHED__?: boolean
  }
}

/** True on an exported/hosted site → hide authoring controls and guard /edit routes. */
export function isPublishedSite(): boolean {
  return typeof window !== 'undefined' && window.__SSP_PUBLISHED__ === true
}
