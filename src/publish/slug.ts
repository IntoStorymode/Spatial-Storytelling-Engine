/** Turn a title into a URL/folder-safe slug (shared by the editor + gallery). */
export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story'
}
