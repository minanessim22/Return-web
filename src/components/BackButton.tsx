'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBackButtonContext } from '@/components/BackButtonProvider';

const HIDE_PATHS = new Set([
  '/',
  '/sign-in',
  '/login',
  '/role-selection',
  '/guest-homepage',
  '/splash-1',
  '/splash-2',
  '/splash-3',
  '/splash-4',
  '/splash-5',
  '/splash-6',
  '/splash-7'
]);

const CUSTOM_BACK_PATH_PREFIXES = ['/admin', '/found-dashboard/id-profile'];

function resolveFallback(pathname: string | null) {
  if (!pathname) return '/';
  if (pathname.startsWith('/admin/db')) return '/admin';
  if (pathname.startsWith('/admin')) return '/selection';
  if (pathname.startsWith('/lost-dashboard') || pathname.startsWith('/found-dashboard')) return '/selection';
  if (pathname.startsWith('/qr') || pathname.startsWith('/nfc') || pathname.startsWith('/gps') || pathname.startsWith('/devices')) {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('return-last-dashboard');
      if (stored) return stored;
    }
    return '/selection';
  }
  if (pathname.startsWith('/case-details') || pathname.startsWith('/identify')) return '/selection';
  if (pathname.startsWith('/selection')) return '/';
  return '/selection';
}

function hasInlineBackButton(pathname: string) {
  return CUSTOM_BACK_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const ctx = useBackButtonContext();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;
    if (pathname.startsWith('/lost-dashboard') || pathname.startsWith('/found-dashboard')) {
      window.localStorage.setItem('return-last-dashboard', pathname);
    }
  }, [pathname]);

  const fallback = useMemo(() => resolveFallback(pathname), [pathname]);

  if (ctx?.hidden) return null;
  if (!hydrated) return null;
  if (!pathname) return null;
  if (HIDE_PATHS.has(pathname)) return null;
  if (hasInlineBackButton(pathname)) return null;

  const handleBack = () => {
    const hasHistory = typeof window !== 'undefined' && window.history.length > 1;
    const hasReferrer = typeof document !== 'undefined' && Boolean(document.referrer);
    if (hasHistory && hasReferrer) {
      router.back();
      return;
    }
    router.push(fallback);
  };

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={handleBack}
      className={`${className ?? ''} inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-4 py-2.5 text-sm font-black text-[#014CB3] shadow-[0_12px_30px_rgba(1,76,179,0.22)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white`}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#014CB3] to-[#60C10F] text-white shadow-md">
        <ArrowLeft className="h-4 w-4" />
      </span>
      Back
    </button>
  );
}
