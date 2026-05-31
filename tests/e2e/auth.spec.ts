import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const TEST_EMAIL = 'e2etest@example.com';
const TEST_USERNAME = 'e2etest';
const TEST_PASSWORD = 'E2eTestPassword@123';

test.describe('Authentication API & Locks E2E', () => {
  test.beforeAll(async () => {
    // Generate secure password hash
    const salt = randomBytes(16).toString('hex');
    const passwordHash = `scrypt:${salt}:${scryptSync(TEST_PASSWORD, salt, 64).toString('hex')}`;

    // Ensure clean test user exists
    await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: {
        username: TEST_USERNAME,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        name: 'E2E Test User',
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup sessions and the test user
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  test('login with correct credentials sets session cookies and returns user data', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/login',
      },
      data: {
        emailOrUsername: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(TEST_EMAIL);
    expect(body).toHaveProperty('accessToken');

    // Verify Set-Cookie header contains return_session
    const headers = response.headers();
    const setCookie = headers['set-cookie'] || '';
    expect(setCookie).toContain('return_session');
  });

  test('login with incorrect password returns 401 Unauthorized', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/login',
      },
      data: {
        emailOrUsername: TEST_EMAIL,
        password: 'WrongPassword@123',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Invalid credentials.');
  });

  test('logout clears the session cookie', async ({ request }) => {
    // Perform login first
    const loginResponse = await request.post('/api/auth/login', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/login',
      },
      data: {
        emailOrUsername: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    expect(loginResponse.status()).toBe(200);

    const headers = loginResponse.headers();
    const setCookie = headers['set-cookie'] || '';
    const cookieMatch = setCookie.match(/return_session=([^;]+)/);
    const sessionToken = cookieMatch ? cookieMatch[1] : '';

    // Now perform logout
    const logoutResponse = await request.post('/api/auth/logout', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/dashboard',
        Cookie: `return_session=${sessionToken}`,
      },
    });

    expect(logoutResponse.status()).toBe(200);

    // Verify logout set-cookie expires the return_session cookie
    const logoutSetCookie = logoutResponse.headers()['set-cookie'] || '';
    expect(logoutSetCookie).toContain('return_session=;');
    expect(logoutSetCookie).toContain('Max-Age=0');
  });

  test('rejects non-admin users from accessing protected admin endpoints', async ({ request }) => {
    // Perform login as the TEST_EMAIL (who has role USER)
    const loginResponse = await request.post('/api/auth/login', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/login',
      },
      data: {
        emailOrUsername: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    expect(loginResponse.status()).toBe(200);

    const headers = loginResponse.headers();
    const setCookie = headers['set-cookie'] || '';
    const cookieMatch = setCookie.match(/return_session=([^;]+)/);
    const sessionToken = cookieMatch ? cookieMatch[1] : '';

    // Make request to admin-only endpoint
    const adminResponse = await request.get('/api/admin/summary', {
      headers: {
        Cookie: `return_session=${sessionToken}`,
      },
    });

    expect(adminResponse.status()).toBe(403);
    const body = await adminResponse.json();
    expect(body).toHaveProperty('error', 'Admin access required.');
  });

  test('temporarily locks the account after 5 failed login attempts', async ({ request }) => {
    // Make sure failed count is reset first
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    // Make 4 failed attempts (returns 401)
    for (let i = 0; i < 4; i++) {
      const response = await request.post('/api/auth/login', {
        headers: {
          Origin: 'http://localhost:3000',
          Referer: 'http://localhost:3000/login',
        },
        data: {
          emailOrUsername: TEST_EMAIL,
          password: 'WrongPassword@123',
        },
      });
      expect(response.status()).toBe(401);
    }

    // The 5th failed attempt should lock the account and return 423
    const responseLock = await request.post('/api/auth/login', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/login',
      },
      data: {
        emailOrUsername: TEST_EMAIL,
        password: 'WrongPassword@123',
      },
    });

    expect(responseLock.status()).toBe(423);
    const bodyLock = await responseLock.json();
    expect(bodyLock.error).toContain('locked');

    // A 6th attempt (even with the correct password) should still return 423 Locked
    const responseLockedCorrect = await request.post('/api/auth/login', {
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/login',
      },
      data: {
        emailOrUsername: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
    expect(responseLockedCorrect.status()).toBe(423);
  });
});
