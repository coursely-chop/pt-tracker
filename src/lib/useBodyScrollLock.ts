import { useEffect } from "react";

/** Freezes background scroll while a full-screen overlay is mounted — without
 * it, the page behind a sheet stays independently scrollable, which on the
 * Add Exercise picker meant two competing scroll areas fighting for the same
 * gesture. Restores whatever overflow value was there before on unmount. */
export function useBodyScrollLock(): void {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}
