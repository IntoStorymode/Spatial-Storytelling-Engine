import { parseStory } from '../parser/parseStory'
import type { Story } from '../parser/types'
import { slugify, uniqueSlug } from './slug'

/**
 * One file in a picked bundle (a .zip's entries, or a folder's Files). `read` is
 * lazy on purpose: a site export carries a ~1 MB app-shell bundle we never touch,
 * and a scan can be hundreds of MB — only story.md and the assets a story actually
 * references are ever pulled into memory.
 */
export interface BundleEntry {
  /** Path as the source reports it, e.g. "demo-site/stories/demo/story.md". */
  path: string
  read: () => Promise<BlobPart>
  /** Zero-copy fast path: the folder adapter already holds a real File. */
  file?: File
  size?: number
}

export type Bundle = BundleEntry[]

/** A story recovered from a bundle — everything needed to build an editor snapshot. */
export interface ImportedStory {
  slug: string
  /** basePath is '' — assets live in memory, not in a directory. Legacy already migrated. */
  story: Story
  /** The 3D model, when `frontmatter.model` resolved to bytes in the bundle. */
  model: { path: string; file: File; format: string } | null
  /** Media keyed by the section `src` that points at it, e.g. "assets/entrance.svg". */
  media: Record<string, File>
  warnings: string[]
}

export interface ImportResult {
  stories: ImportedStory[]
  /** Bundle-level problems (nothing importable). Import never throws. */
  warnings: string[]
}

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
}

/** Extension → MIME. Zip bytes carry no type, and a typeless Blob URL can fail to render. */
export function mimeForPath(path: string): string {
  return MIME[ext(path)] ?? 'application/octet-stream'
}

function ext(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

function base(path: string): string {
  return path.split('/').pop() ?? path
}

/** Windows separators, doubled slashes, `./` and leading `/` — all flattened. Unicode → NFC. */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .normalize('NFC')
}

/** Zip directory entries and OS/archive cruft that must never be treated as content. */
export function isIgnorable(path: string): boolean {
  if (path.endsWith('/') || path === '') return true
  const segs = path.split('/')
  if (segs.includes('__MACOSX') || segs.includes('..')) return true
  const name = segs[segs.length - 1]
  return name === '.DS_Store' || name === 'Thumbs.db' || name.startsWith('._')
}

/**
 * Every story.md in the bundle, each scoping its own directory. Directory-driven
 * rather than reading `stories/index.json` (which can be stale or hand-edited) —
 * and it makes the site root irrelevant, so the same code handles a .zip, the
 * unzipped folder, or a parent folder containing it.
 */
export function findStoryDirs(paths: string[]): { dir: string; name: string }[] {
  return paths
    .filter((p) => p === 'story.md' || p.endsWith('/story.md'))
    .sort()
    .map((p) => {
      const dir = p.slice(0, p.length - 'story.md'.length) // keeps the trailing '/', or '' at the root
      const segs = dir.replace(/\/$/, '').split('/')
      return { dir, name: dir ? segs[segs.length - 1] : '' }
    })
}

/** Matches loadModel's resolveUrl: these load from where they point, not from the bundle. */
function isExternal(ref: string): boolean {
  return /^(https?|blob|data):/.test(ref) || ref.startsWith('/')
}

async function readText(entry: BundleEntry): Promise<string> {
  const part = entry.file ?? (await entry.read())
  if (typeof part === 'string') return part
  if (part instanceof Blob) return part.text()
  return new TextDecoder().decode(part as ArrayBuffer | ArrayBufferView)
}

async function toFile(entry: BundleEntry): Promise<File> {
  if (entry.file) return entry.file
  return new File([await entry.read()], base(entry.path), { type: mimeForPath(entry.path) })
}

/**
 * Find the bundle entry a story-relative `src` points at. Tolerant of percent-escapes
 * and of macOS folder picks, which hand back NFD filenames while story.md carries NFC —
 * without this, every accented or CJK asset name imports as "missing".
 */
function lookup(index: Map<string, BundleEntry>, ref: string): BundleEntry | undefined {
  const tries = [ref]
  try {
    tries.push(decodeURIComponent(ref))
  } catch {
    // A literal '%' in a filename — the raw ref is the only candidate.
  }
  for (const t of tries) {
    const hit = index.get(normalizePath(t))
    if (hit) return hit
  }
  return undefined
}

/**
 * Read exported stories back out of a bundle (an exported .zip, or the same site as
 * an unzipped folder). Each story.md is re-parsed with the current parser — so an old
 * export's inline `hotspot:`/`start:` cameras arrive migrated to named waypoints — and
 * its assets come back as real Files, exactly as if they'd been uploaded in the editor.
 *
 * Resilient by design: a bundle with nothing importable yields warnings, never a throw.
 */
export async function importSite(
  bundle: Bundle,
  opts: { takenSlugs?: Iterable<string> } = {},
): Promise<ImportResult> {
  const entries = bundle
    .map((e) => ({ ...e, path: normalizePath(e.path) }))
    .filter((e) => !isIgnorable(e.path))

  const dirs = findStoryDirs(entries.map((e) => e.path))
  if (!dirs.length) {
    return {
      stories: [],
      warnings: [
        'No story.md found. Pick an exported story — the .zip, or the folder containing stories/.',
      ],
    }
  }

  const taken = new Set(opts.takenSlugs ?? [])
  const stories: ImportedStory[] = []

  for (const { dir, name } of dirs) {
    const mdPath = dir + 'story.md'
    const md = entries.find((e) => e.path === mdPath)
    if (!md) continue

    const story = parseStory(await readText(md), '')
    const { frontmatter: fm, sections } = story
    const warnings = [...story.warnings]

    // Everything beside story.md in this story's folder, keyed the way story.md
    // refers to it ("assets/entrance.svg"). Files outside the folder — the app
    // shell, other stories — are structurally out of reach.
    const index = new Map<string, BundleEntry>()
    for (const e of entries) {
      if (e.path !== mdPath && e.path.startsWith(dir)) index.set(e.path.slice(dir.length), e)
    }

    let model: ImportedStory['model'] = null
    if (fm.model && !fm.model.startsWith('builtin:')) {
      if (isExternal(fm.model)) {
        warnings.push(`Model "${fm.model}" is an external path — it loads from there, not the bundle.`)
      } else {
        const hit = lookup(index, fm.model)
        if (hit) model = { path: fm.model, file: await toFile(hit), format: ext(fm.model) }
        else
          warnings.push(
            `Model "${fm.model}" is referenced but wasn't in the bundle — re-upload the scan in the editor.`,
          )
      }
    }

    const media: Record<string, File> = {}
    for (const s of sections) {
      const src = s.src
      if (!src || media[src]) continue
      if (isExternal(src)) {
        warnings.push(`Section "${s.title || s.id}": "${src}" is an external path — it wasn't bundled.`)
        continue
      }
      const hit = lookup(index, src)
      if (hit) media[src] = await toFile(hit)
      else
        warnings.push(
          `Section "${s.title || s.id}": "${src}" is referenced but wasn't in the bundle — re-upload it.`,
        )
    }

    const slug = uniqueSlug(name || slugify(fm.title), taken)
    taken.add(slug)
    stories.push({ slug, story, model, media, warnings })
  }

  return { stories, warnings: [] }
}
