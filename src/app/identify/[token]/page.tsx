'use client';

import { use, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Copy, Database, MapPin, Navigation, Phone, QrCode, ShieldCheck, UserCircle2 } from 'lucide-react';

type PublicProfile = {
  id: string;
  displayName: string;
  age?: number;
  category?: string;
  clothesColor?: string;
  bloodType?: string;
  medicalNotes?: string;
  notes?: string;
  lastLocationText?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  qrPublicToken: string;
  nfcTagUid?: string;
  isActive: boolean;
  emergencyContacts: Array<{ id: string; contactName: string; relation?: string; phone: string }>;
  createdAt: string;
  updatedAt: string;
};

const MapClient = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/10" />
});

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PublicIdentifyPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [item, setItem] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`/api/public/identify/${encodeURIComponent(resolvedParams.token)}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to load this identification page.');
        }
        if (!cancelled) {
          setItem(payload.item);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof DOMException && loadError.name === 'AbortError') {
            setError('The identification page took too long to load on this device. Please try again on a stronger connection.');
          } else {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load this identification page.');
          }
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [resolvedParams.token]);

  useEffect(() => {
    setImageFailed(false);
    setShowMap(false);
  }, [item?.photoUrl]);

  const primaryContact = item?.emergencyContacts?.[0];
  const coordinates = useMemo(() => {
    if (item?.latitude === undefined || item?.longitude === undefined) return null;
    return [item.latitude, item.longitude] as [number, number];
  }, [item?.latitude, item?.longitude]);

  const copyToken = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !item?.qrPublicToken) return;
    try {
      await navigator.clipboard.writeText(item.qrPublicToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#014CB3] via-[#0d5fcb] to-[#60C10F] px-4 py-6 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex justify-end">
          <div className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            Secure public identification page
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="h-[420px] animate-pulse rounded-[2rem] bg-white/10" />
            <div className="h-[420px] animate-pulse rounded-[2rem] bg-white/10" />
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-white/20 bg-white/10 px-6 py-10 text-center shadow-2xl backdrop-blur">
            <h1 className="text-3xl font-black">Profile unavailable</h1>
            <p className="mt-4 text-white/80">{error}</p>
            <Link href="/" className="mt-6 inline-flex rounded-full border border-white/25 bg-white/15 px-5 py-3 font-bold hover:bg-white/20">
              Return home
            </Link>
          </div>
        ) : item ? (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/10">
                  {item.photoUrl && !imageFailed ? (
                    <img src={item.photoUrl} alt={item.displayName} className="h-[300px] w-full object-cover sm:h-[340px]" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
                  ) : (
                    <div className="flex h-[340px] w-full items-center justify-center bg-white/10 text-white/70">
                      <UserCircle2 className="h-24 w-24" />
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">Identification</p>
                    <h1 className="mt-2 text-3xl font-black">{item.displayName}</h1>
                    <p className="mt-2 text-white/75">This page is designed for QR scans so a finder can review the profile details clearly instead of seeing raw JSON.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">Type</p>
                      <p className="mt-2 text-lg font-black">{item.category || 'Profile'}</p>
                    </div>
                    <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">Age</p>
                      <p className="mt-2 text-lg font-black">{item.age !== undefined ? `${item.age} years` : '—'}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">Finder instructions</p>
                    <p className="mt-2 text-sm leading-6 text-white/90">
                      Please contact the emergency number first, share the location if possible, and avoid posting sensitive personal data publicly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Emergency contact</p>
                    <p className="mt-3 text-2xl font-black">{primaryContact?.contactName || 'Owner contact'}</p>
                    <p className="mt-2 text-white/80">{primaryContact?.relation || 'Primary contact'}</p>
                    <p className="mt-4 text-xl font-bold text-[#dcf6c0]">{primaryContact?.phone || 'Not shared'}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {primaryContact?.phone ? (
                        <a href={`tel:${primaryContact.phone}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-black text-[#014CB3] shadow-lg">
                          <Phone className="h-4 w-4" /> Call now
                        </a>
                      ) : null}
                      {coordinates ? (
                        <a
                          href={`https://www.google.com/maps?q=${coordinates[0]},${coordinates[1]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 font-bold hover:bg-white/20"
                        >
                          <Navigation className="h-4 w-4" /> Directions
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Last known location</p>
                    <p className="mt-3 text-xl font-black">{item.lastLocationText || 'Location not provided'}</p>
                    <p className="mt-4 text-white/80">Updated {formatDate(item.updatedAt)}</p>
                    {item.clothesColor ? <p className="mt-2 text-white/75">Clothes / color: {item.clothesColor}</p> : null}
                    {item.bloodType ? <p className="mt-2 text-white/75">Blood type: {item.bloodType}</p> : null}
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5 md:col-span-2">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Medical notes</p>
                    <p className="mt-3 text-white/90 leading-7">{item.medicalNotes || 'No medical notes were provided on this page.'}</p>
                    <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Extra notes</p>
                      <p className="mt-2 text-white/85 leading-7">{item.notes || 'No extra notes were added to the QR profile.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5" />
                    <h2 className="text-xl font-black">Location map</h2>
                  </div>
                  {coordinates ? (
                    <button
                      type="button"
                      onClick={() => setShowMap((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
                    >
                      <Navigation className="h-4 w-4" /> {showMap ? 'Hide map' : 'Show map'}
                    </button>
                  ) : null}
                </div>
                <div className="h-[280px] sm:h-[360px]">
                  {coordinates ? (
                    showMap ? (
                      <MapClient center={coordinates} marker={coordinates} />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/75">
                        <p className="max-w-md text-sm leading-7">To keep this page lighter and more stable on mobile devices, the interactive map loads only when you request it.</p>
                        <button
                          type="button"
                          onClick={() => setShowMap(true)}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black text-[#014CB3] shadow-lg"
                        >
                          <MapPin className="h-4 w-4" /> Load map
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-white/70">No coordinates were stored with this profile.</div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5" />
                    <h2 className="text-lg font-black">QR profile token</h2>
                  </div>
                  <p className="mt-4 break-all rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-sm">{item.qrPublicToken}</p>
                  <button onClick={copyToken} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 font-bold hover:bg-white/20">
                    <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy token'}
                  </button>
                </div>

                <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5" />
                    <h2 className="text-lg font-black">Database sync</h2>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-white/85">
                    <p><span className="font-black text-white">Record ID:</span> {item.id}</p>
                    <p><span className="font-black text-white">Status:</span> {item.isActive ? 'ACTIVE' : 'INACTIVE'}</p>
                    <p><span className="font-black text-white">Created:</span> {formatDate(item.createdAt)}</p>
                    <p><span className="font-black text-white">Last sync:</span> {formatDate(item.updatedAt)}</p>
                    <p><span className="font-black text-white">NFC UID:</span> {item.nfcTagUid || 'Not linked'}</p>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5" />
                    <h2 className="text-lg font-black">Safety note</h2>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/90">
                    Only the identification data intentionally shared for recovery is shown here. Sensitive account controls remain protected inside the main RETURN platform.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
