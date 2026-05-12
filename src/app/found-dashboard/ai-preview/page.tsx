'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { clearPendingAiImage, getPendingAiImage } from '@/lib/client-ai-session';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDisplayUser } from '@/lib/user-display';

export default function AIPreviewPage() {
  const router = useRouter();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoRouting, setAutoRouting] = useState(false);

  const { user: authUser } = useAuth();
  const user = getDisplayUser(authUser);

  useEffect(() => {
    const savedImage = getPendingAiImage();
    if (savedImage) {
      setCapturedImage(savedImage);
      setAutoRouting(true);
      const timer = window.setTimeout(() => {
        router.replace('/found-dashboard/ai-analysis');
      }, 250);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [router]);

  const handleAnalyze = () => {
    if (!capturedImage) return;
    router.push('/found-dashboard/ai-analysis');
  };

  const handleRetake = () => {
    clearPendingAiImage();
    window.history.back();
  };

  return (
    <div className="min-h-screen flex flex-col font-sans select-none overflow-x-hidden bg-gradient-to-r from-[#53a63e] via-[#2467b1] to-[#0459a7]">
      <header className="bg-white h-[80px] flex items-center px-6 md:px-10 border-b border-gray-100 shadow-sm z-50">
        <div className="w-full max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <Logo width={40} height={12} className="h-10 md:h-12" />
          </div>
          <nav className="hidden lg:flex items-center space-x-10">
            <Link href="/" className="text-[#84cc16] font-bold border-b-2 border-[#84cc16] pb-1">Home</Link>
            <Link href="/missing" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Missing</Link>
            <Link href="/found-dashboard" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Found</Link>
            <Link href="/devices" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Devices</Link>
            <Link href="/profile" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Profile</Link>
          </nav>
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border shadow-sm" alt="User" />
            <span className="font-bold text-[14px] text-[#1e1e1e]">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center px-4 py-8">
        <div className="absolute top-8 left-8">
          <h1 className="text-white text-3xl md:text-4xl font-black drop-shadow-lg uppercase tracking-wider">AI Recognition</h1>
        </div>

        <div className="w-full max-w-5xl flex flex-col items-center">
          <div className="relative mb-12 w-full flex justify-center">
            <div className="bg-white w-[340px] h-[260px] md:w-[650px] md:h-[450px] rounded-2xl shadow-2xl flex flex-col items-center justify-center p-4 border-[12px] border-white/20 overflow-hidden">
              {capturedImage ? (
                <img src={capturedImage} className="max-w-full max-h-full object-contain rounded-lg shadow-inner" alt="User Upload" />
              ) : (
                <div className="flex flex-col items-center opacity-80">
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mb-2">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                    <path d="M16 12l2 2" />
                    <path d="M18 8h4M20 6v4" />
                  </svg>
                  <span className="text-gray-800 text-6xl font-medium tracking-tighter">photo</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 w-full justify-center">
            <button
              onClick={handleAnalyze}
              className="bg-[#52ad2d] text-white px-16 py-4 rounded-2xl text-2xl font-black shadow-[0_8px_0_rgb(34,74,21)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(34,74,21)] transition-all active:scale-95 min-w-[260px]"
            >
              {autoRouting ? 'Opening analysis...' : 'Analyze'}
            </button>

            <button
              onClick={handleRetake}
              className="bg-[#e11d48] text-white px-16 py-4 rounded-2xl text-2xl font-black shadow-[0_8px_0_rgb(159,18,57)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(159,18,57)] transition-all active:scale-95 min-w-[260px] uppercase"
            >
              Retake Photo
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}