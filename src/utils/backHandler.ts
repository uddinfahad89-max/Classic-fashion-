// Custom native-like Back Button Handler for Android, Mobile Gestures, and Web Browsers

type BackHandlerFn = () => boolean | void;

interface RegisteredHandler {
  id: string;
  priority: number;
  handler: BackHandlerFn;
}

class BackHandlerManager {
  private handlers: RegisteredHandler[] = [];
  private isExiting = false;
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Push initial sentinel state
    try {
      window.history.pushState({ posSentinel: true, ts: Date.now() }, '', window.location.href);
    } catch (e) {
      console.warn('Failed to push initial history sentinel:', e);
    }

    // Attach user gesture listeners so Android Chrome allows back button interception
    window.addEventListener('touchstart', this.onUserGesture, { passive: true });
    window.addEventListener('pointerdown', this.onUserGesture, { passive: true });
    window.addEventListener('click', this.onUserGesture, { passive: true });
    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private onUserGesture = () => {
    this.ensureSentinelState();
  };

  public register(id: string, handler: BackHandlerFn, priority = 10): () => void {
    // Remove if already registered
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, priority, handler });
    // Sort descending by priority: highest priority called first
    this.handlers.sort((a, b) => b.priority - a.priority);

    this.ensureSentinelState();

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  public ensureSentinelState() {
    if (typeof window === 'undefined') return;
    try {
      if (!window.history.state || !window.history.state.posSentinel) {
        window.history.pushState({ posSentinel: true, ts: Date.now() }, '', window.location.href);
      }
    } catch {}
  }

  public triggerBack(): boolean {
    // Traverse handlers in priority order
    for (const item of this.handlers) {
      const result = item.handler();
      // If handler explicitly returned true or undefined, consider it handled/consumed
      // If it returned false, proceed to next handler in chain
      if (result !== false) {
        return true;
      }
    }
    return false;
  }

  public forceExit() {
    this.isExiting = true;
    window.removeEventListener('popstate', this.onPopState);
    try {
      window.close();
    } catch {}
    // If window.close() fails due to browser permissions, navigate back or to blank
    if (window.history.length > 2) {
      window.history.go(-window.history.length);
    } else {
      window.location.href = 'about:blank';
    }
  }

  private onPopState = () => {
    if (this.isExiting) return;

    // Immediately push sentinel back to prevent sudden browser exit
    try {
      window.history.pushState({ posSentinel: true, ts: Date.now() }, '', window.location.href);
    } catch {}

    // Trigger registered back actions
    this.triggerBack();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const handled = this.triggerBack();
      if (handled) {
        e.preventDefault();
      }
    }
  };
}

export const backHandler = new BackHandlerManager();
