import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/server/db';

async function migrate() {
  console.log('Starting migration to Supabase...');

  const jsonPath = path.join(
    process.cwd(),
    'src',
    'data',
    'store.json'
  );

  if (!existsSync(jsonPath)) {
    console.log('No local store.json found.');
    return;
  }

  try {
    const rawData = readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(rawData);

    // حفظ النسخة الاحتياطية
    await prisma.keyValueStore.upsert({
      where: { key: 'MAIN_APP_STORE_V1' },
      update: { value: rawData },
      create: { key: 'MAIN_APP_STORE_V1', value: rawData },
    });

    console.log('Legacy store migrated.');

    // نقل المستخدمين
    const users = parsed.users || [];
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      try {
        await prisma.user.upsert({
          where: { username: user.username },
          update: {},
          create: {
            username: user.username,
            name: user.name || user.username || 'Legacy User',
            email: user.email || `${user.username}@return.local`,
            passwordHash:
              user.passwordHash ||
              user.password ||
              'temporary_hash',
            role: (user.role || 'USER').toUpperCase() as any,
            status: (user.status || 'ACTIVE').toUpperCase() as any,
            emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt) : null,
          },
        });

        console.log(`Migrated user: ${user.username}`);
      } catch (err) {
        console.error(`Failed: ${user.username}`, err);
      }
    }

    console.log('Users migration completed.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
