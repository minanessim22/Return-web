<!-- Quick Reference: What to Change and Where -->

# ⚡ MQTT Integration Checklist

## Status: Everything is Already Built ✓

Your project has a **complete end-to-end MQTT tracking system** pre-configured. Most work is already done. Here's what you need to do to activate it.

---

## 🟢 MINIMUM SETUP (Required - 5 minutes)

### 1. **Update `.env.local`**
```bash
# Add these 3 lines:
MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
MQTT_TOPIC=return/tracker/+/location
MQTT_USERNAME=
```
- **Why**: Tells backend where your A9G sends data
- **File**: `.env.local`
- **Time**: 1 minute

### 2. **Restart Next.js Dev Server**
```bash
npm run dev
# Stop (Ctrl+C) and restart
```
- **Why**: Reloads environment variables
- **Time**: 30 seconds

### 3. **Test MQTT Connection**
```bash
# In new terminal, send test data:
mosquitto_pub -h broker.hivemq.com -t "return/tracker/RS-2026-01/location" \
  -m '{"device_id":"RS-2026-01","lat":30.123,"lon":31.654,"battery":85,"timestamp":"2026-05-20T12:00:00Z"}'
```
- **Why**: Verifies data flow from A9G → HiveMQ → Backend
- **Time**: 1 minute

### 4. **Visit Tracking Page**
```
http://localhost:3000/tracking
```
- **What you'll see**: 
  - Connection status badge
  - Live map with your device marker
  - Recent GPS events list
- **Time**: 1 minute

---

## 🟡 RECOMMENDED SETUP (Nice to have - 10 minutes)

### 5. **Add Tracker to Case Details**
**File**: `src/app/case-details/page.tsx` (or wherever you show case)

**Change 1** - Add import (line 1-30):
```tsx
import { LiveDeviceTracker } from '@/components/LiveDeviceTracker';
```

**Change 2** - Add section in JSX (after case info):
```tsx
{caseData?.linkedDevices && caseData.linkedDevices.length > 0 ? (
  <section className="mt-10 border-t-2 border-gray-200 pt-8">
    <h2 className="text-2xl font-black text-[#014CB3] mb-6">📡 Live Device Tracking</h2>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {caseData.linkedDevices.map((device) => (
        <LiveDeviceTracker
          key={device.id}
          deviceId={device.id}
          deviceSerialNumber={device.serialNumber}
          profileName={caseData.fullName || 'Unknown'}
          linkedProfileId={caseData.id}
        />
      ))}
    </div>
  </section>
) : null}
```

**Change 3** - Update case fetch query:
```tsx
// Add to your Prisma query:
include: {
  relatedDevices: {
    include: { links: { include: { profile: true } } },
  },
}
```

**Why**: Embedded live map in case details page  
**Time**: 5 minutes

### 6. **Add Device Status Badge to Dashboard**
**File**: `src/app/lost-dashboard/page.tsx`

**Change** - In OverviewContent section, add:
```tsx
import { useTrackerStream } from '@/lib/useTrackerStream';
import { Activity, Wifi } from 'lucide-react';

function DeviceStatusBadge() {
  const { connected, latestByDevice } = useTrackerStream();
  const activeCount = Object.keys(latestByDevice).length;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md">
      <Activity className={`w-4 h-4 ${connected ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
      <span className="text-sm font-semibold text-gray-700">
        {connected ? `${activeCount} device(s) live` : 'Connecting…'}
      </span>
    </div>
  );
}
```

Then add `<DeviceStatusBadge />` in your header/stats area.

**Why**: Quick visual indicator of device connectivity  
**Time**: 3 minutes

### 7. **Add Device Status to Device List**
**File**: `src/components/dashboard/DevicesManagementPanel.tsx` (if it exists)

**Change** - In device card rendering:
```tsx
import { useTrackerStream } from '@/lib/useTrackerStream';
import { Activity, Wifi, WifiOff } from 'lucide-react';

const { latestByDevice, connected } = useTrackerStream();
const deviceLatest = latestByDevice[device.serialNumber];

// In device card JSX:
{deviceLatest ? (
  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
    🟢 Live - {deviceLatest.battery}%
  </span>
) : connected ? (
  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
    ⏳ Waiting…
  </span>
) : (
  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
    ⚪ Offline
  </span>
)}
```

**Why**: Per-device status in device management panel  
**Time**: 2 minutes

---

## 📋 Files Already Created for You

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/server/mqtt-bridge.ts` | MQTT client + persistence | ✓ Ready |
| `src/app/api/tracker/stream/route.ts` | SSE endpoint | ✓ Ready |
| `src/lib/useTrackerStream.ts` | React hook | ✓ Ready |
| `src/components/LiveDeviceTracker.tsx` | Live map component | ✓ New |
| `src/app/tracking/page.tsx` | Example tracking page | ✓ New |
| `MQTT_INTEGRATION_GUIDE.md` | Full technical guide | ✓ New |
| `MQTT_CODE_CHANGES.md` | Line-by-line changes | ✓ New |
| `MQTT_CHECKLIST.md` | This file | ✓ New |

---

## 🔄 Data Flow (Complete Path)

```
AI-Thinker A9G Device
    ↓ MQTT Publish
HiveMQ Public Broker (broker.hivemq.com:8884)
    ↓ MQTT Subscribe
mqtt-bridge.ts (Node.js server)
    ├→ Parse JSON payload
    ├→ Match device by serialNumber
    ├→ Update battery/status
    ├→ Save to GpsLocation table
    └→ Emit SSE event
    ↓
/api/tracker/stream (SSE endpoint)
    └→ Send: event: location\ndata: {...}\n\n
    ↓
Browser EventSource
    └→ useTrackerStream hook
    ↓
React State: latestByDevice[deviceId]
    ↓
Component Re-render
    ├→ <LiveDeviceTracker />
    ├→ <DeviceStatusBadge />
    └→ Dashboard indicators
    ↓
Map Marker Updates
    ├→ Smooth animation
    ├→ Live badge (green pulsing)
    ├→ Battery percentage
    ├→ Timestamp
    └→ Coordinates
```

---

## ✅ Verification Steps

### Step 1: Backend Connected?
- [ ] Check server logs: `[MQTT] Connected ✓`
- [ ] Visit `/api/tracker/stream` in browser
- [ ] Should see: `event: connected` message

### Step 2: Device Sending Data?
- [ ] Send test MQTT message (see section 🟢 #3)
- [ ] Check server logs: `[MQTT] Subscribed to return/tracker/+/location`
- [ ] Check server logs: `[MQTT] Message received` or location event

### Step 3: Frontend Receiving?
- [ ] Visit `http://localhost:3000/tracking`
- [ ] Should show "Connected to Stream"
- [ ] Should show your device with green marker
- [ ] Recent events should list updates

### Step 4: Live Update?
- [ ] Send another MQTT message with different coordinates
- [ ] Map marker should move smoothly
- [ ] Battery % should update
- [ ] Timestamp should change

---

## 🐛 Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| "No Devices Found" | MQTT_BROKER_URL set? | Add to `.env.local` |
| "Connecting…" won't finish | Firewall blocking 8884? | Try different broker: `mqtt://test.mosquitto.org:1883` |
| Map shows but no marker | Device serialNumber matches? | Check `Device.serialNumber == MQTT device_id` |
| Battery always 0% | A9G sending battery field? | Check MQTT payload includes `"battery": 85` |
| No SSE connection | Browser console errors? | Check `/api/tracker/stream` is accessible |

---

## 🚀 Production Deployment

1. **Update `.env` (not `.env.local`) on server** with real MQTT broker
2. **Ensure MQTT broker is accessible** from your server (IP, port, TLS)
3. **Optional: Use authenticated MQTT broker**
   - Set `MQTT_USERNAME` and `MQTT_PASSWORD`
   - Use `mqtt://` for plain TCP or `wss://` for WebSocket
4. **Monitor**: Check `[MQTT]` logs in your server logs
5. **Alert**: Set up notifications if device disconnects (LOW_BATTERY status)

---

## 📚 Next Steps

1. **Minimal**: Complete section 🟢 (5 min)
2. **Recommended**: Add section 🟡 #5 (case details) (5 min)
3. **Polish**: Add section 🟡 #6 & #7 (badges) (5 min)
4. **Deploy**: Push to production

**Total Time: ~20 minutes to fully integrated system**

---

## 📞 Reference Files

- **Full guide**: `MQTT_INTEGRATION_GUIDE.md`
- **Code changes**: `MQTT_CODE_CHANGES.md`
- **This checklist**: `MQTT_CHECKLIST.md`

**Questions? Check the full guide first!**
