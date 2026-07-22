/**
 * Resolve a story-relative asset path against the story's basePath.
 *
 * Lives here rather than in `three/loadModel` because the content blocks
 * (image/audio/video) and the VR entry all need it, and importing it from the
 * model loader dragged `three` into their dependency graph for one line of
 * string handling.
 *
 * Absolute forms are passed through untouched: `http(s):` for remote assets,
 * `blob:`/`data:` for files the author just uploaded in the editor (which have
 * no path to resolve), and a leading `/` for host-absolute paths.
 */
export function resolveUrl(url: string, basePath: string): string {
  if (/^(https?|blob|data):/.test(url) || url.startsWith('/')) return url
  return basePath.replace(/\/?$/, '/') + url
}
