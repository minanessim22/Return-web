"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { api } from '@/lib/api';

type StoredScannedProfile = {
  id: string;
  type: string;
  name: string;
  lastLocation: string;
  dateTime: string;
  emergencyContact: string;
  description: string;
  notes: string;
  coordinates: { lat: number; lng: number };
  photo?: string;
  rawValue?: string;
  scannedAt?: string;
};

function normalizeBackendProfile(item: any, rawValue: string, imageOverride?: string): StoredScannedProfile {
  const firstContact = Array.isArray(item?.emergencyContacts) ? item.emergencyContacts[0] : undefined;
  const ageLabel = item?.age ? `${item.age} years old` : '';
  const descriptionParts = [ageLabel, item?.medicalNotes, item?.clothesColor].filter(Boolean);

  return {
    id: String(item?.id || ''),
    type: String(item?.category || item?.type || 'Identification Profile'),
    name: String(item?.displayName || item?.name || 'Unknown profile'),
    lastLocation: String(item?.lastLocationText || item?.locationText || 'Unknown location'),
    dateTime: String(item?.updatedAt || item?.createdAt || new Date().toISOString()),
    emergencyContact: String(firstContact?.phone || item?.emergencyContact || ''),
    description: descriptionParts.join(' • ') || 'Identification profile retrieved successfully.',
    notes: String(item?.notes || item?.medicalNotes || ''),
    coordinates: {
      lat: Number(item?.latitude ?? 30.0444),
      lng: Number(item?.longitude ?? 31.2357)
    },
    photo: String(item?.photoUrl || imageOverride || ''),
    rawValue,
    scannedAt: new Date().toISOString()
  };
}

function normalizeLegacyPayload(value: any, imageOverride?: string): StoredScannedProfile {
  const getValue = (obj: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const current = obj[key];
      if (typeof current === 'string' && current.trim()) return current;
    }
    return '';
  };

  return {
    id: getValue(value, ['id']),
    type: getValue(value, ['type', 'category']) || 'Identification Profile',
    name: getValue(value, ['name', 'displayName']) || 'Unknown profile',
    lastLocation: getValue(value, ['location', 'lastLocation', 'locationText']) || 'Unknown location',
    dateTime: getValue(value, ['dateTime', 'updatedAt', 'createdAt']) || new Date().toISOString(),
    emergencyContact: getValue(value, ['emergencyContact', 'phone', 'contactPhone']),
    description: getValue(value, ['description', 'medicalNotes', 'age']) || 'Scanned QR content loaded.',
    notes: getValue(value, ['notes']),
    coordinates: {
      lat: Number((value as any)?.coordinates?.lat ?? (value as any)?.latitude ?? 30.0444),
      lng: Number((value as any)?.coordinates?.lng ?? (value as any)?.longitude ?? 31.2357)
    },
    photo: getValue(value, ['photo', 'image', 'avatar', 'imageUrl', 'photoUrl']) || imageOverride || '',
    rawValue: getValue(value, ['rawValue', 'token']),
    scannedAt: new Date().toISOString()
  };
}

function persistScannedProfile(payload: StoredScannedProfile, imageOverride?: string) {
  localStorage.setItem('scannedQRData', JSON.stringify(payload));
  localStorage.setItem('scannedQRImage', payload.photo || imageOverride || '');
}

function getCameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) return 'Could not access camera. Please check permissions.';
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Camera is already in use by another app or tab. Close it, then try again.';
  }
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Please allow access and try again.';
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  return 'Could not access camera. Please check permissions.';
}

/**
 * صفحة مسح رمز QR مع ميزة الكاميرا الحية (Live Stream) واختيار الملفات
 */
export default function ScanQRPage() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearScanInterval = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    clearScanInterval();
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
  }, [clearScanInterval]);

  const routeToProfile = () => {
    setTimeout(() => {
      setIsScanning(false);
      router.push('/found-dashboard/id-profile');
    }, 1200);
  };

  const handleQRCodeDetected = async (qrData: string) => {
    stopCamera();
    setIsScanning(true);
    setScanMessage('جارٍ التحقق من بيانات الرمز...');

    try {
      let payload: StoredScannedProfile | null = null;

      try {
        const response = await api.scanQr({ rawValue: qrData });
        payload = normalizeBackendProfile(response.item, qrData, selectedImage || undefined);
      } catch (backendError) {
        console.warn('Backend QR lookup failed, falling back to local parsing.', backendError);
        try {
          const parsedData = JSON.parse(qrData);
          payload = normalizeLegacyPayload(parsedData, selectedImage || undefined);
        } catch {
          payload = {
            id: '',
            type: 'Scanned QR',
            name: 'Unrecognized profile',
            lastLocation: 'No location embedded in QR',
            dateTime: new Date().toISOString(),
            emergencyContact: '',
            description: 'The QR was scanned, but it is not linked to a stored identification profile yet.',
            notes: qrData,
            coordinates: { lat: 30.0444, lng: 31.2357 },
            photo: selectedImage || '',
            rawValue: qrData,
            scannedAt: new Date().toISOString()
          };
        }
      }

      persistScannedProfile(payload, selectedImage || undefined);
      setScanMessage('✅ تم العثور على الملف التعريفي');
      routeToProfile();
    } catch (error) {
      console.error('QR handling failed', error);
      setIsScanning(false);
      setScanMessage('حدث خطأ أثناء قراءة الرمز');
      alert(error instanceof Error ? error.message : 'Unable to process this QR code.');
    }
  };

  const startQRScanning = useCallback(() => {
    clearScanInterval();

    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video.videoWidth || !video.videoHeight) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            setScanMessage('✅ تم العثور على QR Code!');
            clearScanInterval();
            void handleQRCodeDetected(code.data);
          }
        }
      }
    }, 120);
  }, [clearScanInterval]);

  const startCamera = async () => {
    setShowOptions(false);
    setCameraError('');
    setScanMessage('جاري فتح الكاميرا...');
    setSelectedImage(null);
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
      setScanMessage('وجّه الكاميرا نحو رمز QR');
    } catch (err) {
      console.error('Error accessing camera: ', err);
      setCameraError(getCameraErrorMessage(err));
      setScanMessage('لم يتمكن الوصول للكاميرا');
      stopCamera();
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video.videoWidth || !video.videoHeight) {
        setCameraError('انتظر لحظة حتى تظهر معاينة الكاميرا بالكامل.');
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setSelectedImage(dataUrl);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setSelectedImage(dataUrl);
        try {
          localStorage.setItem('scannedQRImage', dataUrl);
        } catch {
          // ignore storage issues
        }
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) {
                void handleQRCodeDetected(code.data);
              } else {
                setScanMessage('❌ لم يتم العثور على QR code في الصورة');
                alert('No QR code found in the image');
              }
            }
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
    setShowOptions(false);
  };

  useEffect(() => {
    if (!isCameraActive || !stream || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = stream;
    const beginScanning = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          console.error('QR preview play error:', err);
          setCameraError('تعذر بدء معاينة الكاميرا. حاول مرة أخرى.');
        });
      }
      startQRScanning();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      beginScanning();
      return;
    }

    video.onloadedmetadata = () => {
      beginScanning();
    };

    return () => {
      video.onloadedmetadata = null;
    };
  }, [isCameraActive, startQRScanning, stream]);

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
    <div className="w-full min-h-screen bg-white mx-auto overflow-hidden flex flex-col font-sans relative">
      <main className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-r from-[#53a63e] via-[#2467b1] to-[#0459a7] p-4">
        <div className="flex flex-col items-center text-center text-white space-y-2 mb-10">
          <h2 className="text-4xl font-black">Scan QR Code</h2>
          <p className="text-lg opacity-80">Scan QR Code to access details securely.</p>
        </div>

        <div
          className="relative w-[320px] h-[320px] md:w-[450px] md:h-[450px] border-4 border-dashed border-white/50 rounded-[40px] flex items-center justify-center cursor-pointer bg-white/5 backdrop-blur-sm overflow-hidden"
          onClick={() => !isScanning && setShowOptions(true)}
        >
          {selectedImage ? (
            <img src={selectedImage} alt="QR Result" className="w-full h-full object-cover p-4 rounded-[40px]" />
          ) : (
            <div className="flex flex-col items-center gap-4 text-white/60">
              <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="font-black text-xl">Tap to Scan</span>
            </div>
          )}
          {isScanning && (
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute w-full h-[6px] bg-[#84cc16] shadow-[0_0_25px_#84cc16] animate-scanning-line"></div>
              <div className="absolute inset-0 bg-[#84cc16]/5 animate-pulse"></div>
            </div>
          )}
        </div>

        {scanMessage && (
          <div className="mt-6 text-white text-xl font-bold bg-white/10 px-6 py-3 rounded-full backdrop-blur-md animate-pulse text-center">
            {scanMessage}
          </div>
        )}

        {cameraError ? (
          <div className="mt-4 max-w-xl rounded-2xl bg-red-500/15 border border-red-200 px-5 py-3 text-center text-white font-bold">
            {cameraError}
          </div>
        ) : null}

        {showOptions && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
            <div className="bg-white rounded-[40px] p-10 w-full max-w-[450px] shadow-2xl flex flex-col gap-6 animate-slide-in">
              <h3 className="text-center font-black text-3xl text-[#1e40af] mb-4">Choose Method</h3>
              <button
                onClick={startCamera}
                className="bg-[#84cc16] text-white p-6 rounded-3xl font-black text-2xl hover:brightness-110 active:scale-95 transition-all shadow-lg"
              >
                📷 Open Live Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#1e40af] text-white p-6 rounded-3xl font-black text-2xl hover:brightness-110 active:scale-95 transition-all shadow-lg"
              >
                📁 Upload from Files
              </button>
              <button onClick={() => setShowOptions(false)} className="text-gray-500 font-black text-lg">Cancel</button>
            </div>
          </div>
        )}

        {isCameraActive && (
          <div className="absolute inset-0 bg-black z-[200] flex flex-col">
            <div className="flex-1 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-[16px] border-black/40 pointer-events-none" />
              <div className="absolute inset-x-[12%] top-[18%] bottom-[18%] border-4 border-dashed border-white/70 rounded-[36px] pointer-events-none" />
            </div>
            <div className="p-6 bg-black/80 flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={takePhoto}
                className="bg-white text-black px-6 py-3 rounded-full font-black shadow-lg hover:scale-105 transition-all"
              >
                Capture Preview
              </button>
              <button
                onClick={stopCamera}
                className="bg-red-500 text-white px-6 py-3 rounded-full font-black shadow-lg hover:scale-105 transition-all"
              >
                Close Camera
              </button>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <canvas ref={canvasRef} className="hidden" />
      </main>

      <style jsx>{`
        @keyframes scanning-line {
          0% { transform: translateY(0); }
          100% { transform: translateY(310px); }
        }
        .animate-scanning-line {
          animation: scanning-line 1.5s linear infinite alternate;
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
