import type { Frontmatter } from '../../parser/types'

interface Props {
  fm: Frontmatter
  onChange: (patch: Partial<Frontmatter>) => void
}

/** Story metadata: title, author, location, date. Lives in the "Story" step. */
export function StoryDetailsForm({ fm, onChange }: Props) {
  return (
    <div className="ed-fields">
      <label className="ed-field">
        <span>Title</span>
        <input value={fm.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label className="ed-field">
        <span>Author</span>
        <input value={fm.author} onChange={(e) => onChange({ author: e.target.value })} />
      </label>
      <div className="ed-row">
        <label className="ed-field">
          <span>Location</span>
          <input value={fm.location} onChange={(e) => onChange({ location: e.target.value })} />
        </label>
        <label className="ed-field">
          <span>Date</span>
          <input type="date" value={fm.date} onChange={(e) => onChange({ date: e.target.value })} />
        </label>
      </div>
    </div>
  )
}
