import JSZip from 'jszip'
import type { Bundle } from './importSite'

/**
 * An exported .zip → a Bundle. Entries stay compressed until `read()` is called,
 * so importSite only ever decompresses story.md and the assets a story references —
 * the app-shell chunks that make up most of the archive are never touched.
 */
export async function bundleFromZip(zip: Blob): Promise<Bundle> {
  const archive = await JSZip.loadAsync(zip)
  const entries: Bundle = []
  archive.forEach((path, entry) => {
    if (entry.dir) return
    // 'blob' keeps big scans off the JS heap.
    entries.push({ path, read: () => entry.async('blob') })
  })
  return entries
}

/**
 * A folder pick (`<input webkitdirectory>`) → a Bundle. Zero-copy: the browser
 * already handed us real Files, so nothing is read from disk until the viewer
 * fetches a blob URL. This is the cheap path for a very large scan.
 */
export function bundleFromDirectory(files: ArrayLike<File>): Bundle {
  return Array.from(files).map((file) => ({
    path: file.webkitRelativePath || file.name,
    file,
    size: file.size,
    read: () => Promise.resolve(file as BlobPart),
  }))
}

/** Folder picking is unavailable on some mobile browsers (notably iOS Safari). */
export function canPickDirectory(): boolean {
  return typeof HTMLInputElement !== 'undefined' && 'webkitdirectory' in HTMLInputElement.prototype
}

/**
 * A drag-and-drop → a Bundle. This is the one input that takes either shape: a
 * native file picker is *either* a file picker or a folder picker (webkitdirectory
 * switches the OS dialog), but a drop target accepts both, so dropping the .zip and
 * dropping the unzipped folder both land here.
 */
export async function bundleFromDrop(list: DataTransferItemList): Promise<Bundle> {
  // The item list is invalidated by the first await, so read it all synchronously.
  const dirs: FileSystemDirectoryEntry[] = []
  const files: File[] = []
  for (const item of Array.from(list)) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry?.isDirectory) dirs.push(entry as FileSystemDirectoryEntry)
    else {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  if (dirs.length) {
    const out: Bundle = []
    for (const dir of dirs) await walkDirectory(dir, out)
    if (!out.length) throw new Error('That folder is empty.')
    return out
  }

  const zip = files.find((f) => f.name.toLowerCase().endsWith('.zip'))
  if (zip) return bundleFromZip(zip)

  throw new Error('Drop an exported story — the .zip, or the folder you unzipped it into.')
}

async function walkDirectory(dir: FileSystemDirectoryEntry, out: Bundle): Promise<void> {
  const reader = dir.createReader()
  // readEntries hands back at most ~100 at a time; keep reading until it's dry.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (!batch.length) return
    for (const entry of batch) {
      if (entry.isDirectory) {
        await walkDirectory(entry as FileSystemDirectoryEntry, out)
      } else {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        )
        // fullPath is rooted ("/demo-site/…"); importSite normalizes the leading slash away.
        out.push({
          path: entry.fullPath,
          file,
          size: file.size,
          read: () => Promise.resolve(file as BlobPart),
        })
      }
    }
  }
}
