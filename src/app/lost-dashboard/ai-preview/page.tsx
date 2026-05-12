'use client';

import React, { useEffect, useState } from 'react';
import CenteredLogo from '@/components/CenteredLogo';
import { clearPendingAiImage, getPendingAiImage } from '@/lib/client-ai-session';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDisplayUser } from '@/lib/user-display';

export default function AIPreviewPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const { user: authUser } = useAuth();
  const user = getDisplayUser(authUser);

  useEffect(() => {
    const savedImage = getPendingAiImage();
    if (savedImage) {
      setCapturedImage(savedImage);
    }
  }, []);

  const handleAnalyze = () => {
    if (!capturedImage) return;
    console.log('بدء عملية تحليل الصورة...');
  };

  const handleRetake = () => {
    clearPendingAiImage();
    window.history.back();
  };

  return (
    <div className="min-h-screen flex flex-col font-sans select-none overflow-x-hidden bg-gradient-to-r from-[#53a63e] via-[#2467b1] to-[#0459a7]">
      <div className="relative">
        <div className="w-full">
          <CenteredLogo />
        </div>
      </div>
      <header className="bg-white h-[80px] flex items-center px-6 md:px-10 border-b border-gray-100 shadow-sm z-50">
        <div className="w-full max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center"></div>
          <nav className="hidden lg:flex items-center space-x-10">
            <a href="/" className="text-[#84cc16] font-bold border-b-2 border-[#84cc16] pb-1">Home</a>
            <a href="/missing" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Missing</a>
            <a href="/found-dashboard" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Found</a>
            <a href="/devices" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Devices</a>
            <a href="/profile" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Profile</a>
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
                <div className="flex items-center justify-center w-full h-full">
                  <img src="/photos/Nfc%20image.png" alt="NFC placeholder" className="max-w-full max-h-full object-contain rounded-lg shadow-inner" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 w-full justify-center">
            <button
              onClick={handleAnalyze}
              className="bg-[#52ad2d] text-white px-16 py-4 rounded-2xl text-2xl font-black shadow-[0_8px_0_rgb(34,74,21)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(34,74,21)] transition-all active:scale-95 min-w-[260px] uppercase"
            >
              Analyze
            </button>

            <button
              onClick={handleRetake}
              className="bg-[#e11d48] text-white px-16 py-4 rounded-2xl text-2xl font-black shadow-[0_8px_0_rgb(159,18,57)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(159,18,57)] transition-all active:scale-95 min-w-[260px] uppercase"
            >
              Retake Photo
            </button>
          </div>

          <p className="mt-12 text-white text-lg md:text-xl font-bold text-center drop-shadow-md max-w-lg leading-relaxed">
            Ensure the <span className="text-[#84cc16]">photo</span> is clear and fully visible for better recognition
          </p>
        </div>
      </main>
    </div>
  );
}
