import { useEffect, useState } from 'react'
import { parseStory } from './parser/parseStory'
import type { Story } from './parser/types'

/**
 * M1 sanity check: fetch + parse the demo story and render its structure.
 * The real Home / Mode A / Mode B UI arrives in M3–M4.
 */
export default function App() {
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/stories/demo/story.md')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load story.md (HTTP ${r.status})`)
        return r.text()
      })
      .then((raw) => setStory(parseStory(raw, '/stories/demo/')))
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <pre style={{ color: 'tomato', padding: 24 }}>{error}</pre>
  if (!story) return <p style={{ padding: 24, fontFamily: 'system-ui' }}>Loading…</p>

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <p style={{ opacity: 0.5, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        M1 data-core sanity check — full UI lands in M3
      </p>
      <h1 style={{ marginBottom: 4 }}>{story.frontmatter.title}</h1>
      <p style={{ opacity: 0.7 }}>
        {story.frontmatter.author} · {story.frontmatter.location} · {story.frontmatter.date}
      </p>
      <p>
        model: <code>{story.frontmatter.model}</code>
      </p>
      <ol>
        {story.items.map((it) => (
          <li key={it.id} style={{ marginBottom: 8 }}>
            <strong>{it.title}</strong> — <em>{it.type}</em>
            {it.src ? (
              <>
                {' · '}
                <code>{it.src}</code>
              </>
            ) : null}
            <br />
            {it.hotspot
              ? `hotspot → position [${it.hotspot.position.join(', ')}], target [${it.hotspot.target.join(', ')}]`
              : 'no hotspot'}
          </li>
        ))}
      </ol>
      {story.warnings.length > 0 && (
        <pre style={{ color: 'orange', whiteSpace: 'pre-wrap' }}>{story.warnings.join('\n')}</pre>
      )}
    </main>
  )
}
