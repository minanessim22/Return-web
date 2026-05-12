/**
 * MQTT + Real-Time GPS Integration Instructions
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Your AI-Thinker A9G wristband is already connected to your architecture.
 * Here are the EXACT changes needed to activate it in your existing pages.
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

// ──────────────────────────────────────────────────────────────────────
// 1. ENVIRONMENT VARIABLES
// ──────────────────────────────────────────────────────────────────────
// File: .env.local
// Add these lines (or update from .env.example):

MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
MQTT_TOPIC=return/tracker/+/location
MQTT_USERNAME=
MQTT_PASSWORD=

// For private/authenticated brokers:
MQTT_BROKER_URL=mqtt://broker.example.com:1883
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password


// ──────────────────────────────────────────────────────────────────────
// 2. BACKEND: MQTT Bridge (Already Implemented)
// ──────────────────────────────────────────────────────────────────────
// File: src/lib/server/mqtt-bridge.ts
// 
// STATUS: ✓ COMPLETE
// This file:
//   • Connects to MQTT broker
//   • Subscribes to return/tracker/+/location
//   • Parses JSON: { device_id, lat, lon, battery, timestamp }
//   • Persists to GpsLocation table
//   • Emits SSE events for real-time forwarding
// 
// No modifications needed. Already production-ready.


// ──────────────────────────────────────────────────────────────────────
// 3. API: SSE Stream Endpoint (Already Implemented)
// ──────────────────────────────────────────────────────────────────────
// File: src/app/api/tracker/stream/route.ts
//
// STATUS: ✓ COMPLETE
// This endpoint:
//   • Boots MQTT bridge
//   • Opens EventSource stream for browser
//   • Forwards "location" events in real-time
//   • Includes 25-second heartbeat
//
// Access via: GET /api/tracker/stream
// Response: Server-Sent Events (text/event-stream)
// 
// No modifications needed. Already production-ready.


// ──────────────────────────────────────────────────────────────────────
// 4. FRONTEND: React Hook (Already Implemented)
// ──────────────────────────────────────────────────────────────────────
// File: src/lib/useTrackerStream.ts
//
// STATUS: ✓ COMPLETE
// Usage in any React component:
//
//   import { useTrackerStream } from '@/lib/useTrackerStream';
//
//   export function MyComponent() {
//     const { events, latestByDevice, connected } = useTrackerStream();
//
//     // latestByDevice: { "RS-2026-01": { lat, lon, battery, ... }, ... }
//     // connected: boolean (true when SSE is active)
//     // events: array of all received events (last 200 kept)
//   }


// ──────────────────────────────────────────────────────────────────────
// 5. FRONTEND: Live Tracker Component (NEW)
// ──────────────────────────────────────────────────────────────────────
// File: src/components/LiveDeviceTracker.tsx
//
// STATUS: ✓ CREATED
// This component:
//   • Uses useTrackerStream hook
//   • Displays live map with animated marker
//   • Shows battery, timestamp, coordinates
//   • Auto-updates when new MQTT data arrives
//
// Usage in any page:
//
//   import { LiveDeviceTracker } from '@/components/LiveDeviceTracker';
//
//   export function YourPage() {
//     return (
//       <LiveDeviceTracker
//         deviceId="device-uuid-from-db"
//         deviceSerialNumber="RS-2026-01"
//         profileName="Ahmed Ali"
//         linkedProfileId="profile-uuid"
//       />
//     );
//   }


// ──────────────────────────────────────────────────────────────────────
// 6. FRONTEND: Example Tracking Page (NEW)
// ──────────────────────────────────────────────────────────────────────
// File: src/app/tracking/page.tsx
//
// STATUS: ✓ CREATED
// 
// This is a complete example showing:
//   • Connection status indicator
//   • Multiple device grid with live trackers
//   • Recent events list
//   • Integration guide
//
// Access via: /tracking


// ──────────────────────────────────────────────────────────────────────
// 7. INTEGRATION: Add Tracking to Case Details Page
// ──────────────────────────────────────────────────────────────────────
// 
// Find: src/app/case-details/page.tsx (or wherever you display case)
//
// At the TOP of the file, add import:
//
//   import { LiveDeviceTracker } from '@/components/LiveDeviceTracker';
//
// In your JSX, after case info section, add a conditional:
//
//   {caseData.linkedDeviceId && caseData.linkedDeviceSerialNumber ? (
//     <section className="mt-8">
//       <h2 className="text-2xl font-bold mb-4">Live Tracking</h2>
//       <LiveDeviceTracker
//         deviceId={caseData.linkedDeviceId}
//         deviceSerialNumber={caseData.linkedDeviceSerialNumber}
//         profileName={caseData.profileName || 'Unknown'}
//         linkedProfileId={caseData.linkedProfileId}
//       />
//     </section>
//   ) : null}
//
// Where:
//   • caseData.linkedDeviceId = UUID from Device table
//   • caseData.linkedDeviceSerialNumber = "RS-2026-01" from device
//   • caseData.profileName = "Ahmed Ali" (display name)
//   • caseData.linkedProfileId = UUID from IdentificationProfile


// ──────────────────────────────────────────────────────────────────────
// 8. INTEGRATION: Add Quick Device Status to Dashboard
// ──────────────────────────────────────────────────────────────────────
// 
// Find: src/app/lost-dashboard/page.tsx (in DevicesContent component)
// 
// Add import at top:
//   import { useTrackerStream } from '@/lib/useTrackerStream';
//
// Inside DevicesManagementPanel or inline, add status indicator:
//
//   export function DeviceStatusIndicator() {
//     const { latestByDevice, connected } = useTrackerStream();
//
//     return (
//       <div className="flex items-center gap-2">
//         <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
//         <span className="text-xs font-semibold">
//           {connected ? `Live (${Object.keys(latestByDevice).length} devices)` : 'Offline'}
//         </span>
//       </div>
//     );
//   }


// ──────────────────────────────────────────────────────────────────────
// 9. DATABASE: Verify Device-Profile Link
// ──────────────────────────────────────────────────────────────────────
//
// File: prisma/schema.prisma
// 
// Already has:
//   • Device model with serialNumber field
//   • DeviceLink model to connect Device → IdentificationProfile
//   • GpsLocation model to store location history
//   • Status field for ACTIVE/DISCONNECTED/LOW_BATTERY
//
// To fetch device with profile:
//
//   const device = await prisma.device.findUnique({
//     where: { id: deviceId },
//     include: {
//       links: { include: { profile: true } },
//       gpsLocations: { orderBy: { recordedAt: 'desc' }, take: 1 },
//     },
//   });


// ──────────────────────────────────────────────────────────────────────
// 10. DATA FLOW: Complete Path
// ──────────────────────────────────────────────────────────────────────
//
// A9G Device (HiveMQ Public Broker)
//     ↓ MQTT Publish
// Topic: return/tracker/RS-2026-01/location
// Payload: { device_id: "RS-2026-01", lat: 30.123, lon: 31.654, battery: 85, timestamp: "2026-05-20T12:00:00Z" }
//     ↓
// Backend: mqtt-bridge.ts (Node.js MQTT client)
//     ├→ Parses JSON
//     ├→ Matches device by serialNumber
//     ├→ Updates battery status
//     ├→ Persists to GpsLocation table
//     └→ Emits "location" event to EventEmitter
//     ↓
// API: /api/tracker/stream (SSE endpoint)
//     └→ Forwards event as: event: location\ndata: {...}\n\n
//     ↓
// Browser: EventSource('/api/tracker/stream')
//     └→ Received via useTrackerStream hook
//     ↓
// React State: latestByDevice[deviceId] updated
//     ↓
// Component: <LiveDeviceTracker /> re-renders
//     ↓
// Map: Marker animates to new position with live badge


// ──────────────────────────────────────────────────────────────────────
// 11. TESTING YOUR SETUP
// ──────────────────────────────────────────────────────────────────────
//
// Step 1: Verify environment
//   • Check .env.local has MQTT_BROKER_URL
//   • Restart Next.js dev server: npm run dev
//
// Step 2: Check backend connection
//   • Open browser DevTools
//   • Visit http://localhost:3000/api/tracker/stream
//   • Should see connection message or wait for data
//   • Check terminal logs for [MQTT] Connected ✓
//
// Step 3: Send test data
//   • Use MQTT.fx or mosquitto_pub:
//     mosquitto_pub -h broker.hivemq.com -t "return/tracker/RS-2026-01/location" \
//       -m '{"device_id":"RS-2026-01","lat":30.123,"lon":31.654,"battery":85,"timestamp":"2026-05-20T12:00:00Z"}'
//
// Step 4: Verify frontend receives it
//   • Visit http://localhost:3000/tracking
//   • Should show device with map marker
//   • Should see event in recent list
//   • Check browser console for no errors
//
// Step 5: Test in case page
//   • Create device in DB with serialNumber "RS-2026-01"
//   • Create profile and link to device
//   • Navigate to case details
//   • Should see <LiveDeviceTracker /> with live map


// ──────────────────────────────────────────────────────────────────────
// 12. TROUBLESHOOTING
// ──────────────────────────────────────────────────────────────────────
//
// ❌ "No devices found"
//   → Check A9G is sending to correct MQTT topic
//   → Verify MQTT_BROKER_URL in .env.local
//   → Check server logs for [MQTT] connection errors
//
// ❌ "Connecting..." never finishes
//   → Check if HiveMQ broker is accessible
//   → Try different broker: test.mosquitto.org, mqtt.eclipse.org
//   → Verify firewall/network allows WebSocket (8884)
//
// ❌ Map shows but no marker
//   → Device may be connected but no location yet
//   → Check serialNumber matches in database
//   → Verify GpsLocation table has entries
//
// ❌ Battery shows 0% or undefined
//   → A9G may not be sending battery field
//   → Check mqtt-bridge.ts parsePayload for battery extraction
//   → Device may need firmware update
//
// ❌ Battery status not updating in real-time
//   → Check DeviceLink relationship in Prisma
//   → Verify device record status field exists
//   → Check updateStore() is called in mqtt-bridge.ts
