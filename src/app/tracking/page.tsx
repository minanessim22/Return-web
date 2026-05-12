'use client';

import React, { useState, useEffect } from 'react';
import { LiveDeviceTracker } from '@/components/LiveDeviceTracker';
import { useTrackerStream } from '@/lib/useTrackerStream';
import { Badge, Activity, MapPin, Battery, Clock } from 'lucide-react';

/**
 * Example: GPS Device Live Tracking Dashboard
 * ──────────────────────────────────────────────────────────
 * This page demonstrates how to integrate MQTT real-time GPS
 * updates from AI-Thinker A9G wristband into your frontend.
 *
 * Usage:
 *   1. Ensure A9G device is configured to send MQTT to:
 *      Topic: return/tracker/{device_id}/location
 *      Payload: { "device_id": "RS-2026-01", "lat": 30.123, "lon": 31.654, "battery": 85, "timestamp": "..." }
 *   2. Check MQTT_BROKER_URL in .env.local
 *   3. Navigate to /tracking or embed <LiveDeviceTracker /> in case details
 * ──────────────────────────────────────────────────────────
 */

export default function TrackingExamplePage() {
  const { latestByDevice, connected, events } = useTrackerStream();
  const [deviceList, setDeviceList] = useState<Array<{ id: string; serialNumber: string; name: string }>>([]);

  useEffect(() => {
    // Parse unique devices from latest updates
    const devices = Object.entries(latestByDevice).map(([deviceId, event]) => ({
      id: deviceId,
      serialNumber: event.device_id,
      name: `Device ${event.device_id.slice(-4)}`,
    }));
    setDeviceList(devices);
  }, [latestByDevice]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] to-[#e0e0e0] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-[#014CB3] mb-2">📡 Live GPS Tracking</h1>
          <p className="text-gray-600">Real-time tracking for AI-Thinker A9G wristbands via MQTT</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-4 border-l-4 border-[#60C10F]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className={`w-6 h-6 ${connected ? 'text-green-500 animate-pulse' : 'text-red-500'}`} />
              <div>
                <h3 className="font-bold text-gray-800">
                  {connected ? '✓ Connected to Stream' : '⚠ Connecting…'}
                </h3>
                <p className="text-xs text-gray-500">
                  {Object.keys(latestByDevice).length} device(s) active • {events.length} recent events
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#60C10F]">{Object.keys(latestByDevice).length}</p>
              <p className="text-xs text-gray-500">Active Devices</p>
            </div>
          </div>
        </div>

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
          <div className="bg-white rounded-xl shadow-md p-12 text-center mb-8">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Devices Found</h2>
            <p className="text-gray-600 mb-4">
              Waiting for MQTT data from AI-Thinker A9G devices…
            </p>
            <p className="text-sm text-gray-500">
              Ensure your device is sending to: <code className="bg-gray-100 px-2 py-1 rounded">return/tracker/[device_id]/location</code>
            </p>
          </div>
        )}

        {/* Recent Events List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-bold text-gray-800">📋 Recent GPS Events</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {events.length > 0 ? (
              events.slice(0, 20).map((event, idx) => (
                <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 truncate">
                        {event.device_id}
                      </span>
                      {event.battery !== undefined && (
                        <Badge className={`text-xs px-2 py-1 rounded-full ${
                          event.battery <= 15 ? 'bg-red-100 text-red-700' :
                          event.battery <= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          <Battery className="w-3 h-3 mr-1 inline" />
                          {event.battery}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {event.lat.toFixed(6)}, {event.lon.toFixed(6)}
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

        {/* Integration Guide */}
        <div className="mt-8 bg-blue-50 rounded-xl shadow-md p-6 border-l-4 border-[#014CB3]">
          <h4 className="font-bold text-[#014CB3] mb-3">💡 Integration Guide</h4>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>
              <strong>1. Environment Setup:</strong> Add MQTT broker URL to <code className="bg-white px-1">.env.local</code>:
              <code className="block bg-white px-3 py-1 mt-1 rounded text-xs overflow-x-auto">
                MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
              </code>
            </li>
            <li>
              <strong>2. Device Configuration:</strong> A9G sends JSON to topic <code className="bg-white px-1">return/tracker/[device_id]/location</code>
            </li>
            <li>
              <strong>3. Backend:</strong> mqtt-bridge.ts subscribes, persists to database, emits SSE events
            </li>
            <li>
              <strong>4. Frontend Hook:</strong> <code className="bg-white px-1">useTrackerStream()</code> connects to /api/tracker/stream
            </li>
            <li>
              <strong>5. Component:</strong> Embed <code className="bg-white px-1">&lt;LiveDeviceTracker /&gt;</code> in case details or dedicated page
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
