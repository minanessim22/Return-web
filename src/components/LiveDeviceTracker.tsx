'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTrackerStream } from '@/lib/useTrackerStream';
import Map, { MarkerPoint } from '@/components/Map';
import { Activity, Wifi, WifiOff, Battery, AlertCircle, RefreshCw } from 'lucide-react';

interface LiveDeviceTrackerProps {
  deviceId: string;
  deviceSerialNumber: string;
  profileName?: string;
  linkedProfileId?: string;
}

/**
 * LiveDeviceTracker
 * ──────────────────────────────────────────────────────────
 * Real-time GPS tracking component for a specific device.
 * Subscribes to Supabase Realtime / SSE stream and displays
 * live marker on map with battery, signal, and timestamp info.
 *
 * Also includes:
 *   - Manual Refresh button (polls /api/tracker/latest from DB)
 *   - Auto-poll every 30s as fallback when stream is quiet
 * ──────────────────────────────────────────────────────────
 */
export function LiveDeviceTracker({
  deviceId,
  deviceSerialNumber,
  profileName = 'Unknown',
  linkedProfileId,
}: LiveDeviceTrackerProps) {
  const { latestByDevice, connected } = useTrackerStream();

  // DB-polled fallback location (survives server cold starts)
  const [dbLocation, setDbLocation] = useState<{
    lat: number | null;
    lon: number | null;
    battery?: number;
    receivedAt: string;
    alertType?: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const fetchLatestFromDb = useCallback(async () => {
    if (refreshing) return;
    const now = Date.now();
    // Throttle: at most once every 5s
    if (now - lastRefreshRef.current < 5_000) return;
    lastRefreshRef.current = now;
    setRefreshing(true);
    try {
      const id = deviceSerialNumber || deviceId;
      const r = await fetch(`/api/tracker/latest?device_id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d.device) setDbLocation(d.device);
      }
    } catch { /* non-fatal */ }
    finally { setRefreshing(false); }
  }, [deviceId, deviceSerialNumber, refreshing]);

  // Auto-poll every 30s as fallback for cold starts / quiet streams
  useEffect(() => {
    void fetchLatestFromDb(); // initial fetch
    const interval = setInterval(() => { void fetchLatestFromDb(); }, 30_000);
    return () => clearInterval(interval);
  }, [deviceId, deviceSerialNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get latest location: SSE/Realtime takes priority, DB is fallback
  const streamLocation = latestByDevice[deviceSerialNumber] || latestByDevice[deviceId] || null;
  const latestLocation = useMemo(() => {
    if (streamLocation) return streamLocation;
    return dbLocation;
  }, [streamLocation, dbLocation]);

  // Convert to MarkerPoint format for Map component
  const markerPoints: MarkerPoint[] = useMemo(() => {
    if (!latestLocation || latestLocation.lat === null || latestLocation.lon === null) return [];
    return [
      {
        position: [latestLocation.lat, latestLocation.lon] as [number, number],
        label: `${profileName} - Live Location`,
        battery: latestLocation.battery,
        lastSeen: latestLocation.receivedAt,
        live: true,
      },
    ];
  }, [latestLocation, profileName]);

  const defaultCenter: [number, number] = latestLocation && latestLocation.lat !== null && latestLocation.lon !== null
    ? [latestLocation.lat, latestLocation.lon]
    : [30.0444, 31.2357]; // Cairo, Egypt fallback

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#014CB3] to-[#60C10F]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-white animate-pulse" />
            <div>
              <h3 className="text-white font-bold text-lg">Live GPS Tracking</h3>
              <p className="text-white/80 text-xs">{profileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={() => { lastRefreshRef.current = 0; void fetchLatestFromDb(); }}
              disabled={refreshing}
              title="Refresh location from database"
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs text-white font-semibold hidden sm:inline">
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </span>
            </button>

            {connected ? (
              <div className="flex items-center gap-1 bg-white/25 px-3 py-1 rounded-full">
                <Wifi className="w-4 h-4 text-green-300" />
                <span className="text-xs text-white font-semibold">Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white/25 px-3 py-1 rounded-full">
                <WifiOff className="w-4 h-4 text-red-300" />
                <span className="text-xs text-white font-semibold">Reconnecting…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative min-h-[300px] bg-gray-50">
        {latestLocation ? (
          <>
            <Map
              center={defaultCenter}
              markers={markerPoints}
              zoom={15}
              animate={true}
            />
            {/* Status Badge - Bottom Right */}
            <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200 max-w-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-600">Battery</span>
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-[#60C10F]" />
                    <span
                      className={`font-bold ${latestLocation.battery && latestLocation.battery <= 15
                          ? 'text-red-600'
                          : latestLocation.battery && latestLocation.battery <= 40
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                    >
                      {latestLocation.battery ?? 'N/A'}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-600">Last Update</span>
                  <span className="text-xs font-mono text-gray-700">
                    {new Date(latestLocation.receivedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">
                  {latestLocation.lat !== null && latestLocation.lon !== null
                    ? `${latestLocation.lat.toFixed(6)}, ${latestLocation.lon.toFixed(6)}`
                    : 'GPS Searching... (جاري تحديد الموقع)'}
                </div>
                {/* Source indicator */}
                {!streamLocation && dbLocation && (
                  <div className="text-[10px] text-amber-600 font-semibold pt-0.5">
                    📦 آخر موقع محفوظ (DB)
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Waiting for First Update */
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-semibold">Waiting for device location…</p>
            <p className="text-xs text-gray-400 mt-1">
              {connected
                ? 'Connected to stream. Device may be initializing.'
                : 'Connecting to real-time stream…'}
            </p>
            <button
              onClick={() => { lastRefreshRef.current = 0; void fetchLatestFromDb(); }}
              disabled={refreshing}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#014CB3] text-white rounded-xl text-xs font-bold hover:bg-[#014CB3]/90 disabled:opacity-50 transition-all shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking database…' : 'Check database for last location'}
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3" />
          <span>
            {latestLocation
              ? `Last seen: ${new Date(latestLocation.receivedAt).toLocaleString()}`
              : 'Awaiting data from device…'}
          </span>
        </div>
      </div>
    </div>
  );
}

