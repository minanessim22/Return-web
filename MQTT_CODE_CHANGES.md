/**
 * MQTT Integration: Line-by-Line Code Changes
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Copy-paste these exact changes into your files.
 * All changes are additive (no existing code removed).
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

// ──────────────────────────────────────────────────────────────────────
// FILE 1: .env.local (or .env.example)
// ──────────────────────────────────────────────────────────────────────
// 
// ADD THESE LINES at the end:

/*
# ── MQTT Configuration for AI-Thinker A9G Hardware ──
# MQTT broker URL for GPS tracking device telemetry
MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
# MQTT topic pattern to subscribe to (device_id is wildcarded)
MQTT_TOPIC=return/tracker/+/location
# Optional: MQTT client ID (auto-generated if not set)
# MQTT_CLIENT_ID=return-server-${timestamp}
# Optional: MQTT authentication credentials (if broker requires them)
# MQTT_USERNAME=
# MQTT_PASSWORD=
*/


// ──────────────────────────────────────────────────────────────────────
// FILE 2: src/components/Map.tsx (ALREADY HAS LIVE MARKER SUPPORT)
// ──────────────────────────────────────────────────────────────────────
// 
// STATUS: ✓ NO CHANGES NEEDED
// The Map.tsx already supports:
//   • live?: boolean (shows green pulsing marker)
//   • animate?: boolean (smooth marker transitions)
//   • MarkerPoint with battery, lastSeen fields
//
// Your component already passes:
//   animate={true}
//   live={true}
//   battery={latestLocation.battery}
//   lastSeen={latestLocation.receivedAt}


// ──────────────────────────────────────────────────────────────────────
// FILE 3: src/components/dashboard/DevicesManagementPanel.tsx
// ──────────────────────────────────────────────────────────────────────
// 
// If this file exists and shows device list, ADD this import and section:
//
// LOCATION: At the top with other imports
// ADD:
/*
import { useTrackerStream } from '@/lib/useTrackerStream';
import { Activity, Wifi, WifiOff } from 'lucide-react';
*/

// LOCATION: Inside your device card rendering loop
// ADD STATUS INDICATOR before device name:
/*
const { latestByDevice, connected } = useTrackerStream();
const deviceLatest = latestByDevice[device.serialNumber];

return (
  <div className="device-card">
    <div className="flex items-center gap-2 mb-2">
      {deviceLatest ? (
        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
          <Activity className="w-3 h-3 animate-pulse" />
          Live - {deviceLatest.battery}%
        </span>
      ) : connected ? (
        <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          <Wifi className="w-3 h-3" />
          Waiting…
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
          <WifiOff className="w-3 h-3" />
          Offline
        </span>
      )}
    </div>
    {/* rest of device card */}
  </div>
);
*/


// ──────────────────────────────────────────────────────────────────────
// FILE 4: src/app/case-details/page.tsx (or case detail component)
// ──────────────────────────────────────────────────────────────────────
// 
// CHANGE #1: ADD IMPORT AT TOP
// LOCATION: Line 1-20 with other imports
// ADD:
/*
import { LiveDeviceTracker } from '@/components/LiveDeviceTracker';
*/

// CHANGE #2: ADD TRACKING SECTION IN JSX
// LOCATION: After case description/info sections, before closing div
// ADD:
/*
{/* Live GPS Tracking Section */}
{caseData?.linkedDevices && caseData.linkedDevices.length > 0 && caseData.linkedDevices[0] ? (
  <section className="mt-10 border-t-2 border-gray-200 pt-8">
    <h2 className="text-2xl font-black text-[#014CB3] mb-6">📡 Live Device Tracking</h2>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {caseData.linkedDevices.map((device: any) => (
        <LiveDeviceTracker
          key={device.id}
          deviceId={device.id}
          deviceSerialNumber={device.serialNumber}
          profileName={caseData.fullName || caseData.displayName || 'Unknown'}
          linkedProfileId={caseData.id}
        />
      ))}
    </div>
  </section>
) : null}
*/

// CHANGE #3: ENSURE CASE DATA INCLUDES DEVICE INFO
// LOCATION: Where you fetch caseData (in useEffect or server component)
// MAKE SURE YOUR QUERY INCLUDES:
/*
// If using Prisma:
const caseItem = await prisma.caseItem.findUnique({
  where: { id: caseId },
  include: {
    images: true,
    owner: true,
    // ADD:
    relatedDevices: {
      include: {
        links: {
          include: { profile: true },
        },
      },
    },
  },
});

// Map to your caseData structure:
const caseData = {
  ...caseItem,
  linkedDevices: caseItem.relatedDevices || [],
};
*/


// ──────────────────────────────────────────────────────────────────────
// FILE 5: src/app/lost-dashboard/page.tsx
// ──────────────────────────────────────────────────────────────────────
// 
// OPTIONAL: Show device status in dashboard overview
//
// CHANGE: In OverviewContent or similar section
// ADD import:
/*
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { useTrackerStream } from '@/lib/useTrackerStream';
*/

// ADD this component before main return:
/*
function DeviceStatusBadge() {
  const { connected, latestByDevice } = useTrackerStream();
  const activeCount = Object.keys(latestByDevice).length;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md">
      {connected ? (
        <>
          <Activity className="w-4 h-4 text-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-gray-700">
            {activeCount} device(s) live
          </span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Connecting…</span>
        </>
      )}
    </div>
  );
}
*/

// ADD in the stats/header section:
/*
<DeviceStatusBadge />
*/


// ──────────────────────────────────────────────────────────────────────
// FILE 6: src/app/api/devices/route.ts (or GET handler)
// ──────────────────────────────────────────────────────────────────────
// 
// OPTIONAL: Add endpoint to fetch device with latest GPS location
// 
// CREATE if doesn't exist, or ADD this handler:
/*
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('id');
  const serialNumber = searchParams.get('serial');

  if (!deviceId && !serialNumber) {
    return Response.json({ error: 'Missing id or serial' }, { status: 400 });
  }

  try {
    const device = await prisma.device.findFirst({
      where: deviceId
        ? { id: deviceId }
        : { serialNumber: serialNumber },
      include: {
        links: {
          include: { profile: true },
        },
        gpsLocations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!device) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    return Response.json({
      id: device.id,
      serialNumber: device.serialNumber,
      status: device.status,
      battery: device.batteryLevel,
      linkedProfiles: device.links.map(l => ({
        id: l.profile.id,
        name: l.profile.displayName,
      })),
      lastLocation: device.gpsLocations[0] || null,
    });
  } catch (error) {
    console.error('Device fetch error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
*/


// ──────────────────────────────────────────────────────────────────────
// FILE 7: package.json (VERIFY mqtt DEPENDENCY)
// ──────────────────────────────────────────────────────────────────────
// 
// VERIFY this is already present in dependencies:
// "mqtt": "^5.15.1"
// 
// If NOT present, run:
// npm install mqtt
// 
// STATUS: Already in your package.json ✓


// ──────────────────────────────────────────────────────────────────────
// SUMMARY: What Gets Deployed
// ──────────────────────────────────────────────────────────────────────
// 
// ✓ Backend (Node.js):
//   • mqtt-bridge.ts - Connects to HiveMQ, subscribes, persists
//   • /api/tracker/stream - SSE endpoint for browser
//   • Existing: store.ts, stqlite-db.ts
//
// ✓ Frontend (React):
//   • useTrackerStream hook - EventSource + state management
//   • <LiveDeviceTracker /> - Map component with live updates
//   • /tracking - Example page with device list
//   • Dashboard badges - Optional status indicators
//
// ✓ Database:
//   • GpsLocation table - Records lat/lon/battery/time
//   • Device.serialNumber - Matches MQTT device_id
//   • DeviceLink - Connects device to profile
//
// ✓ Environment:
//   • MQTT_BROKER_URL - Broker connection URL
//   • MQTT_TOPIC - Topic pattern to subscribe
//   • MQTT_USERNAME/PASSWORD - Optional auth


// ──────────────────────────────────────────────────────────────────────
// QUICK START: Minimal Integration (5 minutes)
// ──────────────────────────────────────────────────────────────────────
// 
// 1. Copy MQTT_BROKER_URL to .env.local
// 2. Restart Next.js: npm run dev
// 3. Visit http://localhost:3000/tracking
// 4. Send test MQTT message (see MQTT_INTEGRATION_GUIDE.md)
// 5. Watch live marker appear on map
// 
// Done! Your A9G is now live.
