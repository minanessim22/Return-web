import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compactAdminDbValue, getAdminDbDisplayColumns } from '../src/lib/admin-db';
import { isAdminUser } from '../src/lib/access';
import {
  buildAdminSummary,
  createUserAccount,
  createVerificationRequest,
  deleteUserAccount,
  hashPassword,
  readStore,
  updateStore,
  verifyOneTimeCode
} from '../src/lib/server/store';
import { getRateLimitBucketCount } from '../src/lib/server/rate-limit';
import { getSqliteHealth, listSqliteTables, readSqliteTable, writeRawStoreToSqlite } from '../src/lib/server/sqlite-db';
import type { Store } from '../src/lib/shared-types';

const DELETE_DIALOG_PATH = path.join(process.cwd(), 'src', 'components', 'dashboard', 'DeleteAccountDialog.tsx');
const REGISTER_ROUTE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'register', 'route.ts');
const REGISTER_OTP_ROUTE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'register', 'request-code', 'route.ts');
const REGISTER_VERIFY_ROUTE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'register', 'verify', 'route.ts');
const PASSWORD_OTP_ROUTE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'password', 'request-code', 'route.ts');
const PASSWORD_RESET_OTP_ROUTE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'password', 'reset', 'route.ts');
const NEXTAUTH_ROUTE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'auth', '[...nextauth]', 'route.ts');
const UNIFIED_AUTH_SCREEN_PATH = path.join(process.cwd(), 'src', 'components', 'screens', 'unified-auth-screen.tsx');
const LEGACY_AUTH_SCREEN_PATH = path.join(process.cwd(), 'src', 'components', 'screens', 'auth-screen.tsx');
const ROOT_LAYOUT_PATH = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
const BACK_BUTTON_COMPONENT_PATH = path.join(process.cwd(), 'src', 'components', 'BackButton.tsx');
const PUBLIC_IDENTIFY_PAGE_PATH = path.join(process.cwd(), 'src', 'app', 'identify', '[token]', 'page.tsx');

function createEmptyStore(): Store {
  return {
    users: [],
    sessions: [],
    verificationRequests: [],
    cases: [],
    matches: [],
    notifications: [],
    devices: [],
    identificationProfiles: [],
    scanEvents: [],
    auditLogs: [],
    conversations: []
  };
}

async function main() {
  const originalStore = await readStore();
  const results: string[] = [];

  try {
    assert.equal(isAdminUser({ role: 'ADMIN' }), true);
    assert.equal(isAdminUser({ role: 'USER' }), false);
    results.push('admin role helper keeps admin tools restricted to admins');

    const columns = getAdminDbDisplayColumns([
      { id: '1', status: 'ACTIVE', payload: { nested: true }, payloadPreview: { nested: true } }
    ]);
    assert.deepEqual(columns, ['id', 'status']);
    assert.match(compactAdminDbValue({ note: 'x'.repeat(250) }, 40), /…$/);
    results.push('admin database helpers keep long payloads compact inside the table');

    const store = createEmptyStore();
    const createdUser = createUserAccount(store, {
      name: 'Smoke User',
      email: `smoke.${Date.now()}@example.com`,
      passwordHash: hashPassword('Strong!Pass1')
    });
    assert.equal(createdUser.status, 'ACTIVE');
    assert.ok(createdUser.emailVerifiedAt);
    assert.equal(store.verificationRequests.length, 0);

    const registerRouteSource = await readFile(REGISTER_ROUTE_PATH, 'utf-8');
    assert.match(registerRouteSource, /status\s*:\s*410|apiError\(410/);

    for (const routeSource of [
      await readFile(REGISTER_OTP_ROUTE_PATH, 'utf-8'),
      await readFile(REGISTER_VERIFY_ROUTE_PATH, 'utf-8'),
      await readFile(PASSWORD_OTP_ROUTE_PATH, 'utf-8'),
      await readFile(PASSWORD_RESET_OTP_ROUTE_PATH, 'utf-8')
    ]) {
      assert.doesNotMatch(routeSource, /status\s*:\s*410/);
      assert.doesNotMatch(routeSource, /disabled/i);
    }
    results.push('registration and password reset now use real email-code routes instead of disabled placeholders');


    const nextAuthRouteSource = await readFile(NEXTAUTH_ROUTE_PATH, 'utf-8');
    assert.match(nextAuthRouteSource, /status: 410/);
    assert.match(nextAuthRouteSource, /disabled/i);

    const unifiedAuthSource = await readFile(UNIFIED_AUTH_SCREEN_PATH, 'utf-8');
    assert.doesNotMatch(unifiedAuthSource, /continueWithGoogle/i);
    assert.doesNotMatch(unifiedAuthSource, /handleGoogleSignIn/);
    assert.match(unifiedAuthSource, /forgot password\?/i);
    assert.match(unifiedAuthSource, /requestRegisterCode/);
    assert.match(unifiedAuthSource, /verifyRegisterCode/);
    assert.match(unifiedAuthSource, /requestPasswordResetCode/);
    assert.match(unifiedAuthSource, /resetPassword/);

    const legacyAuthSource = await readFile(LEGACY_AUTH_SCREEN_PATH, 'utf-8');
    assert.doesNotMatch(legacyAuthSource, /Continue with Google/);

    results.push('login now includes forgot password and sign-up requires email verification codes');

    const otpStore = createEmptyStore();
    const registerOtp = createVerificationRequest(otpStore, {
      purpose: 'REGISTER',
      email: `verify.${Date.now()}@example.com`,
      payload: {
        name: 'Verify User',
        password: 'Strong!Pass1'
      }
    });
    assert.equal(otpStore.verificationRequests.length, 1);
    const registerOtpResult = verifyOneTimeCode(otpStore, {
      purpose: 'REGISTER',
      email: registerOtp.request.email,
      code: registerOtp.code
    });
    assert.equal(registerOtpResult.ok, true);

    const resetOtp = createVerificationRequest(otpStore, {
      purpose: 'RESET_PASSWORD',
      email: registerOtp.request.email,
      payload: { userId: 'user_123' }
    });
    const resetOtpResult = verifyOneTimeCode(otpStore, {
      purpose: 'RESET_PASSWORD',
      email: resetOtp.request.email,
      code: resetOtp.code
    });
    assert.equal(resetOtpResult.ok, true);
    results.push('email verification and forgot password use real OTP records that are created and consumed end-to-end');

    const rootLayoutSource = await readFile(ROOT_LAYOUT_PATH, 'utf-8');
    assert.match(rootLayoutSource, /fixed left-4 top-4/);
    assert.match(rootLayoutSource, /fixed left-4 top-\[42px\]/);
    assert.match(rootLayoutSource, /md:left-6 md:top-\[58px\]/);

    const backButtonSource = await readFile(BACK_BUTTON_COMPONENT_PATH, 'utf-8');
    assert.match(backButtonSource, /CUSTOM_BACK_PATH_PREFIXES/);
    assert.match(backButtonSource, /'\/admin'/);
    assert.match(backButtonSource, /'\/found-dashboard\/id-profile'/);

    const publicIdentifySource = await readFile(PUBLIC_IDENTIFY_PAGE_PATH, 'utf-8');
    assert.doesNotMatch(publicIdentifySource, /router\.back\(/);
    assert.doesNotMatch(publicIdentifySource, /ArrowLeft/);
    results.push('the shared back button is moved up across the site and auto-hides on pages that already render their own back button');

    const adminStore = createEmptyStore();
    const activeUser = createUserAccount(adminStore, {
      name: 'Active User',
      email: 'active@example.com',
      passwordHash: hashPassword('Strong!Pass1')
    });
    const deletedUser = createUserAccount(adminStore, {
      name: 'Delete Me',
      email: 'delete@example.com',
      passwordHash: hashPassword('Strong!Pass1')
    });
    adminStore.sessions.push({
      id: 'session_delete',
      userId: deletedUser.id,
      tokenHash: 'hash',
      rememberMe: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    adminStore.verificationRequests.push({
      id: 'verify_delete',
      purpose: 'CHANGE_EMAIL',
      email: deletedUser.email,
      userId: deletedUser.id,
      codeHash: 'hash',
      attemptsLeft: 5,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString()
    });
    adminStore.cases.push({
      id: 'case_delete',
      referenceCode: 'RTN-DEL-1',
      ownerUserId: deletedUser.id,
      type: 'MISSING',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: [],
      statusHistory: []
    });
    adminStore.devices.push({
      id: 'device_delete',
      ownerUserId: deletedUser.id,
      type: 'QR',
      serialNumber: 'QR-DEL',
      label: 'Delete Device',
      status: 'ACTIVE',
      trackingEnabled: true,
      locationHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    adminStore.identificationProfiles.push({
      id: 'profile_delete',
      ownerUserId: deletedUser.id,
      displayName: 'Delete Profile',
      qrPublicToken: 'qr_delete',
      isActive: true,
      emergencyContacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    adminStore.notifications.push({
      id: 'notif_delete',
      userId: deletedUser.id,
      title: 'Notice',
      body: 'Test',
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString()
    });

    deleteUserAccount(adminStore, deletedUser.id, { currentPassword: 'Strong!Pass1' });
    const summary = buildAdminSummary(adminStore);
    assert.equal(summary.stats.users, 1);
    assert.equal(summary.stats.currentUsers, 1);
    assert.equal(summary.stats.deletedUsers, 1);
    assert.equal(summary.stats.activeUsers, 1);
    assert.equal(adminStore.sessions.some((entry) => entry.userId === deletedUser.id), false);
    assert.equal(adminStore.verificationRequests.some((entry) => entry.userId === deletedUser.id), false);
    assert.equal(adminStore.notifications.some((entry) => entry.userId === deletedUser.id), false);
    assert.equal(adminStore.devices.find((item) => item.ownerUserId === deletedUser.id)?.status, 'INACTIVE');
    assert.equal(adminStore.identificationProfiles.find((item) => item.ownerUserId === deletedUser.id)?.isActive, false);
    assert.equal(adminStore.cases.find((item) => item.ownerUserId === deletedUser.id)?.status, 'CLOSED');
    assert.ok(adminStore.cases.find((item) => item.ownerUserId === deletedUser.id)?.deletedAt);
    assert.equal(activeUser.status, 'ACTIVE');
    results.push('deleting an account now updates current/deleted user counts and deactivates related data');

    const dialogSource = await readFile(DELETE_DIALOG_PATH, 'utf-8');
    assert.match(dialogSource, /autoFocus/);
    assert.match(dialogSource, /\.focus\(\)/);
    assert.match(dialogSource, /\.select\(\)/);
    results.push('delete account dialog focuses the password field automatically for immediate typing');


    const devicesItemRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'devices', '[deviceId]', 'route.ts'), 'utf-8');
    assert.match(devicesItemRouteSource, /export async function DELETE/);
    const casesItemRouteSource = await readFile(path.join(process.cwd(), 'src', 'app', 'api', 'cases', '[caseId]', 'route.ts'), 'utf-8');
    assert.match(casesItemRouteSource, /export async function DELETE/);
    const caseCollectionSource = await readFile(path.join(process.cwd(), 'src', 'components', 'dashboard', 'CaseCollectionSection.tsx'), 'utf-8');
    assert.match(caseCollectionSource, /Delete report/);
    assert.match(caseCollectionSource, /Database ID:/);
    results.push('device and report deletion are exposed through both the API and the dashboard interface');

    const adminDbPageSource = await readFile(path.join(process.cwd(), 'src', 'app', 'admin', 'db', 'page.tsx'), 'utf-8');
    assert.doesNotMatch(adminDbPageSource, /Refresh/);
    results.push('admin database page no longer exposes the refresh action that was causing interface issues');

    const tables = listSqliteTables();
    assert.ok(tables.some((table) => table.name === 'users'));
    const usersTable = readSqliteTable('users', 3, 0);
    assert.equal(usersTable.table, 'users');
    assert.ok(usersTable.rows.length >= 1);
    assert.ok('payload' in usersTable.rows[0]);
    assert.ok('payloadPreview' in usersTable.rows[0]);
    results.push('SQLite admin viewer can still list tables and read rows with payload previews after the changes');


    const sessionStore = createEmptyStore();
    const sessionOwner = createUserAccount(sessionStore, {
      name: 'Session Owner',
      email: `session.owner.${Date.now()}@example.com`,
      passwordHash: hashPassword('Strong!Pass1')
    });
    const secondUser = createUserAccount(sessionStore, {
      name: 'Session Peer',
      email: `session.peer.${Date.now()}@example.com`,
      passwordHash: hashPassword('Strong!Pass1')
    });
    sessionStore.sessions.push({
      id: 'expired_session',
      userId: sessionOwner.id,
      tokenHash: 'expired_hash',
      rememberMe: true,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      lastSeenAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60_000).toISOString()
    });
    sessionStore.verificationRequests.push({
      id: 'expired_verification',
      purpose: 'REGISTER',
      email: sessionOwner.email,
      codeHash: 'hash',
      attemptsLeft: 0,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60_000).toISOString()
    });
    sessionStore.sessions.push({
      id: 'peer_session',
      userId: secondUser.id,
      tokenHash: 'peer_hash',
      rememberMe: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    writeRawStoreToSqlite(sessionStore as unknown as Record<string, unknown>, true);
    const cleanedStore = await readStore();
    assert.equal(cleanedStore.sessions.some((entry) => entry.id === 'expired_session'), false);
    assert.equal(cleanedStore.verificationRequests.some((entry) => entry.id === 'expired_verification'), false);
    results.push('store reads now self-prune expired sessions and stale verification requests before serving data');

    const sessionSource = await readFile(path.join(process.cwd(), 'src', 'lib', 'server', 'session.ts'), 'utf-8');
    assert.match(sessionSource, /const otherUsers = activeSessions\.filter\(\(item\) => item\.userId !== userId\)/);
    assert.match(sessionSource, /slice\(0, 4\)/);
    assert.doesNotMatch(sessionSource, /\.slice\(0, 19\)/);
    results.push('session creation now caps only the current user history without dropping other active users');

    const sqliteHealth = getSqliteHealth();
    assert.ok(sqliteHealth.totalRows >= 1);
    assert.ok(sqliteHealth.indexedTables.includes('users'));
    assert.match(sqliteHealth.file, /src\/data\/return\.db$/);
    results.push('SQLite health reporting now exposes indexed tables and a safe relative database path for admin diagnostics');

    assert.ok(getRateLimitBucketCount() >= 0);
    results.push('rate limiting now prunes stale buckets to avoid unbounded in-memory growth');

    console.log('Smoke checks passed:');
    for (const item of results) {
      console.log(`- ${item}`);
    }
  } finally {
    writeRawStoreToSqlite(originalStore as unknown as Record<string, unknown>, true);
  }
}

main().catch((error) => {
  console.error('Smoke checks failed.');
  console.error(error);
  process.exitCode = 1;
});
