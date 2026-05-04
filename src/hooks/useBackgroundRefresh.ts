import { useEffect, useRef } from 'react';

interface BackgroundRefreshOptions {
  enabled?: boolean;
  intervalMs?: number;
  eventName?: string;
}

/**
 * Keeps workflow views fresh without user-initiated page reloads.
 */
export function useBackgroundRefresh(
  refresh: () => void | Promise<void>,
  options?: BackgroundRefreshOptions
) {
  const enabled = options?.enabled ?? true;
  const intervalMs = Math.max(15_000, options?.intervalMs ?? 30_000);
  const eventName = options?.eventName || 'shub:workflow-refresh';
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const runRefresh = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await refresh();
      } catch (error) {
        console.error('[background-refresh] refresh failed:', error);
      } finally {
        runningRef.current = false;
      }
    };

    const timer = window.setInterval(() => {
      void runRefresh();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runRefresh();
      }
    };

    const onWindowFocus = () => {
      void runRefresh();
    };

    const onWorkflowRefresh = () => {
      void runRefresh();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener(eventName, onWorkflowRefresh as EventListener);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener(eventName, onWorkflowRefresh as EventListener);
    };
  }, [enabled, eventName, intervalMs, refresh]);
}
