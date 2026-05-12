import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function disabledResponse() {
  return NextResponse.json(
    { error: 'Google authentication is disabled in this final version. Please use email and password.' },
    { status: 410 }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
