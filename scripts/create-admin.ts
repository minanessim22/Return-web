import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
    const salt = randomBytes(16).toString('hex');
    const passwordHash = `scrypt:${salt}:${scryptSync('Admin@123', salt, 64).toString('hex')}`;

    const admin = await prisma.user.upsert({
        where: {
            email: 'admin@return.com',
        },

        update: {},

        create: {
            name: 'System Admin',

            username: 'admin',

            email: 'admin@return.com',

            passwordHash,

            role: 'ADMIN',

            status: 'ACTIVE',
        },
    });

    console.log('Admin created successfully');
    console.log(admin);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });