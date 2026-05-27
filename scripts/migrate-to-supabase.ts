import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/server/db';

async function migrate() {
  console.log('Starting migration to Supabase...');
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'store.json');
  
  if (!existsSync(jsonPath)) {
    console.log('No local store.json found. Nothing to migrate.');
    return;
  }

  try {
    const rawData = readFileSync(jsonPath, 'utf-8');
    // Basic validation
    JSON.parse(rawData);

    await prisma.keyValueStore.upsert({
      where: { key: 'MAIN_APP_STORE_V1' },
      update: { value: rawData },
      create: { key: 'MAIN_APP_STORE_V1', value: rawData }
    });
    
    console.log('Migration successful! Your data is now in Supabase.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
