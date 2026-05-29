import { useEffect, useRef, useCallback } from 'react'

/**
 * Auto-scrolls a container to bottom as content grows.
 * If user scrolls up, auto-scroll stops.
 * When user scrolls back to bottom, auto-scroll resumes.
 * When new content arrives after an empty period (new session), auto-scroll resets to active.
 */
export function useAutoScroll(deps: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const shouldFollow = useRef(true)
  const prevDeps = useRef(deps)

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    shouldFollow.current = atBottom
  }, [])

  useEffect(() => {
    const depsStr = typeof deps === 'string' ? deps : ''
    const prevStr = typeof prevDeps.current === 'string' ? prevDeps.current : ''
    // 新流式会话开始：内容从空变为非空时，重置为自动跟随
    if (depsStr && !prevStr) {
      shouldFollow.current = true
    }
    prevDeps.current = deps

    if (shouldFollow.current && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [deps])

  return { ref, handleScroll }
}
