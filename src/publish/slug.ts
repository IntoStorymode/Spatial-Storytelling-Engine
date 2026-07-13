/**
 * Turn text into a URL/folder-safe slug, or '' when nothing usable survives.
 *
 * Deliberately ASCII-only. A slug here is not just a URL — it names a folder inside
 * the exported zip, which is unzipped onto a disk and served from someone else's
 * static host, then read back on import. Non-ASCII folder names survive that trip
 * unreliably (macOS stores NFD while the markdown carries NFC, and legacy zip tools
 * mangle UTF-8 entry names), so a title with no Latin characters slugifies to nothing
 * and the author is asked to name the export themselves. Transliterating CJK would
 * need a dictionary — i.e. a dependency this project does without.
 */
export function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** toSlug with a last-resort fallback, for places that must yield *some* name. */
export function slugify(title: string): string {
  return toSlug(title) || 'story'
}

/** A date-derived suggestion for a title that slugifies to nothing (e.g. "story-2026-07-13"). */
export function suggestSlug(date: string): string {
  return slugify(`story-${date}`)
}

/**
 * A slug not already in `taken`: "demo" → "demo-2" → "demo-3". The gallery upserts
 * by slug, so importing a story whose slug is already saved would silently replace
 * it — this keeps the two side by side instead.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const root = slugify(base)
  if (!used.has(root)) return root
  let n = 2
  while (used.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}
