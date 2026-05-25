/**
 * useTrackerStream.ts
 * ─────────────────────────────────────────────────────────────────
 * React hook that opens a Server-Sent Events connection to
 * /api/tracker/stream and returns the latest GPS location
 * events in real time, including fall alert detection.
 *
 * Reconnection strategy: Exponential Backoff with Jitter
 *   Attempt 1 → 2s ± 20%
 *   Attempt 2 → 4s ± 20%
 *   Attempt 3 → 8s ± 20%
 *   Attempt 4 → 16s ± 20%
 *   Attempt 5+ → 30s ± 20% (capped)
 * This prevents a "thundering herd" when many clients reconnect at once.
 *
 * Usage:
 *   const { events, latestByDevice, connected, fallAlerts,
 *           reconnectAttempt, isRecovering } = useTrackerStream();
 * ─────────────────────────────────────────────────────────────────
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TrackerEvent {
  device_id: string;
  lat: number | null;
  lon: number | null;
  battery?: number;
  timestamp?: string;
  receivedAt: string;
  topic: string;
  /** "location" | "fall" – set by /api/tracker/report */
  alertType?: string;
}

/** Maximum events to keep in the rolling buffer */
const MAX_EVENTS = 200;

// ── Backoff constants ─────────────────────────────────────────────
const BACKOFF_BASE_MS  = 2_000;   // 2 seconds for first retry
const BACKOFF_MAX_MS   = 30_000;  // 30 seconds cap
const BACKOFF_JITTER   = 0.2;     // ±20% randomness

/**
 * Calculate next retry delay using exponential backoff with jitter.
 * @param attempt – zero-indexed attempt number
 */
function calcDelay(attempt: number): number {
  const exp = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
  const jitter = exp * BACKOFF_JITTER * (Math.random() * 2 - 1); // ±20%
  return Math.round(exp + jitter);
}

// ── Hook ──────────────────────────────────────────────────────────

export function useTrackerStream() {
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [latestByDevice, setLatestByDevice] = useState<Record<string, TrackerEvent>>({});
  const [connected, setConnected] = useState(false);
  const [fallAlerts, setFallAlerts] = useState<TrackerEvent[]>([]);

  /** Current reconnect attempt count (resets to 0 on successful connect) */
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  /** True while we are in the backoff wait period before next retry */
  const [isRecovering, setIsRecovering] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0); // mutable mirror of reconnectAttempt for closure access

  const clearRetry = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const connect = useCallback(() => {
    // Avoid duplicate connections
    if (esRef.current) return;

    const es = new EventSource('/api/tracker/stream');
    esRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      setIsRecovering(false);
      // Reset backoff on successful connection
      attemptRef.current = 0;
      setReconnectAttempt(0);
    });

    es.addEventListener('location', (e) => {
      try {
        const data: TrackerEvent = JSON.parse(e.data);
        setEvents((prev) => {
          const next = [data, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
        setLatestByDevice((prev) => ({
          ...prev,
          [data.device_id]: data,
        }));

        if (data.alertType === 'fall') {
          setFallAlerts((prev) => {
            const next = [data, ...prev];
            return next.length > 50 ? next.slice(0, 50) : next;
          });
        }
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('fall_alert', (e) => {
      try {
        const data: TrackerEvent = JSON.parse(e.data);
        setFallAlerts((prev) => {
          // Avoid duplicate insertion if already added by location listener
          if (prev.some((item) => item.receivedAt === data.receivedAt)) return prev;
          const next = [data, ...prev];
          return next.length > 50 ? next.slice(0, 50) : next;
        });
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;

      // Exponential backoff with jitter
      const attempt = attemptRef.current;
      const delay = calcDelay(attempt);
      attemptRef.current = attempt + 1;
      setReconnectAttempt(attempt + 1);
      setIsRecovering(true);

      console.debug(
        `[TrackerStream] Disconnected. Retry #${attempt + 1} in ${(delay / 1000).toFixed(1)}s`
      );

      retryTimeoutRef.current = setTimeout(() => {
        setIsRecovering(false);
        connect();
      }, delay);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      clearRetry();
    };
  }, [connect]);

  /** Dismiss a specific fall alert by index */
  const dismissFallAlert = useCallback((index: number) => {
    setFallAlerts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    events,
    latestByDevice,
    connected,
    fallAlerts,
    dismissFallAlert,
    /** How many reconnect attempts have been made since last successful connect */
    reconnectAttempt,
    /** True while waiting in backoff before next retry */
    isRecovering,
  };
}
