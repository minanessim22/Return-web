import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function bufferEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function hashLegacyPassword(password: string) {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  if (!passwordHash) return false;
  if (passwordHash.startsWith('scrypt:')) {
    const [, salt, derived] = passwordHash.split(':');
    const computed = scryptSync(password, salt, 64).toString('hex');
    return bufferEquals(computed, derived);
  }
  if (passwordHash.startsWith('sha256:')) {
    return bufferEquals(hashLegacyPassword(password), passwordHash);
  }
  return false;
}

export function passwordNeedsMigration(passwordHash: string) {
  return passwordHash.startsWith('sha256:');
}

import { User } from '@prisma/client';

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
}
