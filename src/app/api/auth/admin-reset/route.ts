import { hashPassword, readStore, updateStore } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function performReset(email: string, newPassword: string) {
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
    return { ok: true, action: 'created', email };
  }

  // User exists — reset password
  await updateStore((draft) => {
    const target = draft.users.find((u) => u.id === user.id);
    if (!target) return;
    target.passwordHash = hashPassword(newPassword);
    target.failedLoginCount = 0;
    target.lockedUntil = undefined;
    target.status = 'ACTIVE';
    target.updatedAt = new Date().toISOString();
  });

  return { ok: true, action: 'password_reset', email, userId: user.id };
}

export async function GET(request: Request) {
  const result = await performReset('admin@return.codes', 'Admin@Return2026');
  return Response.json({
    message: 'Admin user has been successfully created/reset in the store.',
    result
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const newPassword = String(body.newPassword || '');

    if (!email || !newPassword) {
      return Response.json({ error: 'email and newPassword required' }, { status: 400 });
    }

    const result = await performReset(email, newPassword);
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
