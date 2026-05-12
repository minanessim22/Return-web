'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { extractVisualFeaturesFromDataUrl } from '@/lib/visual-ai';
import { clearPendingAiMatches, getPendingAiRequestId, savePendingAiMatches, waitForPendingAiImage } from '@/lib/client-ai-session';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDisplayUser } from '@/lib/user-display';

export default function AIAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get('rid') || '';
  const [retryCount, setRetryCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Analyzing image...');
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const hasStarted = useRef<string | null>(null);

  const { user: authUser } = useAuth();
  const user = getDisplayUser(authUser);

  useEffect(() => {
    const effectiveRequestId = requestId || getPendingAiRequestId() || '';
    const runKey = `${effectiveRequestId || 'latest'}:${retryCount}`;
    if (hasStarted.current === runKey) {
      return;
    }
    hasStarted.current = runKey;

    setError('');
    setProgress(0);

    let cancelled = false;
    const progressTimer = window.setInterval(() => {
      setProgress((prev) => (prev < 88 ? prev + 2 : prev));
    }, 120);

    const run = async () => {
      try {
        clearPendingAiMatches();
        setStatusText('Preparing image...');
        setProgress(6);
        const savedImage = await waitForPendingAiImage(effectiveRequestId || undefined, retryCount > 0 ? 9000 : 7000);
        if (!savedImage) {
          throw new Error('No image was found for analysis. Please upload a photo first.');
        }
        if (cancelled) return;

        setPreviewImage(savedImage);
        setStatusText('Extracting visual fingerprint...');
        const aiAnalysis = await extractVisualFeaturesFromDataUrl(savedImage);
        if (cancelled) return;

        setProgress((prev) => Math.max(prev, 42));
        setStatusText('Searching the database...');
        const response = await api.previewAiMatch({
          caseType: 'FOUND',
          type: 'Child',
          name: 'Unknown Child',
          photo: savedImage,
          aiAnalysis
        });
        if (cancelled) return;

        const reviewableMatches = (response.matches || []).filter((item) => item.decision === 'Accepted Match' || item.decision === 'Manual Review');

        savePendingAiMatches(reviewableMatches, {
          usedAiPhotoPriority: response.usedAiPhotoPriority,
          aiAnalysis
        }, effectiveRequestId || undefined);

        setStatusText('Finalizing results...');
        setProgress(100);
        window.setTimeout(() => {
          router.replace(`/found-dashboard/ai-match-found?match=${reviewableMatches.length > 0}&rid=${encodeURIComponent(effectiveRequestId || 'latest')}`);
        }, 350);
      } catch (analysisError) {
        if (cancelled) return;
        clearPendingAiMatches();
        setError(analysisError instanceof Error ? analysisError.message : 'Unable to analyze this image right now.');
        setStatusText('Analysis stopped');
      } finally {
        window.clearInterval(progressTimer);
      }
    };

    void run();

    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
    };
  }, [requestId, retryCount, router]);

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen flex flex-col font-sans select-none overflow-hidden bg-gradient-to-r from-[#53a63e] via-[#2467b1] to-[#0459a7]">
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 relative">
        <div className="absolute top-12 left-10 hidden md:block">
          <h1 className="text-white text-3xl font-black uppercase tracking-widest drop-shadow-md">AI Recognition</h1>
        </div>

        {previewImage ? (
          <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-2 shadow-2xl backdrop-blur">
            <img src={previewImage} alt="AI analysis preview" className="h-32 w-32 object-cover sm:h-40 sm:w-40 rounded-[1.5rem]" loading="lazy" decoding="async" />
          </div>
        ) : null}

        <div className="relative flex items-center justify-center mb-10">
          <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
            <circle cx="50%" cy="50%" r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth="18" fill="transparent" />
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              stroke="#84cc16"
              strokeWidth="18"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.2s linear' }}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-white text-5xl font-black">{progress}%</span>
          </div>
        </div>

        <div className="text-center max-w-2xl">
          <h2 className="text-white text-3xl md:text-5xl font-black leading-tight drop-shadow-lg transition-all duration-500">
            {statusText}
          </h2>
          <p className="mt-5 text-lg text-white/80 font-bold">
            Real AI image-first matching is running now against the saved reports.
          </p>
          {error ? (
            <div className="mt-6 rounded-3xl bg-red-50 px-5 py-4 text-red-700 font-bold">
              {error}
            </div>
          ) : (
            <div className="flex justify-center gap-2 mt-6">
              <div className="w-3 h-3 bg-[#84cc16] rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-[#84cc16] rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-3 h-3 bg-[#84cc16] rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setRetryCount((value) => value + 1)}
              className="rounded-full border border-white/35 bg-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/25"
            >
              Start Analysis
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/65">
              If the analysis looks stuck after taking or uploading the photo, tap Start Analysis here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}