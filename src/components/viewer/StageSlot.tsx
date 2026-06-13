import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useStage } from './stageContext'

/**
 * A mount point for the persistent 3D host. On mount it imperatively appends
 * the single `hostEl` (canvas + WebGL context) into itself; because the node is
 * MOVED rather than recreated, the context survives Mode A ⇄ Mode B toggles.
 * Only one StageSlot is mounted at a time (PageView OR ImmersiveView).
 */
export function StageSlot({ className, style }: { className?: string; style?: CSSProperties }) {
  const { hostEl } = useStage()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const slot = ref.current
    if (slot && hostEl.parentNode !== slot) slot.appendChild(hostEl)
    // No cleanup: the next slot to mount will move hostEl into itself. Leaving
    // it attached to an unmounting node just detaches it harmlessly until then.
  }, [hostEl])

  return <div ref={ref} className={className} style={style} />
}
