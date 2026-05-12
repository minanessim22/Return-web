'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { savePendingAiImage } from '@/lib/client-ai-session';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDisplayUser } from '@/lib/user-display';

function getCameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) return 'تعذر الوصول للكاميرا.';
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'الكاميرا مستخدمة حاليًا من تطبيق أو صفحة أخرى. أغلق أي تطبيق يستخدم الكاميرا ثم حاول مرة أخرى.';
  }
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'تم رفض صلاحية الكاميرا. اسمح للموقع باستخدام الكاميرا ثم حاول مرة أخرى.';
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'لم يتم العثور على كاميرا على هذا الجهاز.';
  }
  return 'تعذر الوصول للكاميرا.';
}

export default function AIRecognitionPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const user = getDisplayUser(authUser);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const goToAnalysis = (imageData: string) => {
    const requestId = savePendingAiImage(imageData);
    setCapturedImage(imageData);
    setBusy(true);
    router.push(`/found-dashboard/ai-analysis?rid=${encodeURIComponent(requestId)}`);
  };

  const startCamera = async () => {
    setCameraError('');
    setBusy(false);
    setCapturedImage(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(getCameraErrorMessage(err));
      stopCamera();
    }
  };

  const captureAction = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('انتظر لحظة حتى تكتمل معاينة الكاميرا ثم أعد المحاولة.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    stopCamera();
    goToAnalysis(dataUrl);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const imageData = typeof reader.result === 'string' ? reader.result : '';
      if (!imageData) return;
      stopCamera();
      goToAnalysis(imageData);
    };
    reader.readAsDataURL(file);
    e.currentTarget.value = '';
  };

  useEffect(() => {
    if (!isCameraActive || !stream || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = stream;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        console.error('Video preview play error:', err);
        setCameraError('تعذر بدء معاينة الكاميرا. حاول مرة أخرى.');
      });
    }
  }, [isCameraActive, stream]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) stopCamera();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="min-h-screen flex flex-col font-sans select-none overflow-x-hidden">
      <header className="bg-white h-[80px] flex items-center px-6 md:px-10 border-b border-gray-100 shadow-sm z-50">
        <div className="w-full max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <Image src="/photos/8.png" alt="RETURN" width={110} height={36} priority />
          </div>

          <nav className="hidden lg:flex items-center space-x-10">
            <Link href="/" className="text-[#1e40af] font-bold hover:text-[#84cc16] transition-colors">Home</Link>
            <Link href="/missing" className="text-[#1e40af] font-bold hover:text-[#84cc16] transition-colors">Missing</Link>
            <Link href="/found-dashboard" className="text-[#1e40af] font-bold hover:text-[#84cc16] transition-colors">Found</Link>
            <Link href="/profile" className="text-[#1e40af] font-bold hover:text-[#84cc16] transition-colors">Profile</Link>
          </nav>

          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border shadow-sm" alt="User" />
            <span className="font-bold text-[14px] text-[#1e1e1e]">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-r from-[#53a63e] via-[#2467b1] to-[#0459a7] px-4 py-12">
        <div className="absolute top-12 left-12 hidden md:block">
          <h1 className="text-white text-4xl font-black drop-shadow-lg uppercase tracking-wider">AI Recognition</h1>
        </div>

        <div className="w-full max-w-4xl flex flex-col items-center mt-16 md:mt-8">
          <div className="relative mb-12 w-full flex justify-center">
            <div className="relative w-[320px] h-[320px] md:w-[540px] md:h-[420px] bg-white/10 rounded-[30px] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.25)] border border-white/20 flex items-center justify-center">
              {isCameraActive ? (
                <div className="relative w-full h-full">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-[2px] border-[#84cc16]/50 m-6 rounded-[30px] pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#84cc16] shadow-[0_0_15px_#84cc16] animate-scan-line"></div>
                  </div>
                </div>
              ) : (
                <img
                  src={capturedImage || '/photos/16.png'}
                  className="w-full h-full object-cover"
                  alt="Camera Preview"
                  loading="lazy"
                  decoding="async"
                />
              )}
              {busy ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#014cb3]/60 px-6 text-center text-white">
                  <div>
                    <p className="text-2xl font-black">Preparing analysis...</p>
                    <p className="mt-2 text-sm text-white/85">The image was saved and the AI screen is opening now.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {cameraError ? (
            <div className="mb-6 max-w-2xl rounded-2xl bg-red-500/15 border border-red-200 px-5 py-3 text-center text-white font-bold">
              {cameraError}
            </div>
          ) : null}

          <div className="flex flex-col md:flex-row items-center gap-6">
            {isCameraActive ? (
              <>
                <button onClick={captureAction} className="bg-white text-blue-900 px-14 py-4 rounded-2xl text-2xl font-black shadow-xl hover:scale-105 transition-transform">CAPTURE</button>
                <button onClick={stopCamera} className="bg-red-500 text-white px-10 py-4 rounded-2xl text-xl font-bold shadow-xl hover:bg-red-600 transition-colors">CANCEL</button>
              </>
            ) : (
              <>
                <button onClick={startCamera} disabled={busy} className="bg-[#60C10F] text-[#014CB3] px-14 py-5 rounded-2xl text-3xl font-black shadow-2xl hover:bg-[#53ad16] transition-all active:scale-95 min-w-[240px] disabled:opacity-60">TAKE PHOTO</button>
                <span className="text-white text-3xl font-black italic">OR</span>
                <button onClick={handleUploadClick} disabled={busy} className="bg-[#60C10F] text-[#014CB3] px-14 py-5 rounded-2xl text-3xl font-black shadow-2xl hover:bg-[#53ad16] transition-all active:scale-95 min-w-[240px] disabled:opacity-60">UPLOAD PHOTO</button>
              </>
            )}
          </div>

          <p className="mt-12 text-white text-xl md:text-2xl font-bold text-center drop-shadow-md">
            Ensure the <span className="text-[#84cc16]">photo</span> is clear and fully<br /> visible for better recognition
          </p>
        </div>

        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={onFileSelected} />
        <canvas ref={canvasRef} className="hidden" />
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          position: absolute;
          animation: scan 3s ease-in-out infinite;
        }
      ` }} />
      <footer className="h-2 bg-[#0459a7]"></footer>
    </div>
  );
}
