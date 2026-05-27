import { NextResponse } from 'next/server';

// التعامل مع طلبات الـ GET الاعتيادية
export async function GET() {
    return new NextResponse('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
    });
}

// التعامل مع طلبات الـ HEAD (وهي نفس الـ GET ولكن بدون إرجاع الـ Body لتوفير البيانات)
export async function HEAD() {
    return new NextResponse(null, {
        status: 200
    });
}