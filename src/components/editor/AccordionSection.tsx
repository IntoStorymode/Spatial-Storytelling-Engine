import type { ReactNode } from 'react'

interface Props {
  /** Step number shown before the title (e.g. "1"). */
  step: number
  title: string
  open: boolean
  onToggle: () => void
  /** Optional right-aligned status (e.g. a coverage count). */
  badge?: ReactNode
  children: ReactNode
}

/**
 * One collapsible step of the editor rail (Scene / Story / Waypoints / Publish).
 * Independently collapsible — several can be open at once — so the numbering
 * conveys the authoring order without forcing it.
 */
export function AccordionSection({ step, title, open, onToggle, badge, children }: Props) {
  return (
    <section className={open ? 'ed-acc ed-acc-open' : 'ed-acc'}>
      <button type="button" className="ed-acc-head" onClick={onToggle} aria-expanded={open}>
        <span className="ed-acc-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span className="ed-acc-step" aria-hidden="true">
          {step}
        </span>
        <span className="ed-acc-title">{title}</span>
        {badge != null && <span className="ed-acc-badge">{badge}</span>}
      </button>
      {open && <div className="ed-acc-body">{children}</div>}
    </section>
  )
}
