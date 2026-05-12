/**
 * GET /api/tracker/status
 * ─────────────────────────────────────────────────
 * Returns the current MQTT bridge connection status.
 * Useful for the admin panel / debug UI.
 * ─────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttStatus } from '@/lib/server/mqtt-bridge';
import { apiJson } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET() {
  ensureMqttBridge();
  return apiJson(getMqttStatus());
}
