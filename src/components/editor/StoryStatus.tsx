import { useState } from 'react'

interface Props {
  /** Readiness issues; empty = ready. */
  issues: string[]
}

/**
 * Header readiness pill. Green "Ready" only when there are no blocking issues;
 * otherwise a warning count that opens a checklist of what's still missing.
 */
export function StoryStatus({ issues }: Props) {
  const [open, setOpen] = useState(false)
  const ok = issues.length === 0

  return (
    <div className="story-status">
      <button
        type="button"
        className={ok ? 'btn status-btn status-ok' : 'btn status-btn status-warn'}
        onClick={() => setOpen((o) => !o)}
        title="Story readiness"
      >
        {ok ? '✓ Ready' : `⚠ ${issues.length}`}
      </button>
      {open && (
        <div className="export-pop status-pop">
          {ok ? (
            <p>Looks good — nothing blocking. Save it to your gallery or preview it.</p>
          ) : (
            <ul>
              {issues.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
