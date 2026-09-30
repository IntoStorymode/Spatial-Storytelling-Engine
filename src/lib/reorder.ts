/**
 * Move one item up or down a list by one place, returning a new array.
 *
 * A no-op at either end (rather than wrapping), which is what the ↑/↓ controls
 * want: the buttons disable there, and a stray keypress shouldn't teleport an
 * item to the other end. Never mutates the input.
 */
export function moveInList<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const swap = index + dir
  if (index < 0 || index >= list.length || swap < 0 || swap >= list.length) return list
  const next = [...list]
  ;[next[index], next[swap]] = [next[swap], next[index]]
  return next
}
