import { hashValue, generateNumericCode } from '@/lib/server/security';
import { prisma } from '@/lib/server/db';

export async function createVerificationRequest(input: {
  purpose: string;
  email: string;
  userId?: string;
  payload?: any;
  expiresInMinutes?: number;
}) {
  const code = generateNumericCode(6);
  const codeHash = hashValue(code);
  const email = input.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + (input.expiresInMinutes || 10) * 60 * 1000);

  // Consume any prior unconsumed verification requests for this purpose and email
  try {
    await prisma.verificationRequest.updateMany({
      where: {
        purpose: input.purpose,
        email,
        consumedAt: null
      },
      data: {
        consumedAt: new Date()
      }
    });

    const request = await prisma.verificationRequest.create({
      data: {
        purpose: input.purpose,
        email,
        userId: input.userId,
        codeHash,
        attemptsLeft: 5,
        expiresAt,
        payload: input.payload ? (input.payload as any) : undefined
      }
    });

    return { request, code };
  } catch (err) {
    console.error('[Verification] Failed to create verification request in database:', err);
    throw err;
  }
}

export async function verifyOneTimeCode(input: {
  purpose: string;
  email: string;
  code: string;
}) {
  const email = input.email.trim().toLowerCase();
  
  try {
    const entry = await prisma.verificationRequest.findFirst({
      where: {
        purpose: input.purpose,
        email,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!entry) {
      return { ok: false as const, reason: 'No active verification request was found.' };
    }
    if (entry.expiresAt <= new Date()) {
      return { ok: false as const, reason: 'This code has expired. Please request a new one.' };
    }
    if (entry.attemptsLeft <= 0) {
      return { ok: false as const, reason: 'Too many invalid attempts. Please request a new code.' };
    }

    const inputCodeHash = hashValue(input.code);
    if (inputCodeHash !== entry.codeHash) {
      const updated = await prisma.verificationRequest.update({
        where: { id: entry.id },
        data: { attemptsLeft: { decrement: 1 } }
      });
      return { ok: false as const, reason: 'The verification code is incorrect.', attemptsLeft: updated.attemptsLeft };
    }

    const updated = await prisma.verificationRequest.update({
      where: { id: entry.id },
      data: { consumedAt: new Date() }
    });

    return { ok: true as const, entry: updated };
  } catch (err) {
    console.error('[Verification] Failed to verify code:', err);
    return { ok: false as const, reason: 'Database error occurred during verification.' };
  }
}
