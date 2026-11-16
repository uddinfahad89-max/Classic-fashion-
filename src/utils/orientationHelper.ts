export type ScreenOrientationPreference = 'auto' | 'portrait' | 'landscape';

/**
 * Applies user's preferred screen orientation using Screen Orientation API
 * and clears any previous lock when 'auto' is selected so tablet rotation works freely.
 */
export const applyScreenOrientation = async (
  mode: ScreenOrientationPreference = 'auto'
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
      return true;
    }

    if (typeof orientationObj.lock === 'function') {
      await orientationObj.lock(mode);
      return true;
    }
  } catch {
    // Browsers disallow screen.orientation.lock() outside fullscreen / standalone PWA.
    // Unlock remains safe when 'auto' is active via manifest "orientation": "any".
  }

  return false;
};
