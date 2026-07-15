import { useEffect, useState } from 'react'

// Show the getting-started card once per browser session, not on every new story.
let shownThisSession = false

/**
 * A one-time, session-scoped orientation card for a first-time author, shown once
 * when a *new* story is opened. Mirrors TouchWalkHint's pattern — a module-level
 * guard + manual dismiss, with no persistence — and teaches the four editor steps
 * so the card and the rail's accordion say the same thing. It never reappears in
 * the same browser session.
 */
export function GettingStarted({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show || shownThisSession) return
    shownThisSession = true
    setVisible(true)
  }, [show])

  if (!visible) return null
  return (
    <aside className="getting-started" role="status">
      <button
        type="button"
        className="getting-started-x"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
      >
        ✕
      </button>
      <p className="getting-started-lead">New here? Four steps to a shareable story:</p>
      <ol className="getting-started-steps">
        <li>
          <strong>Scene</strong> — upload your 3D scan (or keep the placeholder room for now).
        </li>
        <li>
          <strong>Story</strong> — add sections of text, image, audio, or video.
        </li>
        <li>
          <strong>Waypoints</strong> — frame the scene and save the views each section flies to.
        </li>
        <li>
          <strong>Publish</strong> — Save to gallery, then Export a self-contained website.
        </li>
      </ol>
    </aside>
  )
}
