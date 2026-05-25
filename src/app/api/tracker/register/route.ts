/**
 * /api/tracker/register
 * ─────────────────────────────────────────────────────────────────
 * Admin-only endpoint for managing the tracker device whitelist.
 *
 * GET  /api/tracker/register
 *   → List all registered tracker devices
 *   Response: { trackers: RegisteredTracker[], count: number }
 *
 * POST /api/tracker/register
 *   → Register a new device (or update an existing one)
 *   Body: { device_id: string, label?: string, owner_email?: string }
 *   Response: { created: boolean, tracker: RegisteredTracker }
 *
 * DELETE /api/tracker/register?device_id=A9G-01
 *   → Remove a device from the whitelist
 *   Response: { deleted: boolean }
 *
 * Security: Currently open — in production, wrap with auth middleware
 * to check that the caller has ADMIN or OPERATOR role.
 * ─────────────────────────────────────────────────────────────────
 */

import {
  registerTracker,
  unregisterTracker,
  listRegisteredTrackers,
  getRegisteredTracker,
} from '@/lib/server/sqlite-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── GET – List all registered trackers ────────────────────────────

export async function GET() {
  const trackers = listRegisteredTrackers();
  return Response.json(
    { trackers, count: trackers.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// ── POST – Register a new tracker ─────────────────────────────────

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const deviceId = String(body.device_id ?? '').trim();
  if (!deviceId) {
    return Response.json({ error: 'device_id required' }, { status: 400 });
  }

  // Validate device_id format: alphanumeric + dashes/underscores, 2-64 chars
  if (!/^[\w\-]{2,64}$/i.test(deviceId)) {
    return Response.json(
      { error: 'device_id must be 2-64 alphanumeric characters, dashes, or underscores' },
      { status: 400 }
    );
  }

  const label = body.label ? String(body.label).trim().slice(0, 100) : undefined;
  const ownerEmail = body.owner_email ? String(body.owner_email).trim().toLowerCase() : undefined;

  const created = registerTracker(deviceId, label, ownerEmail, 'manual');
  const tracker = getRegisteredTracker(deviceId);

  console.log(
    created
      ? `[REGISTER] New tracker registered: ${deviceId}${label ? ` (${label})` : ''}`
      : `[REGISTER] Tracker updated: ${deviceId}`
  );

  return Response.json(
    { created, tracker },
    { status: created ? 201 : 200 }
  );
}

// ── DELETE – Unregister a tracker ─────────────────────────────────

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id')?.trim();

  if (!deviceId) {
    return Response.json({ error: 'device_id required' }, { status: 400 });
  }

  const deleted = unregisterTracker(deviceId);

  if (deleted) {
    console.log(`[REGISTER] Tracker removed: ${deviceId}`);
  }

  return Response.json(
    { deleted },
    { status: deleted ? 200 : 404 }
  );
}
