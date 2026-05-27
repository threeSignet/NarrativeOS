import { useEffect, useRef, useCallback } from 'react'

/**
 * Auto-scrolls a container to bottom as content grows.
 * If user scrolls up, auto-scroll stops.
 * When user scrolls back to bottom, auto-scroll resumes.
 */
export function useAutoScroll(deps: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const shouldFollow = useRef(true)

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    shouldFollow.current = atBottom
  }, [])

  useEffect(() => {
    if (shouldFollow.current && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [deps])

  return { ref, handleScroll }
}
