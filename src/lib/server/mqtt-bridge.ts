/**
 * mqtt-bridge.ts
 * ─────────────────────────────────────────────────────────────────────
 * Singleton MQTT subscriber that:
 *   1. Connects to the configured MQTT broker (e.g. HiveMQ public).
 *   2. Subscribes to   return/tracker/+/location
 *   3. On every valid GPS message it:
 *        – Persists the location to the matching device in the store.
 *        – Emits a "location" event so active SSE connections can push
 *          the update to the browser in real time.
 * ─────────────────────────────────────────────────────────────────────
 */

import { EventEmitter } from 'node:events';
import mqtt from 'mqtt';
import { addDeviceLocation, createNotification, readStore, updateStore } from '@/lib/server/store';

/* ── Types ── */

export interface TrackerLocationPayload {
  device_id: string;
  lat: number;
  lon: number;
  battery?: number;
  timestamp?: string;
}

export interface TrackerLocationEvent extends TrackerLocationPayload {
  receivedAt: string;
  topic: string;
}

/* ── Configuration ── */

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC      = process.env.MQTT_TOPIC      || 'return/tracker/+/location';
const MQTT_CLIENT_ID  = process.env.MQTT_CLIENT_ID   || `return-server-${Date.now()}`;
const MQTT_USERNAME   = process.env.MQTT_USERNAME     || undefined;
const MQTT_PASSWORD   = process.env.MQTT_PASSWORD     || undefined;

/* ── Globals (process-level singleton) ── */

const GLOBAL_KEY = '__return_mqtt_bridge__' as const;

type MqttBridgeGlobal = {
  client: mqtt.MqttClient | null;
  emitter: EventEmitter;
  connected: boolean;
  lastError: string | null;
  messageCount: number;
};

function getGlobal(): MqttBridgeGlobal {
  const g = globalThis as unknown as Record<string, MqttBridgeGlobal | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      client: null,
      emitter: new EventEmitter(),
      connected: false,
      lastError: null,
      messageCount: 0,
    };
    g[GLOBAL_KEY]!.emitter.setMaxListeners(200);
  }
  return g[GLOBAL_KEY]!;
}

/* ── Parsing & persistence ── */

function parsePayload(raw: Buffer, topic: string): TrackerLocationPayload | null {
  try {
    const json = JSON.parse(raw.toString('utf-8'));
    const lat = Number(json.lat ?? json.latitude);
    const lon = Number(json.lon ?? json.longitude ?? json.lng);
    const device_id = String(json.device_id ?? json.deviceId ?? '').trim();
    if (!device_id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return {
      device_id,
      lat,
      lon,
      battery: Number.isFinite(Number(json.battery)) ? Number(json.battery) : undefined,
      timestamp: json.timestamp ? String(json.timestamp) : undefined,
    };
  } catch {
    console.warn('[MQTT] Invalid JSON payload on topic', topic);
    return null;
  }
}

async function persistLocation(payload: TrackerLocationPayload): Promise<boolean> {
  try {
    const store = await readStore();
    // Match by serial number (device_id from hardware == serialNumber in our DB)
    const device = store.devices.find(
      (d) =>
        d.serialNumber === payload.device_id ||
        d.id === payload.device_id
    );
    if (!device) {
      console.warn(`[MQTT] No device found for device_id="${payload.device_id}". Ignoring.`);
      return false;
    }

    await updateStore((draft) => {
      const draftDevice = draft.devices.find((d) => d.id === device.id);
      if (!draftDevice) return;

      // Update battery
      if (payload.battery !== undefined) {
        draftDevice.batteryLevel = Math.max(0, Math.min(100, Math.round(payload.battery)));
        if (draftDevice.batteryLevel <= 15) {
          draftDevice.status = 'LOW_BATTERY';
        } else if (draftDevice.status === 'LOW_BATTERY' || draftDevice.status === 'DISCONNECTED') {
          draftDevice.status = 'ACTIVE';
        }
      }

      // Mark as active / connected
      if (draftDevice.status === 'DISCONNECTED' || draftDevice.status === 'INACTIVE') {
        draftDevice.status = 'ACTIVE';
      }

      // Update hardware bridge timestamps
      if (!draftDevice.hardwareBridge) {
        draftDevice.hardwareBridge = {
          ready: true,
          protocol: 'HTTP',
          ingressPath: '/api/hardware/devices/telemetry',
          headerName: 'x-device-token',
        };
      }
      const now = new Date().toISOString();
      draftDevice.hardwareBridge.lastSeenAt = now;
      draftDevice.hardwareBridge.lastEventAt = now;
      draftDevice.trackingEnabled = true;
      draftDevice.updatedAt = now;

      // Add location record
      addDeviceLocation(draft, draftDevice.id, {
        latitude: payload.lat,
        longitude: payload.lon,
        source: 'mqtt_a9g',
      });

      // Notify the device owner
      if (draftDevice.linkedProfileId) {
        const profile = draft.identificationProfiles.find((p) => p.id === draftDevice.linkedProfileId);
        if (profile) {
          createNotification(
            draft,
            profile.ownerUserId,
            'Live GPS Update',
            `${profile.displayName}'s wristband sent a live GPS update via MQTT.`,
            'gps_telemetry',
            undefined,
            `/devices`
          );
        }
      }
    });

    return true;
  } catch (error) {
    console.error('[MQTT] Error persisting location:', error);
    return false;
  }
}

/* ── MQTT Connection ── */

function startMqttClient() {
  const state = getGlobal();
  if (state.client) return; // already running

  console.log(`[MQTT] Connecting to ${MQTT_BROKER_URL} …`);

  const client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: MQTT_CLIENT_ID,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000,
    connectTimeout: 15000,
    clean: true,
  });

  state.client = client;

  client.on('connect', () => {
    console.log('[MQTT] Connected ✓');
    state.connected = true;
    state.lastError = null;
    client.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err);
        state.lastError = err.message;
      } else {
        console.log(`[MQTT] Subscribed to ${MQTT_TOPIC}`);
      }
    });
  });

  client.on('message', (topic: string, message: Buffer) => {
    const payload = parsePayload(message, topic);
    if (!payload) return;

    state.messageCount += 1;
    const event: TrackerLocationEvent = {
      ...payload,
      receivedAt: new Date().toISOString(),
      topic,
    };

    // Emit for SSE listeners
    state.emitter.emit('location', event);

    // Persist asynchronously – don't block the MQTT handler
    void persistLocation(payload);
  });

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
    state.lastError = err.message;
  });

  client.on('offline', () => {
    console.warn('[MQTT] Offline');
    state.connected = false;
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting…');
  });

  client.on('close', () => {
    state.connected = false;
  });
}

/* ── Public API ── */

/**
 * Ensure the MQTT bridge is running (idempotent – safe to call many times).
 */
export function ensureMqttBridge() {
  startMqttClient();
}

/**
 * Get the shared EventEmitter for SSE forwarding.
 * Events: "location" → TrackerLocationEvent
 */
export function getMqttEmitter(): EventEmitter {
  return getGlobal().emitter;
}

/**
 * Status snapshot for debugging / admin UI.
 */
export function getMqttStatus() {
  const state = getGlobal();
  return {
    connected: state.connected,
    lastError: state.lastError,
    messageCount: state.messageCount,
    brokerUrl: MQTT_BROKER_URL,
    topic: MQTT_TOPIC,
  };
}
