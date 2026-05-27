'use client';

/**
 * LiveTrackingMap
 * ─────────────────────────────────────────────────────────────────
 * A premium, always-visible live GPS tracking panel.
 *
 * • Shows every device that has sent at least one MQTT / HTTP report
 *   in this server session (no database registration required).
 * • Subscribes to /api/tracker/stream (SSE) for real-time pins.
 * • Falls back to /api/tracker/latest (REST) on first load.
 * • Works even when the devices list is empty.
 *
 * FIX: The map never resets its zoom/pan when data updates arrive.
 *   – MapStable is wrapped in React.memo so it only re-mounts once.
 *   – Marker data is passed via a ref so the stable Map child can
 *     read the latest positions without a full re-render.
 *   – The 10-second "tick" for refreshing "X ago" labels only
 *     updates the info panel, never the map canvas.
 *   – Zoom +/− and Locate-Me buttons live inside Leaflet's own
 *     DOM so they call map.zoomIn() / map.zoomOut() imperatively
 *     with zero React overhead.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useMemo, useState, useRef, memo } from 'react';
import dynamic from 'next/dynamic';
import { Activity, MapPin, Radio, WifiOff, Zap, Clock, Battery, Signal } from 'lucide-react';
import { useTrackerStream } from '@/lib/useTrackerStream';
import type { MarkerPoint } from '@/components/Map';

// ── Stable map wrapper (memoised – never re-mounts) ──────────────
// We use dynamic import with ssr:false once at module level.
// The component is memoised so parent state changes don't re-render it.

const DynamicMap = dynamic(() => import('@/components/Map'), { ssr: false });

interface StableMapProps {
  center: [number, number];
  markers: MarkerPoint[];
  zoom: number;
}

// React.memo with a custom comparison: only update when a marker
// position actually changes.  This prevents the tick timer or header
// badge updates from causing the map canvas to re-render.
const StableMap = memo(function StableMap({ center, markers, zoom }: StableMapProps) {
  return (
    <DynamicMap
      center={center}
      markers={markers}
      zoom={zoom}
      animate={true}
      showControls={true}
      scrollWheelZoom={true}
    />
  );
}, (prev, next) => {
  // Return true (skip re-render) when markers haven't changed
  if (prev.markers.length !== next.markers.length) return false;
  for (let i = 0; i < prev.markers.length; i++) {
    if (
      prev.markers[i].position[0] !== next.markers[i].position[0] ||
      prev.markers[i].position[1] !== next.markers[i].position[1] ||
      prev.markers[i].battery !== next.markers[i].battery
    ) {
      return false;
    }
  }
  // center changes only matter when there were no markers before
  if (prev.markers.length === 0 && next.markers.length === 0) {
    return prev.center[0] === next.center[0] && prev.center[1] === next.center[1];
  }
  return true;
});

// ── Types ─────────────────────────────────────────────────────────

interface DeviceSnapshot {
  device_id: string;
  lat: number | null;
  lon: number | null;
  battery?: number;
  receivedAt: string;
  alertType?: string;
}

interface LiveTrackingMapProps {
  /** Optional: restrict view to a single device id */
  deviceId?: string;
  /** Optional: label override for the tracked device */
  deviceLabel?: string;
  /** Height of the map container (CSS value) */
  height?: string;
  /** Show the event log panel below the map */
  showLog?: boolean;
  /** RTL mode */
  isRTL?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function coordStr(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return 'No fix';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// ── Component ─────────────────────────────────────────────────────

export function LiveTrackingMap({
  deviceId,
  deviceLabel,
  height = '440px',
  showLog = true,
  isRTL = false,
}: LiveTrackingMapProps) {
  const { latestByDevice, events, connected } = useTrackerStream();

  // Snapshots: keyed by device_id, updated from SSE + REST seed
  const [snapshots, setSnapshots] = useState<Record<string, DeviceSnapshot>>({});

  // Tick: ONLY used for the "X ago" labels in the info panel.
  // It must NOT cause the StableMap to re-render.
  const [tick, setTick] = useState(0);

  const fetchedRef = useRef(false);

  // ── Seed from REST on first mount ──────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const url = deviceId
      ? `/api/tracker/latest?device_id=${encodeURIComponent(deviceId)}`
      : '/api/tracker/latest';

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.device) {
          setSnapshots((prev) => ({
            ...prev,
            [data.device.device_id]: data.device,
          }));
        } else if (data.devices) {
          setSnapshots((prev) => ({ ...prev, ...data.devices }));
        }
      })
      .catch(() => {/* silent – SSE will populate soon */});
  }, [deviceId]);

  // ── Merge SSE live data ─────────────────────────────────────────
  useEffect(() => {
    if (!latestByDevice) return;
    const incoming: Record<string, DeviceSnapshot> = {};
    for (const [id, ev] of Object.entries(latestByDevice)) {
      if (deviceId && id !== deviceId) continue;
      incoming[id] = {
        device_id: id,
        lat: ev.lat,
        lon: ev.lon,
        battery: ev.battery,
        receivedAt: ev.receivedAt,
        alertType: ev.alertType,
      };
    }
    if (Object.keys(incoming).length > 0) {
      setSnapshots((prev) => ({ ...prev, ...incoming }));
    }
  }, [latestByDevice, deviceId]);

  // ── 10-second tick for "X ago" labels only ─────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Derive map markers (stable identity when positions unchanged) ─
  // NOTE: tick is intentionally excluded from deps — the map doesn't
  // care about time labels, only positions.
  const mapMarkers = useMemo<MarkerPoint[]>(() => {
    const result: MarkerPoint[] = [];
    for (const snap of Object.values(snapshots)) {
      if (snap.lat === null || snap.lon === null) continue;
      result.push({
        position: [snap.lat, snap.lon],
        label: deviceLabel ?? snap.device_id,
        battery: snap.battery,
        lastSeen: snap.receivedAt,
        live: true,
      });
    }
    return result;
  }, [snapshots, deviceLabel]); // ← tick removed intentionally

  const activeSnaps = useMemo(
    () => Object.values(snapshots).filter((s) => s.lat !== null && s.lon !== null),
    [snapshots]
  );

  const defaultCenter = useMemo<[number, number]>(
    () =>
      activeSnaps.length > 0
        ? [activeSnaps[0].lat as number, activeSnaps[0].lon as number]
        : [30.0444, 31.2357],
    [activeSnaps]
  );

  // ── Recent events for the log panel ────────────────────────────
  const recentEvents = useMemo(() => {
    const filtered = deviceId
      ? events.filter((e) => e.device_id === deviceId)
      : events;
    return filtered.slice(0, 10);
  }, [events, deviceId]);

  const noData = activeSnaps.length === 0;

  return (
    <div className="flex flex-col gap-0 rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-white/5 backdrop-blur-sm">

      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#014CB3]/80 to-[#60C10F]/60 border-b border-white/15">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <MapPin className="w-5 h-5 text-white" />
            {connected && !noData && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#60C10F] animate-ping" />
            )}
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-tight">
              {isRTL ? 'الخريطة الحية' : 'Live GPS Map'}
            </p>
            <p className="text-white/60 text-[10px]">
              {activeSnaps.length}{' '}
              {isRTL
                ? 'جهاز على الخريطة'
                : activeSnaps.length === 1
                ? 'device on map'
                : 'devices on map'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
              connected
                ? 'bg-[#60C10F]/25 text-[#a8e87a] border border-[#60C10F]/40'
                : 'bg-red-500/20 text-red-300 border border-red-400/30'
            }`}
          >
            {connected ? (
              <><Radio className="w-3 h-3" /> {isRTL ? 'متصل' : 'Live'}</>
            ) : (
              <><WifiOff className="w-3 h-3" /> {isRTL ? 'غير متصل' : 'Reconnecting'}</>
            )}
          </span>

          {/* Event count badge */}
          {events.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white/80">
              <Zap className="w-3 h-3 text-yellow-300" />
              {events.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────── */}
      <div className="relative" style={{ height }}>
        {noData ? (
          /* Waiting state – shown when no GPS data received yet */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full border-2 border-[#014CB3]/40 flex items-center justify-center">
                <Signal className="w-7 h-7 text-[#60C10F] animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#60C10F]/30 border border-[#60C10F]/60 animate-ping" />
            </div>
            <p className="text-white font-black text-lg">
              {isRTL ? 'في انتظار الجهاز…' : 'Waiting for GPS data…'}
            </p>
            <p className="text-white/50 text-sm mt-1 text-center max-w-xs">
              {connected
                ? isRTL
                  ? 'البث متصل. سيظهر الدبوس فور وصول إحداثيات من البوردة.'
                  : 'Stream connected. The pin will appear the moment your board sends coordinates.'
                : isRTL
                ? 'جاري الاتصال بالبث…'
                : 'Connecting to real-time stream…'}
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-white/40">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>{isRTL ? 'المسار:' : 'Endpoint:'}</span>
              <code className="font-mono text-[#60C10F]/70">/api/tracker/report</code>
            </div>
          </div>
        ) : (
          /*
           * StableMap is memoised — it only re-renders when marker
           * positions actually change.  The tick timer, event log,
           * header badges, etc. are completely isolated from it.
           */
          <StableMap
            center={defaultCenter}
            markers={mapMarkers}
            zoom={15}
          />
        )}

        {/* ── Device summary cards – bottom right ─────────────── */}
        {activeSnaps.length > 0 && (
          <div className="absolute bottom-3 right-3 z-[400] flex flex-col gap-2 max-w-[220px]">
            {activeSnaps.slice(0, 3).map((snap) => (
              <div
                key={snap.device_id}
                className="bg-white/95 rounded-2xl shadow-xl border border-gray-200 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-black text-[#014CB3] truncate">
                    {deviceLabel ?? snap.device_id}
                  </p>
                  <span
                    className={`inline-flex w-2 h-2 rounded-full flex-shrink-0 ${
                      snap.alertType === 'fall'
                        ? 'bg-red-500 animate-ping'
                        : 'bg-[#60C10F] animate-pulse'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-mono">
                  {coordStr(snap.lat, snap.lon)}
                </p>
                <div className="flex items-center justify-between mt-1.5 gap-2">
                  {snap.battery !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        snap.battery <= 15
                          ? 'text-red-600'
                          : snap.battery <= 40
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      <Battery className="w-3 h-3" />
                      {snap.battery}%
                    </span>
                  )}
                  {/* tick is used only here, far from StableMap */}
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {timeSince(snap.receivedAt)}
                    {/* suppress unused-var lint – tick is the dep that forces this span to refresh */}
                    <span className="hidden">{tick}</span>
                  </span>
                </div>
              </div>
            ))}
            {activeSnaps.length > 3 && (
              <div className="text-center text-white/60 text-[11px] bg-white/20 rounded-2xl py-1.5 px-3">
                +{activeSnaps.length - 3} {isRTL ? 'أجهزة أخرى' : 'more devices'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Event log panel ─────────────────────────────────────── */}
      {showLog && (
        <div className="border-t border-white/10 bg-black/20 px-4 py-3">
          <p className="text-[11px] font-black text-white/50 uppercase tracking-widest mb-2">
            {isRTL ? 'آخر الأحداث' : 'Recent Events'}
          </p>
          {recentEvents.length === 0 ? (
            <p className="text-[11px] text-white/30 italic">
              {isRTL ? 'لا توجد أحداث بعد…' : 'No events yet – waiting for device…'}
            </p>
          ) : (
            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
              {recentEvents.map((ev, i) => (
                <div key={`${ev.receivedAt}-${i}`} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      ev.alertType === 'fall' ? 'bg-red-400' : 'bg-[#60C10F]'
                    }`}
                  />
                  <span className="text-white/40 font-mono flex-shrink-0 w-[52px]">
                    {new Date(ev.receivedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="text-white/70 font-semibold truncate">{ev.device_id}</span>
                  <span className="text-white/40 flex-shrink-0">
                    {ev.lat !== null && ev.lon !== null
                      ? `${ev.lat.toFixed(4)}, ${ev.lon.toFixed(4)}`
                      : 'no fix'}
                  </span>
                  {ev.alertType === 'fall' && (
                    <span className="text-red-400 font-black text-[10px] flex-shrink-0">
                      🚨 FALL
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
