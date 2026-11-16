export type ScreenOrientationPreference = 'auto' | 'portrait' | 'landscape';

/**
 * Applies user's preferred screen orientation using Screen Orientation API.
 * On user gesture (`fromUserGesture = true`), tries fullscreen + orientation lock
 * if direct lock is restricted by browser policy. Always pairs with CSS 90° rotation fallback
 * when OS/WebAPK stays locked in portrait.
 */
export const applyScreenOrientation = async (
  mode: ScreenOrientationPreference = 'auto',
  fromUserGesture = false
): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    document.documentElement.dataset.screenOrientation = mode;
  } catch {}

  const orientationObj = (window.screen as any)?.orientation;
  if (!orientationObj) return false;

  try {
    if (mode === 'auto') {
      if (typeof orientationObj.unlock === 'function') {
        orientationObj.unlock();
      }
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      }
      return true;
    }

    if (typeof orientationObj.lock === 'function') {
      try {
        await orientationObj.lock(mode);
        return true;
      } catch {
        // Chrome browsers often require fullscreen before screen.orientation.lock()
        if (
          fromUserGesture &&
          !document.fullscreenElement &&
          typeof document.documentElement.requestFullscreen === 'function'
        ) {
          try {
            await document.documentElement.requestFullscreen();
            await orientationObj.lock(mode);
            return true;
          } catch {
            // Fall through cleanly; CSS landscape rotation takes over automatically
          }
        }
      }
    }
  } catch {
    // Graceful fallback handled by CSS force-landscape stage in App.tsx
  }

  return false;
};
