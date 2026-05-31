import { test, expect } from '@playwright/test';

test.describe('Cron DB Cleanup Endpoint', () => {
  test('rejects request with missing or invalid Authorization header', async ({ request }) => {
    // Missing header
    const responseNoAuth = await request.get('/api/cron/cleanup-sessions');
    expect(responseNoAuth.status()).toBe(401);

    // Invalid token
    const responseBadAuth = await request.get('/api/cron/cleanup-sessions', {
      headers: {
        Authorization: 'Bearer invalid_cron_secret_token',
      },
    });
    expect(responseBadAuth.status()).toBe(401);
  });
});
