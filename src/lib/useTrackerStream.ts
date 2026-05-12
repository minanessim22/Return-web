/**
 * useTrackerStream.ts
 * ─────────────────────────────────────────────────────────────────
 * React hook that opens a Server-Sent Events connection to
 * /api/tracker/stream and returns the latest GPS location
 * events in real time.
 *
 * Usage:
 *   const { events, latestByDevice, connected } = useTrackerStream();
 * ─────────────────────────────────────────────────────────────────
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TrackerEvent {
  device_id: string;
  lat: number;
  lon: number;
  battery?: number;
  timestamp?: string;
  receivedAt: string;
  topic: string;
}

/** Maximum events to keep in the rolling buffer */
const MAX_EVENTS = 200;

export function useTrackerStream() {
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [latestByDevice, setLatestByDevice] = useState<Record<string, TrackerEvent>>({});
  const [connected, setConnected] = useState(false);
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

  return { events, latestByDevice, connected };
}
