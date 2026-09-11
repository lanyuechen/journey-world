const DEFAULT_DURATION = 280
const DEFAULT_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Snapshot getBoundingClientRect for every [data-flip-id] under root. */
export function captureFlipRects(root = document) {
  const map = new Map()
  root.querySelectorAll('[data-flip-id]').forEach((el) => {
    const id = el.getAttribute('data-flip-id')
    if (!id) return
    map.set(id, el.getBoundingClientRect())
  })
  return map
}

function rectDelta(first, last) {
  const dx = first.left - last.left
  const dy = first.top - last.top
  const sx = first.width / last.width
  const sy = first.height / last.height
  const meaningful = !(
    Math.abs(dx) < 0.5
    && Math.abs(dy) < 0.5
    && Math.abs(sx - 1) < 0.005
    && Math.abs(sy - 1) < 0.005
  )
  return { dx, dy, sx, sy, meaningful }
}

/**
 * FLIP: invert from firstRects to current layout, then play transform to identity.
 * Only animates innermost changed nodes so nested cards do not double-transform.
 */
export function playFlip(firstRects, {
  root = document,
  duration = DEFAULT_DURATION,
  easing = DEFAULT_EASING,
} = {}) {
  if (!firstRects?.size) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const movers = []
  root.querySelectorAll('[data-flip-id]').forEach((el) => {
    const id = el.getAttribute('data-flip-id')
    const first = firstRects.get(id)
    if (!first) return

    const last = el.getBoundingClientRect()
    if (first.width < 1 || first.height < 1 || last.width < 1 || last.height < 1) return

    const delta = rectDelta(first, last)
    if (!delta.meaningful) return
    movers.push({ el, ...delta })
  })

  // Prefer leaves: skip any node that contains another mover.
  const animated = movers.filter(({ el }) => (
    !movers.some(({ el: other }) => other !== el && el.contains(other))
  ))

  animated.forEach(({ el, dx, dy, sx, sy }) => {
    el.getAnimations().forEach((animation) => animation.cancel())
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: 'translate(0px, 0px) scale(1, 1)' },
      ],
      { duration, easing, fill: 'none' },
    )
  })
}
