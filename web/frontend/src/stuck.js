// useStuck — is this `position: sticky` element parked at its offset right now?
//
// ONE ANSWER FOR THE TAB ROW AND THE TOOLBAR UNDER IT. The toolbar used an
// IntersectionObserver with a root margin read once from its own `top`; its top is
// now "under the top bar AND under the stuck tab row", a height measured at run
// time, and a margin fixed at mount cannot follow it. A scroll check reads the
// offset every time, so both elements ask the same question the same way.
//
// NOT STUCK AT THE TOP OF THE PAGE, even if something happens to sit exactly at
// its offset there: stuck means the page moved under it.
import { useEffect, useState } from 'react'

export function useStuck(ref, enabled = true) {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) { setStuck(false); return undefined }
    let frame = 0
    const check = () => {
      frame = 0
      const top = parseFloat(getComputedStyle(el).top) || 0
      setStuck(window.scrollY > 0 && el.getBoundingClientRect().top <= top + 0.5)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    check()
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled])
  return stuck
}
