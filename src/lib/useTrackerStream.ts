/**
 * useTrackerStream.ts
 * ─────────────────────────────────────────────────────────────────
 * React hook that opens a connection to Supabase Realtime
 * and returns the latest GPS location events in real time.
 * ─────────────────────────────────────────────────────────────────
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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

// Module-level counter — shared across ALL hook instances so every channel gets a unique name
let channelCounter = 0;

export function useTrackerStream() {
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [latestByDevice, setLatestByDevice] = useState<Record<string, TrackerEvent>>({});
  const [connected, setConnected] = useState(false);
  const [fallAlerts, setFallAlerts] = useState<TrackerEvent[]>([]);

  /** Current reconnect attempt count (resets to 0 on successful connect) */
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  /** True while we are in the backoff wait period before next retry */
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (supabase) {
      console.log('[TrackerStream] Connecting to Supabase Realtime...');
      const channelName = `location-history-changes-${++channelCounter}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'location_history' },
          (payload) => {
            try {
              const row = payload.new;
              if (!row || typeof row !== 'object' || !row.device_id) {
                console.warn('[TrackerStream] Discarded invalid Supabase insertion row:', row);
                return;
              }
              const data: TrackerEvent = {
                device_id: String(row.device_id),
                lat: Number(row.lat),
                lon: Number(row.lon),
                battery: row.battery !== null && row.battery !== undefined ? Number(row.battery) : undefined,
                timestamp: row.recorded_at,
                receivedAt: row.received_at || new Date().toISOString(),
                topic: `supabase/realtime/${row.device_id}`,
                alertType: row.alert_type || 'location',
              };

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
            } catch (err) {
              console.error('[TrackerStream] Error handling Supabase realtime payload:', err);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[TrackerStream] Supabase Realtime connected ✓');
            setConnected(true);
            setIsRecovering(false);
            setReconnectAttempt(0);
          } else if (status === 'CLOSED') {
            console.log('[TrackerStream] Supabase Realtime channel closed.');
            setConnected(false);
            setIsRecovering(false);
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[TrackerStream] Supabase Realtime channel error.');
            setConnected(false);
            setIsRecovering(true);
            setReconnectAttempt((prev) => prev + 1);
          }
        });

      return () => {
        void supabase?.removeChannel(channel);
      };
    } else {
      console.warn('[TrackerStream] Supabase client is not configured.');
      setConnected(false);
      return () => { };
    }
  }, []);

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
    reconnectAttempt,
    isRecovering,
  };
}