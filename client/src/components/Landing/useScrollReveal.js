/**
 * useScrollReveal — Scroll-driven translate animation hook
 * Inspired by 21st.dev parallax/scroll-area patterns.
 *
 * Each element starts offset (left/right/down) and smoothly
 * slides into its final position as it enters the viewport.
 * Uses IntersectionObserver + CSS transitions for smooth 60fps perf.
 *
 * @param {object} options
 * @param {string}  options.offsetX   - Starting X offset e.g. '-80px', '60px' (default '-60px')
 * @param {string}  options.offsetY   - Starting Y offset e.g. '40px' (default '0px')
 * @param {number}  options.threshold - 0–1, how much must be visible to trigger (default 0.15)
 * @param {string}  options.delay     - CSS transition delay e.g. '0s', '0.1s' (default '0s')
 * @param {string}  options.duration  - CSS transition duration (default '0.65s')
 * @param {string}  options.easing    - CSS transition easing (default 'cubic-bezier(0.16,1,0.3,1)')
 */
import { useRef, useEffect, useState } from 'react'

export function useScrollReveal({
  offsetX = '-60px',
  offsetY = '0px',
  threshold = 0.15,
  delay = '0s',
  duration = '0.65s',
  easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
} = {}) {
  const ref = useRef(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setRevealed(entry.isIntersecting)
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const style = {
    transform: revealed ? 'translate(0, 0)' : `translate(${offsetX}, ${offsetY})`,
    opacity: revealed ? 1 : 0,
    transition: `transform ${duration} ${easing} ${delay}, opacity ${duration} ${easing} ${delay}`,
    willChange: 'transform, opacity',
  }

  return { ref, style, revealed }
}
