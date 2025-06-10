
// This file might no longer be directly used by the layout if the sidebar complexity is removed.
// Keeping it for now as it might be useful for other responsive logic.
// If confirmed unused after redesign, it can be deleted.
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === 'undefined') return; // Guard for SSR

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) // Initial check
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
