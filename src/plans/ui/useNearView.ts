import { useEffect, useRef, useState } from 'react'

/**
 * True once the element is on screen or close to it, so a long plan's page pictures load as you scroll
 * instead of all at once. Without IntersectionObserver everything counts as visible.
 */
export function useNearView<T extends Element>(force = false): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(force || typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (force) setSeen(true)
  }, [force])
  useEffect(() => {
    if (seen || !ref.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setSeen(true)
    }, { rootMargin: '600px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen]
}
