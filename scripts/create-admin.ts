import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL || 'admin@return.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';

    const salt = randomBytes(16).toString('hex');
    const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;

    const admin = await prisma.user.upsert({
        where: {
            email,
        },
        update: {
            // Keep the admin password updated if changed in the env configurations
            passwordHash,
        },
        create: {
            name: 'System Admin',
            username: 'admin',
            email,
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
        },
    });

    console.log('Admin system account seeded successfully');
    console.log({ id: admin.id, email: admin.email, username: admin.username, role: admin.role });
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });