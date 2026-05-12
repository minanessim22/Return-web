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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#014CB3] to-[#60C10F] text-white text-center px-6">
      <div>
        <h1 className="text-3xl font-black mb-3">Opening profile</h1>
        <p className="text-white/80">Redirecting to your profile settings…</p>
      </div>
    </div>
  );
}
