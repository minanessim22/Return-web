'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTrackerStream } from '@/lib/useTrackerStream';

const LiveDeviceTracker = dynamic(
  () => import('@/components/LiveDeviceTracker').then((mod) => mod.LiveDeviceTracker),
  { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 rounded-2xl animate-pulse" /> }
);
import { Activity, MapPin, Battery, Clock, AlertTriangle, X, Volume2, VolumeX, Bell } from 'lucide-react';

/**
 * GPS Device Live Tracking Dashboard + Fall Detection
 * ──────────────────────────────────────────────────────────────
 * Real-time tracking for AI-Thinker A9G wristbands.
 * Now with fall detection alerts showing location on map.
 *
 * The A9G device sends HTTP GET to:
 *   /api/tracker/report?device_id=A9G-01&lat=30.123&lon=31.456&type=fall
 * ──────────────────────────────────────────────────────────────
 */

export default function TrackingPage() {
  const { latestByDevice, connected, events, fallAlerts, dismissFallAlert } = useTrackerStream();
  const [deviceList, setDeviceList] = useState<Array<{ id: string; serialNumber: string; name: string }>>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showAlertBanner, setShowAlertBanner] = useState(false);
  const prevFallCountRef = useRef(0);

  useEffect(() => {
    const devices = Object.entries(latestByDevice).map(([deviceId, event]) => ({
      id: deviceId,
      serialNumber: event.device_id,
      name: `Device ${event.device_id}`,
    }));
    setDeviceList(devices);
  }, [latestByDevice]);

  // Play alert sound when new fall detected
  useEffect(() => {
    if (fallAlerts.length > prevFallCountRef.current) {
      setShowAlertBanner(true);
      if (soundEnabled && typeof window !== 'undefined') {
        try {
          const audioCtx = new AudioContext();
          // Emergency siren pattern
          const playTone = (freq: number, startTime: number, duration: number) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
          };
          const now = audioCtx.currentTime;
          playTone(880, now, 0.15);
          playTone(660, now + 0.2, 0.15);
          playTone(880, now + 0.4, 0.15);
          playTone(660, now + 0.6, 0.15);
        } catch { /* audio not available */ }
      }
    }
    prevFallCountRef.current = fallAlerts.length;
  }, [fallAlerts.length, soundEnabled]);

  const latestFall = fallAlerts[0] || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20">
      {/* Emergency Banner */}
      {showAlertBanner && latestFall && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-slideDown">
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white px-4 py-3 shadow-2xl shadow-red-500/30">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-lg">⚠️ سقوط تم اكتشافه! — Fall Detected!</p>
                  <p className="text-white/90 text-sm">
                    Device: {latestFall.device_id} • Location: {latestFall.lat !== null && latestFall.lon !== null ? `${latestFall.lat.toFixed(6)}, ${latestFall.lon.toFixed(6)}` : 'GPS Searching... (جاري تحديد الموقع)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {latestFall.lat !== null && latestFall.lon !== null && (
                  <a
                    href={`https://maps.google.com/?q=${latestFall.lat},${latestFall.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white text-red-600 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors shadow-lg"
                  >
                    Open in Maps ↗
                  </a>
                )}
                <button
                  onClick={() => setShowAlertBanner(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-[#014CB3] to-[#60C10F] bg-clip-text text-transparent mb-2">
                📡 Live GPS Tracking
              </h1>
              <p className="text-gray-500 text-sm">
                Real-time tracking & fall detection for AI-Thinker A9G wristbands
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/tracking/history"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white text-[#014CB3] border border-[#014CB3]/20 hover:bg-blue-50 transition-all shadow-sm"
              >
                <Clock className="w-4 h-4" />
                History & Geofences
              </a>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
                  soundEnabled
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {soundEnabled ? 'Sound On' : 'Sound Off'}
              </button>
            </div>
          </div>
        </div>

        {/* Connection Status Card */}
        <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-blue-500/5 p-5 border border-white/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                connected
                  ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/30'
                  : 'bg-gradient-to-br from-red-400 to-red-500 shadow-lg shadow-red-500/30'
              }`}>
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {connected ? '✓ Connected to Live Stream' : '⚠ Connecting…'}
                </h3>
                <p className="text-sm text-gray-500">
                  {Object.keys(latestByDevice).length} device(s) active • {events.length} events received • {fallAlerts.length} fall alert(s)
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black bg-gradient-to-r from-[#014CB3] to-[#60C10F] bg-clip-text text-transparent">
                {Object.keys(latestByDevice).length}
              </p>
              <p className="text-xs text-gray-500 font-medium">Active Devices</p>
            </div>
          </div>
        </div>

        {/* Fall Alerts Section */}
        {fallAlerts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold text-gray-800">🚨 Fall Alerts</h2>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                {fallAlerts.length}
              </span>
            </div>
            <div className="grid gap-3">
              {fallAlerts.slice(0, 5).map((alert, idx) => (
                <div
                  key={`fall-${idx}-${alert.receivedAt}`}
                  className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg shadow-red-500/10 border border-red-200/50 p-5 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30 flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">
                          Fall Detected — {alert.device_id}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            {alert.lat !== null && alert.lon !== null ? `${alert.lat.toFixed(6)}, ${alert.lon.toFixed(6)}` : 'GPS Searching...'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(alert.receivedAt).toLocaleString('ar-EG')}
                          </span>
                          {alert.battery !== undefined && (
                            <span className="flex items-center gap-1">
                              <Battery className="w-3.5 h-3.5 text-green-500" />
                              {alert.battery}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alert.lat !== null && alert.lon !== null && (
                        <a
                          href={`https://maps.google.com/?q=${alert.lat},${alert.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md shadow-blue-500/20"
                        >
                          📍 Google Maps
                        </a>
                      )}
                      <button
                        onClick={() => dismissFallAlert(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device Grid */}
        {deviceList.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {deviceList.map((device) => (
              <LiveDeviceTracker
                key={device.id}
                deviceId={device.id}
                deviceSerialNumber={device.serialNumber}
                profileName={device.name}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-blue-500/5 p-16 text-center mb-8 border border-white/50">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mx-auto mb-5">
              <MapPin className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Waiting for Devices…</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              No location data received yet. Make sure your A9G device is powered on and sending data.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 inline-block">
              <p className="text-xs text-gray-600 font-mono">
                GET /api/tracker/report?device_id=A9G-01&lat=30.0&lon=31.0&type=location
              </p>
            </div>
          </div>
        )}

        {/* Recent Events */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-blue-500/5 overflow-hidden border border-white/50">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              📋 Recent GPS Events
              {events.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                  {events.length}
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {events.length > 0 ? (
              events.slice(0, 30).map((event, idx) => (
                <div
                  key={idx}
                  className={`px-6 py-3 flex items-center justify-between hover:bg-gray-50/80 transition-colors ${
                    event.alertType === 'fall' ? 'bg-red-50/50 border-l-4 border-red-400' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 truncate">
                        {event.device_id}
                      </span>
                      {event.alertType === 'fall' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold animate-pulse">
                          ⚠️ FALL
                        </span>
                      )}
                      {event.battery !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          event.battery <= 15 ? 'bg-red-100 text-red-700' :
                          event.battery <= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          <Battery className="w-3 h-3 mr-1 inline" />
                          {event.battery}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {event.lat !== null && event.lon !== null ? `${event.lat.toFixed(6)}, ${event.lon.toFixed(6)}` : 'GPS Searching...'}
                    </p>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.receivedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center text-gray-400">
                <p>No events yet. Waiting for device telemetry…</p>
              </div>
            )}
          </div>
        </div>

        {/* How-To Guide */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg shadow-blue-500/5 p-6 border border-blue-100/50">
          <h4 className="font-bold text-[#014CB3] mb-4 text-lg flex items-center gap-2">
            💡 A9G Integration Guide
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/70 rounded-xl p-4 border border-blue-100/50">
              <p className="font-semibold text-gray-700 mb-2">📍 Send Location</p>
              <code className="block text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-x-auto font-mono">
                GET /api/tracker/report?device_id=A9G-01&lat=30.04&lon=31.23&type=location
              </code>
            </div>
            <div className="bg-white/70 rounded-xl p-4 border border-red-100/50">
              <p className="font-semibold text-gray-700 mb-2">🚨 Send Fall Alert</p>
              <code className="block text-xs text-gray-600 bg-red-50 p-3 rounded-lg overflow-x-auto font-mono">
                GET /api/tracker/report?device_id=A9G-01&lat=30.04&lon=31.23&type=fall
              </code>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            💡 The A9G sends a simple HTTP GET request. The server pushes the data to this page in real time via SSE.
          </p>
        </div>
      </div>

      {/* Slide-down animation */}
      <style jsx>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideDown {
          animation: slideDown 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
