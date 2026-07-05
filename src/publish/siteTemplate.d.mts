// Type declarations for the plain-ESM siteTemplate.mjs so it can be imported
// from TypeScript (buildSite.ts) as well as from the Node CLI.
import type { Frontmatter } from '../parser/types'

export function siteDirName(slug: string): string
export function kioskScript(slug: string): string
export function injectKiosk(html: string, slug: string): string

export interface IndexEntry {
  id: string
  title: string
  author: string
  location: string
  date: string
  path: string
}
export function indexEntry(fm: Partial<Frontmatter>, slug: string): IndexEntry

export function deployMd(opts: { title: string; siteDir: string }): string
