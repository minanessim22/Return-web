import { hashPassword, readStore, updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';

/**
 * Emergency admin password reset.
 * POST /api/auth/admin-reset
 * Body: { email: "admin@return.codes", newPassword: "Admin@Return2026" }
 *
 * ⚠️ DELETE THIS FILE AFTER USE — it's for dev/graduation demo only.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const newPassword = String(body.newPassword || '');

  if (!email || !newPassword) {
    return Response.json({ error: 'email and newPassword required' }, { status: 400 });
  }

  const store = await readStore();
  const user = store.users.find((u) => u.email.toLowerCase() === email);

  if (!user) {
    // User doesn't exist — create admin user
    const { randomUUID } = await import('crypto');
    await updateStore((draft) => {
      draft.users.push({
        id: randomUUID(),
        email: email,
        username: email.split('@')[0],
        name: 'Admin',
        passwordHash: hashPassword(newPassword),
        role: 'ADMIN',
        status: 'ACTIVE',
        failedLoginCount: 0,
        lockedUntil: undefined,
        avatarUrl: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        country: 'Egypt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: undefined,
        preference: {
          matchAlerts: true,
          foundCaseUpdates: true,
          nearbyAlerts: true,
          deviceAlerts: true,
          notificationsEnabled: true,
          enableQr: true,
          enableNfc: true,
          enableGps: true,
          enableBluetooth: false,
          enableWifi: false,
          gpsIntervalMinutes: 5,
          autoDownloadQr: false,
          showContactToFinder: true,
          hideSensitiveDetails: false,
          allowEmergencyLocation: true,
        },
      } as any);
    });
    return Response.json({ ok: true, action: 'created', email });
  }

  // User exists — reset password
  await updateStore((draft) => {
    const target = draft.users.find((u) => u.id === user.id);
    if (!target) return;
    target.passwordHash = hashPassword(newPassword);
    target.failedLoginCount = 0;
    target.lockedUntil = undefined;
    if (target.status === 'LOCKED') target.status = 'ACTIVE';
    target.updatedAt = new Date().toISOString();
  });

  return Response.json({ ok: true, action: 'password_reset', email, userId: user.id });
}
