import { useEffect, type RefObject } from 'react'

/**
 * Closes a dropdown/search panel when the user clicks anywhere outside of
 * it — used across every filter dropdown and type-ahead search box in the
 * app so they behave like normal dropdowns (close on click-away) instead
 * of requiring an explicit close button.
 */
export function useClickOutside(ref: RefObject<HTMLElement>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [active, onOutside, ref])
}
