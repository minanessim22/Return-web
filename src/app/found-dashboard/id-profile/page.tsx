"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  User,
  MapPin,
  MessageCircle,
  Phone,
  Navigation,
  ArrowLeft
} from 'lucide-react';
import { api } from '@/lib/api';

const MapClient = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">Loading Map...</div>
});

type ProfileState = {
  id: string;
  type: string;
  name: string;
  lastLocation: string;
  dateTime: string;
  emergencyContact: string;
  description: string;
  notes: string;
  coordinates: { lat: number; lng: number };
  rawValue?: string;
};

const emptyProfile: ProfileState = {
  id: '',
  type: '',
  name: '',
  lastLocation: '',
  dateTime: '',
  emergencyContact: '',
  description: '',
  notes: '',
  coordinates: { lat: 30.0444, lng: 31.2357 }
};

function normalizeProfileFromBackend(item: any, rawValue?: string): ProfileState {
  const firstContact = Array.isArray(item?.emergencyContacts) ? item.emergencyContacts[0] : undefined;
  const descriptionParts = [
    item?.age ? `${item.age} years old` : '',
    item?.medicalNotes || '',
    item?.clothesColor || ''
  ].filter(Boolean);

  return {
    id: String(item?.id || ''),
    type: String(item?.category || item?.type || 'Identification Profile'),
    name: String(item?.displayName || item?.name || 'Unknown profile'),
    lastLocation: String(item?.lastLocationText || 'Unknown location'),
    dateTime: String(item?.updatedAt || item?.createdAt || ''),
    emergencyContact: String(firstContact?.phone || item?.emergencyContact || ''),
    description: descriptionParts.join(' • ') || 'Profile information is available.',
    notes: String(item?.notes || item?.medicalNotes || ''),
    coordinates: {
      lat: Number(item?.latitude ?? 30.0444),
      lng: Number(item?.longitude ?? 31.2357)
    },
    rawValue
  };
}

export default function IDProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileState>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const savedQRData = localStorage.getItem('scannedQRData');
        const tempImage = localStorage.getItem('scannedQRImage');

        if (!savedQRData) {
          if (!cancelled) {
            setProfileData(emptyProfile);
            setScannedImage(tempImage || null);
            setError('No scanned QR profile was found yet.');
          }
          return;
        }

        const parsed = JSON.parse(savedQRData);
        if (!cancelled) {
          setScannedImage(parsed.photo || tempImage || null);
          setProfileData({
            id: String(parsed.id || ''),
            type: String(parsed.type || ''),
            name: String(parsed.name || ''),
            lastLocation: String(parsed.lastLocation || parsed.location || ''),
            dateTime: String(parsed.dateTime || parsed.updatedAt || parsed.createdAt || ''),
            emergencyContact: String(parsed.emergencyContact || ''),
            description: String(parsed.description || ''),
            notes: String(parsed.notes || ''),
            coordinates: {
              lat: Number(parsed.coordinates?.lat ?? 30.0444),
              lng: Number(parsed.coordinates?.lng ?? 31.2357)
            },
            rawValue: typeof parsed.rawValue === 'string' ? parsed.rawValue : undefined
          });
        }

        const needsRefresh = !parsed.name || !parsed.emergencyContact;
        if (needsRefresh && typeof parsed.rawValue === 'string' && parsed.rawValue.trim()) {
          const response = await api.scanQr({ rawValue: parsed.rawValue });
          const normalized = normalizeProfileFromBackend(response.item, parsed.rawValue);
          const updated = {
            ...normalized,
            photo: response.item?.photoUrl || tempImage || ''
          };
          localStorage.setItem('scannedQRData', JSON.stringify(updated));
          localStorage.setItem('scannedQRImage', updated.photo || tempImage || '');
          if (!cancelled) {
            setScannedImage(updated.photo || tempImage || null);
            setProfileData(normalized);
          }
        }
      } catch (loadError) {
        console.error('Error parsing data', loadError);
        if (!cancelled) {
          setError('Unable to load the scanned profile.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans">
      <main className="flex-1 bg-gradient-to-br from-[#84cc16] via-[#2563eb] to-[#1e40af] p-6 md:p-12 relative">
        <div className="mb-8 flex items-center justify-between flex-row-reverse">
          <h1 className="text-white text-3xl font-black drop-shadow-md text-right">
            Identification Profile
          </h1>
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-all shadow-lg"
          >
            <ArrowLeft />
          </button>
        </div>

        <div className="max-w-6xl mx-auto space-y-6">
          {error ? (
            <div className="rounded-2xl bg-white/15 border border-white/20 text-white px-5 py-4 shadow-lg">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col md:flex-row rounded-[40px] shadow-2xl bg-white overflow-hidden">
            <div className="bg-white p-10 flex flex-col items-center justify-center md:w-1/3 border-r">
              <div className="w-full aspect-square bg-gray-100 border-2 border-dashed border-gray-300 rounded-[32px] flex items-center justify-center relative overflow-hidden group">
                {scannedImage ? (
                  <img src={scannedImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <User className="text-gray-300 mx-auto" size={80} />
                    <p className="text-gray-400 font-bold mt-2">NO PHOTO</p>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-4 bg-[#84cc16] text-white px-6 py-2 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  Change
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const reader = new FileReader();
                  reader.onload = () => setScannedImage(reader.result as string);
                  if (e.target.files?.[0]) reader.readAsDataURL(e.target.files[0]);
                }}
              />
            </div>

            <div className="p-10 flex-1 bg-blue-900 text-white">
              <h2 className="text-2xl font-black mb-8 border-b border-white/10 pb-4">Basic Information</h2>
              {loading ? (
                <div className="space-y-4">
                  <div className="h-6 bg-white/10 rounded animate-pulse" />
                  <div className="h-6 bg-white/10 rounded animate-pulse" />
                  <div className="h-6 bg-white/10 rounded animate-pulse" />
                  <div className="h-24 bg-white/10 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div><label className="text-xs font-bold opacity-50 uppercase tracking-widest">Name</label><p className="text-2xl font-black text-blue-200">{profileData.name || '—'}</p></div>
                    <div><label className="text-xs font-bold opacity-50 uppercase tracking-widest">Type</label><p className="text-xl font-bold">{profileData.type || '—'}</p></div>
                    <div><label className="text-xs font-bold opacity-50 uppercase tracking-widest">Age/Description</label><p className="text-xl font-bold text-red-400">{profileData.description || '—'}</p></div>
                    <div><label className="text-xs font-bold opacity-50 uppercase tracking-widest">Date Reported</label><p className="text-lg font-bold">{profileData.dateTime ? new Date(profileData.dateTime).toLocaleString() : '—'}</p></div>
                    <div className="md:col-span-2"><label className="text-xs font-bold opacity-50 uppercase tracking-widest">Emergency Phone</label><p className="text-3xl font-black text-green-400 tracking-tighter">{profileData.emergencyContact || '—'}</p></div>
                  </div>

                  <div className="mt-8 bg-white/10 rounded-2xl border border-white/10 p-4">
                    <h3 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-2">Notes</h3>
                    <p className="text-sm text-white/90 leading-7">{profileData.notes || 'No extra notes were shared with this profile.'}</p>
                  </div>
                </>
              )}

              <div className="mt-10 flex gap-4 flex-wrap">
                <button
                  onClick={() => {
                    if (!profileData.emergencyContact) return;
                    window.location.href = `tel:${profileData.emergencyContact}`;
                  }}
                  disabled={!profileData.emergencyContact}
                  className="bg-[#84cc16] text-black px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:scale-105 transition-all shadow-md disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Phone size={20} /> Call Now
                </button>

                <button
                  onClick={() => router.push('/chat')}
                  className="bg-white/10 px-8 py-4 rounded-2xl font-black flex items-center gap-2 transition-all duration-300 ease-out hover:bg-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 border border-white/20"
                >
                  <MessageCircle size={20} /> Chat
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[400px]">
            <div className="flex-1 relative">
              <MapClient center={[profileData.coordinates.lat, profileData.coordinates.lng]} marker={[profileData.coordinates.lat, profileData.coordinates.lng]} />
            </div>
            <div className="md:w-1/3 p-10 bg-gray-50 flex flex-col justify-center border-l">
              <MapPin className="text-blue-600 mb-4" size={40} />
              <h3 className="text-gray-400 font-bold text-xs uppercase mb-2 tracking-widest">Found At</h3>
              <p className="text-2xl font-black text-gray-800 mb-6">{profileData.lastLocation || 'Address not provided'}</p>
              <button
                onClick={() => window.open(`https://www.google.com/maps?q=${profileData.coordinates.lat},${profileData.coordinates.lng}`)}
                className="bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all"
              >
                <Navigation size={20} /> Directions
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
