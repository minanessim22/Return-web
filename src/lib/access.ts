import type { PublicUser } from '@/lib/shared-types';

export function isAdminUser(user?: Pick<PublicUser, 'role'> | null) {
  return user?.role === 'ADMIN';
}
