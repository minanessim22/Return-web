┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RETURN + AI-THINKER A9G INTEGRATION DIAGRAM                  │
│                                                                                   │
│                           HARDWARE → CLOUD → WEB                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. HARDWARE LAYER (Your A9G Wristband)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   AI-Thinker A9G Device                                                          │
│   ───────────────────────                                                        │
│   • Collects GPS data (lat, lon)                                                │
│   • Reads battery level                                                         │
│   • Sends MQTT message every N minutes (configurable)                           │
│                                                                                   │
│   Payload:                                                                       │
│   {                                                                              │
│     "device_id": "RS-2026-01",                                                  │
│     "lat": 30.123456,                                                           │
│     "lon": 31.654321,                                                           │
│     "battery": 85,                                                              │
│     "timestamp": "2026-05-20T12:00:00Z"                                         │
│   }                                                                              │
│                                                                                   │
│   MQTT Topic: return/tracker/RS-2026-01/location                               │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
                                   MQTT Publish
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 2. PUBLIC BROKER LAYER (HiveMQ)                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   HiveMQ Public Broker                                                           │
│   ──────────────────────                                                        │
│   • URL: wss://broker.hivemq.com:8884/mqtt                                      │
│   • Topic: return/tracker/+/location                                            │
│   • No authentication required                                                  │
│   • Free for development                                                        │
│                                                                                   │
│   WebSocket (secure)                                                             │
│   │                                                                              │
│   └─→ Your Node.js Backend                                                      │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
                              MQTT Subscribe
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 3. BACKEND LAYER (Your Next.js Server)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   mqtt-bridge.ts (Node.js MQTT Client)                                          │
│   ──────────────────────────────────────                                        │
│   ✓ Connects to HiveMQ                                                          │
│   ✓ Subscribes to return/tracker/+/location                                     │
│   ✓ Listens for messages                                                        │
│   ✓ Parses JSON payload                                                         │
│   ✓ Matches device by serialNumber                                              │
│   ✓ Updates battery status                                                      │
│   ✓ Saves to GpsLocation table                                                  │
│   ✓ Emits SSE event to EventEmitter                                             │
│                                                                                   │
│                              │                                                   │
│                              ↓                                                   │
│                                                                                   │
│   /api/tracker/stream (SSE Endpoint)                                            │
│   ────────────────────────────────────                                          │
│   ✓ Boots MQTT bridge (idempotent)                                              │
│   ✓ Listens to EventEmitter                                                     │
│   ✓ Streams events to browser: event: location\ndata: {...}\n\n                │
│   ✓ 25-second heartbeat (prevents timeout)                                      │
│   ✓ Auto-reconnect on client disconnect                                         │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
                              Server-Sent Events
                                  (SSE Stream)
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND LAYER (Browser JavaScript)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   useTrackerStream Hook (React)                                                 │
│   ──────────────────────────────                                                │
│   ✓ Opens EventSource connection                                                │
│   ✓ Listens for "location" events                                               │
│   ✓ Updates React state: latestByDevice[deviceId]                               │
│   ✓ Auto-retry on disconnect (5 sec delay)                                      │
│   ✓ Keeps 200 recent events in memory                                           │
│                                                                                   │
│   Return Value:                                                                  │
│   {                                                                              │
│     events: [],                    // All received events                        │
│     latestByDevice: {},            // Latest per device                         │
│     connected: true                // Connection status                         │
│   }                                                                              │
│                                                                                   │
│                              │                                                   │
│                              ↓                                                   │
│                                                                                   │
│   Any React Component                                                            │
│   ──────────────────────                                                        │
│   const { latestByDevice } = useTrackerStream();                                │
│   // latestByDevice['RS-2026-01'] = { lat, lon, battery, ... }                 │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
                                 Component Render
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 5. UI LAYER (React Components)                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   <LiveDeviceTracker />                                                          │
│   ──────────────────────                                                        │
│   • Interactive Leaflet map                                                    │
│   • Live marker with green pulse                                                │
│   • Animated transitions between positions                                      │
│   • Battery %, timestamp, coordinates in popup                                  │
│   • Real-time updates as data arrives                                           │
│                                                                                   │
│   Props:                                                                         │
│   • deviceId: "uuid"                                                            │
│   • deviceSerialNumber: "RS-2026-01"                                            │
│   • profileName: "Ahmed Ali"                                                    │
│   • linkedProfileId: "uuid"                                                     │
│                                                                                   │
│   Usage:                                                                         │
│   <LiveDeviceTracker                                                             │
│     deviceId={caseData.linkedDeviceId}                                          │
│     deviceSerialNumber={caseData.linkedDeviceSerialNumber}                      │
│     profileName={caseData.profileName}                                          │
│   />                                                                             │
│                                                                                   │
│                              │                                                   │
│                              ├─→ Dashboard Status Badges                         │
│                              ├─→ Device List Indicators                          │
│                              └─→ Case Details Map                                │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
                                USER SEES LIVE MAP

┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXAMPLE: What User Sees at http://localhost:3000/tracking                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌────────────────────────────────────────────────────────┐                    │
│   │ 🟢 Connected to Stream                          ✓      │                    │
│   │ 1 device active • 45 recent events                    │                    │
│   └────────────────────────────────────────────────────────┘                    │
│                                                                                   │
│   ┌────────────────────────────────────────────────────────┐                    │
│   │          [Interactive Map with Live Marker]           │                    │
│   │                                                        │                    │
│   │              🟢 Ahmed Ali - Live Location              │                    │
│   │              (Green pulsing marker)                    │                    │
│   │                                                        │                    │
│   │          ┌─ Battery: 85%                          │    │                    │
│   │          ├─ Last Update: 12:00:45 PM              │    │                    │
│   │          └─ 30.123456, 31.654321                  │    │                    │
│   └────────────────────────────────────────────────────────┘                    │
│                                                                                   │
│   Recent GPS Events:                                                             │
│   • RS-2026-01        🔋 85%        12:00:45          30.123456, 31.654321      │
│   • RS-2026-01        🔋 84%        12:00:30          30.123400, 31.654300      │
│   • RS-2026-01        🔋 84%        12:00:15          30.123350, 31.654250      │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER (PostgreSQL)                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   devices table                                                                  │
│   ──────────────                                                                │
│   id: uuid                                                                      │
│   serialNumber: "RS-2026-01"  ← Matches MQTT device_id                          │
│   status: "ACTIVE"                                                              │
│   batteryLevel: 85                                                              │
│   trackingEnabled: true                                                         │
│                                                                                   │
│                              ↓                                                   │
│                                                                                   │
│   gps_locations table                                                            │
│   ───────────────────                                                           │
│   id: uuid                                                                      │
│   deviceId: uuid (foreign key)                                                  │
│   latitude: 30.123456                                                           │
│   longitude: 31.654321                                                          │
│   batteryLevel: 85                                                              │
│   recordedAt: 2026-05-20T12:00:00Z                                              │
│   createdAt: 2026-05-20T12:00:01Z                                               │
│                                                                                   │
│   (One record per MQTT message)                                                 │
│                                                                                   │
│                              ↓                                                   │
│                                                                                   │
│   device_links table                                                             │
│   ─────────────────                                                             │
│   deviceId: uuid                                                                │
│   profileId: uuid                                                               │
│   linkedAt: 2026-05-01T10:00:00Z                                                │
│                                                                                   │
│   (Connects device to identification profile)                                   │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ INTEGRATION POINTS (Where to Add Component)                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   1. Standalone Page:                                                            │
│      ✓ http://localhost:3000/tracking (Already works!)                          │
│                                                                                   │
│   2. Case Details Page:                                                          │
│      - Add: import { LiveDeviceTracker } from '@/components/LiveDeviceTracker'  │
│      - Add: <LiveDeviceTracker deviceId={...} deviceSerialNumber={...} />       │
│                                                                                   │
│   3. Dashboard Sidebar:                                                          │
│      - Add: <DeviceStatusBadge /> → Shows "3 devices live"                      │
│                                                                                   │
│   4. Device Management Panel:                                                    │
│      - Add: Per-device status badge with battery %                              │
│                                                                                   │
│   5. Anywhere You Need Real-Time GPS:                                            │
│      - Use: const { latestByDevice } = useTrackerStream();                       │
│      - Access: latestByDevice['RS-2026-01'].lat, .lon, .battery                 │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ TIMELINE: From A9G Send to Browser Display                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   T=0s    A9G sends MQTT message to HiveMQ                                      │
│   T+50ms  mqtt-bridge.ts receives message                                       │
│   T+60ms  Backend parses, saves to database                                     │
│   T+65ms  Backend emits SSE event                                               │
│   T+100ms Browser receives event                                                │
│   T+105ms React state updates                                                   │
│   T+110ms Component re-renders                                                  │
│   T+120ms Map marker updates + animation starts                                 │
│   T+500ms Animation completes                                                   │
│                                                                                   │
│   TOTAL: ~500ms from device to visible on map                                   │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ FILES & THEIR ROLES                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│ Backend:                                                                         │
│   src/lib/server/mqtt-bridge.ts ........... MQTT client + persistence            │
│   src/app/api/tracker/stream/route.ts .... SSE stream endpoint                   │
│                                                                                   │
│ Frontend:                                                                        │
│   src/lib/useTrackerStream.ts ............ React hook (EventSource)             │
│   src/components/LiveDeviceTracker.tsx ... Map component (Leaflet)              │
│   src/app/tracking/page.tsx ............. Example page                          │
│                                                                                   │
│ Database:                                                                        │
│   prisma/schema.prisma .................. GpsLocation, Device, DeviceLink       │
│                                                                                   │
│ Configuration:                                                                   │
│   .env.local ............................ MQTT_BROKER_URL + credentials          │
│   package.json .......................... mqtt npm package (v5.15.1)             │
│                                                                                   │
│ Documentation:                                                                   │
│   MQTT_CHECKLIST.md ..................... Quick start (read first!)              │
│   MQTT_INTEGRATION_GUIDE.md ............. Full reference                        │
│   MQTT_CODE_CHANGES.md .................. Copy-paste snippets                   │
│   MQTT_DOCKER_SETUP.md .................. Docker deployment                     │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

STATUS: ✅ READY TO GO
The entire data pipeline is built. Just add MQTT_BROKER_URL to .env.local!
