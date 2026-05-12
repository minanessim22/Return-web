import type { PublicUser } from '@/lib/shared-types';

export function getDisplayUser(user?: Pick<PublicUser, 'name' | 'username' | 'email' | 'avatarUrl'> | null) {
  const fallbackSeed = String(user?.name || user?.username || user?.email?.split('@')[0] || 'return-user').trim() || 'return-user';
  return {
    name: user?.name?.trim() || user?.username?.trim() || user?.email?.split('@')[0] || 'Account',
    avatar: user?.avatarUrl?.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fallbackSeed)}`
  };
}
