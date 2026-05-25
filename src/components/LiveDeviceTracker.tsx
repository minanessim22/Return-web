'use client';

import React, { useEffect, useMemo } from 'react';
import { useTrackerStream } from '@/lib/useTrackerStream';
import Map, { MarkerPoint } from '@/components/Map';
import { Activity, Wifi, WifiOff, Battery, AlertCircle } from 'lucide-react';

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
 * Subscribes to MQTT updates via SSE stream and displays
 * live marker on map with battery, signal, and timestamp info.
 * ──────────────────────────────────────────────────────────
 */
export function LiveDeviceTracker({
  deviceId,
  deviceSerialNumber,
  profileName = 'Unknown',
  linkedProfileId,
}: LiveDeviceTrackerProps) {
  const { latestByDevice, connected } = useTrackerStream();

  // Get latest location for this specific device (match by serial number)
  const latestLocation = useMemo(() => {
    return (
      latestByDevice[deviceSerialNumber] ||
      latestByDevice[deviceId] ||
      null
    );
  }, [latestByDevice, deviceSerialNumber, deviceId]);

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
            {connected ? (
              <div className="flex items-center gap-1 bg-white/25 px-3 py-1 rounded-full">
                <Wifi className="w-4 h-4 text-green-300" />
                <span className="text-xs text-white font-semibold">Connected</span>
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
              : 'Awaiting MQTT data from device…'}
          </span>
        </div>
      </div>
    </div>
  );
}
