import { apiError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST() {
  return apiError(410, 'Direct sign-up is disabled. Request an email verification code first.');
}
