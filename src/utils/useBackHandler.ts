import { useEffect } from 'react';
import { backHandler } from './backHandler';

/**
 * Hook to register a back button callback (Android back button, browser gesture, Esc key).
 * Higher priority handlers are executed first (e.g. modals > sub-screens > tabs > exit).
 */
export function useBackHandler(
  id: string,
  isActive: boolean,
  handler: () => boolean | void,
  priority = 10
) {
  useEffect(() => {
    if (!isActive) return;
    const unregister = backHandler.register(id, handler, priority);
    return unregister;
  }, [id, isActive, handler, priority]);
}
