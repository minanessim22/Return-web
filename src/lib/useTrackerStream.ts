/**
 * useTrackerStream.ts
 * ─────────────────────────────────────────────────────────────────
 * React hook that opens a Server-Sent Events connection to
 * /api/tracker/stream and returns the latest GPS location
 * events in real time, including fall alert detection.
 *
 * Usage:
 *   const { events, latestByDevice, connected, fallAlerts } = useTrackerStream();
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

export function useTrackerStream() {
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [latestByDevice, setLatestByDevice] = useState<Record<string, TrackerEvent>>({});
  const [connected, setConnected] = useState(false);
  const [fallAlerts, setFallAlerts] = useState<TrackerEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Avoid duplicate connections
    if (esRef.current) return;

    const es = new EventSource('/api/tracker/stream');
    esRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
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

      // Retry after 5 seconds
      retryTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5_000);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [connect]);

  /** Dismiss a specific fall alert by index */
  const dismissFallAlert = useCallback((index: number) => {
    setFallAlerts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { events, latestByDevice, connected, fallAlerts, dismissFallAlert };
}
