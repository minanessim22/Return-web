import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTBOX_PATH = path.join(process.cwd(), 'src', 'data', 'outbox.json');

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function appendOutboxEntry(input: SendMailInput & { providerError?: string }) {
  await mkdir(path.dirname(OUTBOX_PATH), { recursive: true });
  let payload: any[] = [];
  try {
    payload = JSON.parse(await readFile(OUTBOX_PATH, 'utf-8')) as any[];
    if (!Array.isArray(payload)) payload = [];
  } catch {
    payload = [];
  }
  payload.unshift({
    id: `mail_${Date.now()}`,
    ...input,
    createdAt: new Date().toISOString()
  });
  await writeFile(OUTBOX_PATH, JSON.stringify(payload.slice(0, 100), null, 2), 'utf-8');
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unknown email provider error.';
}

async function sendWithResend(input: SendMailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!resendApiKey || !from) return null;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unable to read email provider response.');
    throw new Error(`Email delivery failed: ${details}`);
  }

  return { delivery: 'email' as const };
}

async function sendWithSmtp(input: SendMailInput) {
  const smtpUser = process.env.EMAIL_SMTP_USER;
  const smtpPass = process.env.EMAIL_SMTP_PASS;
  const from = process.env.EMAIL_FROM || smtpUser;
  if (!smtpUser || !smtpPass || !from) return null;

  const nodemailer = await import('nodemailer');
  const host = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const secure = String(process.env.EMAIL_SMTP_SECURE || 'true').toLowerCase() !== 'false';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html
  });

  return { delivery: 'email' as const };
}

export async function sendMail(input: SendMailInput) {
  try {
    const resendResult = await sendWithResend(input);
    if (resendResult) return resendResult;

    const smtpResult = await sendWithSmtp(input);
    if (smtpResult) return smtpResult;
  } catch (error) {
    const providerError = toErrorMessage(error);
    await appendOutboxEntry({ ...input, providerError });
    return { delivery: 'outbox' as const, providerError };
  }

  await appendOutboxEntry(input);
  return { delivery: 'outbox' as const };
}

export function buildVerificationEmail(code: string, userName: string) {
  const subject = 'RETURN verification code';
  const text = `Hello ${userName}, your RETURN verification code is ${code}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">RETURN account verification</h2>
      <p>Hello ${userName},</p>
      <p>Use the following code to verify your account:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;display:inline-block">${code}</div>
      <p style="margin-top:16px">This code expires in 10 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  return { subject, text, html };
}

export function buildPasswordResetEmail(code: string, userName: string) {
  const subject = 'RETURN password reset code';
  const text = `Hello ${userName}, your RETURN password reset code is ${code}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">RETURN password reset</h2>
      <p>Hello ${userName},</p>
      <p>Use the following code to reset your password:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;padding:12px 16px;background:#ecfdf5;border:1px solid #86efac;border-radius:12px;display:inline-block">${code}</div>
      <p style="margin-top:16px">This code expires in 10 minutes.</p>
      <p>If you did not request this, please secure your email account and ignore this message.</p>
    </div>
  `;
  return { subject, text, html };
}
