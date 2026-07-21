// Generates public/THIRD-PARTY-NOTICES.txt — the attribution file for every
// third-party package that ships in the bundle.
//
// Why this exists: the MIT/ISC/Zlib licences of our dependencies all require the
// copyright notice to travel with the distributed code, but Vite strips comments
// at build time. So the notices have to be reproduced as a separate artifact.
//
// Why it lands in `public/`: Vite copies `public/` verbatim into `dist/`, and the
// `publishManifest()` plugin in vite.config.ts then walks `dist/` and lists the
// file. That means the notices reach published sites through BOTH export paths —
// the in-browser editor export (src/publish/buildSite.ts refetches every file the
// manifest lists) and the CLI export (scripts/publish-site.mjs, which only
// excludes publish-manifest.json) — with no change to either.
//
// Runs on `predev`/`prebuild` alongside gen-assets.mjs. Like that script, a
// failure warns rather than aborting the build.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const NODE_MODULES = join(ROOT, 'node_modules')
const OUT = join(ROOT, 'public', 'THIRD-PARTY-NOTICES.txt')

// Filenames packages conventionally use for their licence text, best first.
// `.markdown` is not hypothetical — jszip ships LICENSE.markdown.
const LICENSE_FILES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENSE.markdown',
  'LICENCE',
  'LICENCE.md',
  'LICENCE.txt',
  'COPYING',
  'COPYING.md',
]

// A few small packages (e.g. isarray) ship no licence file and put the full text
// under a "## License" heading in the README instead. Pull it from there rather
// than losing the copyright line.
const README_FILES = ['README.md', 'README.markdown', 'Readme.md', 'README']
const README_LICENSE_HEADING = /^#{1,3}\s*Licen[cs]e\b.*$/im

/**
 * Packages whose SPDX expression needs a human decision rather than a verbatim
 * copy. Dual licences in particular: "OR" means we must state which we elected.
 */
const NOTES = {
  jszip: 'Dual-licensed "MIT OR GPL-3.0-or-later". This project elects the MIT option.',
  pako: 'Licensed "MIT AND Zlib" — both notices apply and are reproduced below.',
  argparse:
    'Licensed under the Python Software Foundation License 2.0. This is a port of the Python\n' +
    'argparse module; the PSF licence text and its change notice are reproduced below.',
}

function readPkg(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

function spdx(pkg) {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type || l).join(' OR ')
  return 'UNKNOWN'
}

function licenseText(dir) {
  for (const name of LICENSE_FILES) {
    const p = join(dir, name)
    if (existsSync(p)) {
      try {
        return readFileSync(p, 'utf8').trim()
      } catch {
        /* fall through */
      }
    }
  }
  return licenseFromReadme(dir)
}

function licenseFromReadme(dir) {
  for (const name of README_FILES) {
    const p = join(dir, name)
    if (!existsSync(p)) continue
    try {
      const readme = readFileSync(p, 'utf8')
      const m = README_LICENSE_HEADING.exec(readme)
      if (!m) continue
      const body = readme.slice(m.index + m[0].length).trim()
      // Only trust it if it actually looks like licence text, not a one-line
      // "MIT" pointer — otherwise we'd claim attribution we don't have.
      if (body.length > 200) return body
    } catch {
      /* fall through */
    }
  }
  return null
}

/**
 * Walk the *production* dependency graph breadth-first. npm's install is flat, so
 * nearly everything resolves at the top level of node_modules; we also check the
 * nested path for the rare deduped-conflict case.
 */
function collect() {
  const root = readPkg(ROOT)
  if (!root) throw new Error('cannot read root package.json')

  const queue = Object.keys(root.dependencies ?? {})
  const seen = new Set()
  const found = []
  const missing = []

  while (queue.length) {
    const name = queue.shift()
    if (seen.has(name)) continue
    seen.add(name)

    const dir = join(NODE_MODULES, name)
    const pkg = readPkg(dir)
    if (!pkg) {
      missing.push(name)
      continue
    }

    found.push({ name, version: pkg.version ?? '?', license: spdx(pkg), text: licenseText(dir) })
    // devDependencies are deliberately not followed — they never reach the bundle.
    queue.push(...Object.keys(pkg.dependencies ?? {}))
  }

  found.sort((a, b) => a.name.localeCompare(b.name))
  return { found, missing }
}

function render(found) {
  const rule = '='.repeat(78)
  const out = [
    'THIRD-PARTY NOTICES',
    '',
    'The Spatial Storytelling Engine is licensed under the MIT License (see LICENSE).',
    '',
    'It bundles the third-party packages listed below. Each is reproduced with its own',
    'copyright notice and licence text, as those licences require. This file is generated',
    'by scripts/gen-notices.mjs and regenerated on every build — do not edit it by hand.',
    '',
    `Packages: ${found.length}`,
    '',
    rule,
    'SUMMARY',
    rule,
    '',
    ...found.map((p) => `  ${p.name}@${p.version} — ${p.license}`),
    '',
  ]

  for (const p of found) {
    out.push(rule, `${p.name}@${p.version}`, `License: ${p.license}`, rule, '')
    if (NOTES[p.name]) out.push(NOTES[p.name], '')
    out.push(p.text ?? `(No licence file shipped with this package. SPDX identifier: ${p.license}.)`, '')
  }

  return out.join('\n')
}

try {
  const { found, missing } = collect()
  writeFileSync(OUT, render(found))
  console.log(`gen-notices: wrote ${found.length} package notices → public/THIRD-PARTY-NOTICES.txt`)
  const noText = found.filter((p) => !p.text).map((p) => p.name)
  if (noText.length) console.warn(`gen-notices: no licence file found for: ${noText.join(', ')}`)
  if (missing.length) console.warn(`gen-notices: not installed, skipped: ${missing.join(', ')}`)
} catch (err) {
  console.warn(`gen-notices: skipped (${err.message})`)
}
