import { test, expect } from '@playwright/test';

test.describe('Health API Endpoint', () => {
  test('returns 200 and indicates database connectivity', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('database', 'connected');
    expect(body).toHaveProperty('timestamp');
  });
});
