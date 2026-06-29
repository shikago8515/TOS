export function applyTheme(isDark: boolean): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('dark', isDark)
}

export async function toggleDarkModeWithTransition(
  event: MouseEvent,
  isDark: boolean,
  setDark: (value: boolean) => void,
): Promise<void> {
  const nextDark = !isDark

  if (
    typeof document === 'undefined' ||
    !document.startViewTransition ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    setDark(nextDark)
    applyTheme(nextDark)
    return
  }

  const x = event.clientX
  const y = event.clientY
  const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const transition = document.startViewTransition(() => {
    setDark(nextDark)
    applyTheme(nextDark)
  })

  await transition.ready

  const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
  document.documentElement.animate(
    {
      clipPath: nextDark ? clipPath : [...clipPath].reverse(),
    },
    {
      duration: 300,
      easing: 'ease-in',
      fill: 'both',
      pseudoElement: nextDark ? '::view-transition-new(root)' : '::view-transition-old(root)',
    },
  )
}

