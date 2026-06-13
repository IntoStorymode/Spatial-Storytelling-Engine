import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface StoryIndexEntry {
  id: string
  title: string
  author: string
  location: string
  date: string
  path: string
}

/**
 * Home (screen 1) — lists the stories registered in public/stories/index.json.
 * No backend: the registry is a static JSON file the author edits by hand.
 */
export function HomeRoute() {
  const [stories, setStories] = useState<StoryIndexEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/stories/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load story index (HTTP ${r.status})`)
        return r.json()
      })
      .then((data) => setStories(data.stories ?? []))
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <main className="home">
      <header className="home-head">
        <p className="eyebrow">Spatial Storytelling</p>
        <h1 className="home-title">A scan is shared infrastructure.<br />A story is an act of authorship.</h1>
        <p className="home-sub">
          One Markdown file drives two ways to read the same place — a long-form page with
          the model inline, or an immersive scene you move through. Pick a story to begin.
        </p>
      </header>

      {error && <p className="state">{error}</p>}
      {!error && !stories && <p className="state">Loading stories…</p>}
      {stories && stories.length === 0 && (
        <p className="state">No stories yet. Add one to public/stories/index.json.</p>
      )}

      {stories && stories.length > 0 && (
        <div className="story-grid">
          {stories.map((s) => (
            <Link key={s.id} to={`/story/${s.id}`} className="story-card">
              <p className="eyebrow">Story</p>
              <h2>{s.title}</h2>
              <div className="meta">
                {s.author}
                <br />
                {s.location} · {s.date}
              </div>
              <span className="cta">Read →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
