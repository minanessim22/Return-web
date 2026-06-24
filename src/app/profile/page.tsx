'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const lastDashboard = typeof window !== 'undefined' ? localStorage.getItem('return:lastDashboard') : null;
    const base = lastDashboard === 'found' ? '/found-dashboard' : '/lost-dashboard';
    router.replace(`${base}?tab=profile`);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#014CB3] to-[#60C10F] px-4 py-8 text-center text-white sm:px-6">
      <div>
        <h1 className="mb-3 text-2xl font-black sm:text-3xl">Opening profile</h1>
        <p className="text-sm text-white/80 sm:text-base">Redirecting to your profile settings…</p>
      </div>
    </div>
  );
}
