'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  CalendarDays,
  Copy,
  Database,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Navigation,
  Phone,
  Printer,
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import type { IdentificationProfile } from '@/lib/shared-types';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const IMAGE_MAX_DIMENSION = 1200;
const IMAGE_QUALITY = 0.7;

function compressImage(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Only resize if the image exceeds the max dimension
      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        const ratio = Math.min(IMAGE_MAX_DIMENSION / width, IMAGE_MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to create canvas context for image compression.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Encode as JPEG at reduced quality to shrink the payload
      const compressedDataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to load the selected image for compression.'));
    };

    img.src = objectUrl;
  });
}

function downloadDataUrl(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name || 'return-qr'}-${Date.now()}.png`;
  link.click();
}

export default function QRPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    type: 'Child',
    name: '',
    photo: '',
    location: '',
    latitude: '',
    longitude: '',
    dateTime: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    emergencyContact: user?.phone || '',
    description: '',
    notes: ''
  });
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [profileToken, setProfileToken] = useState('');
  const [createdProfile, setCreatedProfile] = useState<IdentificationProfile | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.phone && !form.emergencyContact) {
      setForm((prev) => ({ ...prev, emergencyContact: user.phone || '' }));
    }
  }, [form.emergencyContact, user?.phone]);

  const emergencyPhone = form.emergencyContact || user?.phone || '';

  const previewNotes = useMemo(() => {
    const parts = [form.notes.trim()];
    if (form.dateTime) {
      parts.push(`Recorded date/time: ${formatDate(form.dateTime)}`);
    }
    return parts.filter(Boolean).join('\n');
  }, [form.dateTime, form.notes]);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      setForm((prev) => ({ ...prev, photo: compressedDataUrl }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the selected image.');
    }
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not available in this browser.');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        setForm((prev) => ({
          ...prev,
          latitude,
          longitude,
          location: prev.location || `Lat ${latitude}, Lng ${longitude}`
        }));
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        setError(geoError.message || 'Unable to capture the current location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const generateQrImage = async () => {
    if (!form.name.trim()) {
      setError('Please enter the profile name first.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    setCopied(false);

    try {
      const created = await api.createIdentificationProfile({
        displayName: form.name.trim(),
        type: form.type,
        category: form.type,
        photo: form.photo || undefined,
        location: form.location || undefined,
        lastLocationText: form.location || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        age: form.description ? Number(form.description.replace(/[^0-9]/g, '')) || undefined : undefined,
        notes: previewNotes,
        medicalNotes: form.description || undefined,
        emergencyContact: emergencyPhone,
        emergencyContacts: [
          {
            contactName: user?.name || 'Owner',
            relation: 'Owner',
            phone: emergencyPhone
          }
        ],
        createQrDevice: true
      });

      const qrInfo = await api.createQrForProfile(created.item.id);
      const url = await QRCode.toDataURL(qrInfo.publicUrl, { width: 400, margin: 2 });

      setCreatedProfile(created.item);
      setQrDataUrl(url);
      setPublicUrl(qrInfo.publicUrl);
      setProfileToken(qrInfo.token);
      setMessage('QR profile created successfully. The finder will now see a full public page, not raw JSON.');

      localStorage.setItem(
        'lastReportData',
        JSON.stringify({
          id: created.item.id,
          name: created.item.displayName,
          description: form.description || 'No description',
          location: created.item.lastLocationText || 'Unknown location',
          dateTime: form.dateTime || new Date().toISOString(),
          photo: created.item.photoUrl || form.photo || null,
          token: qrInfo.token
        })
      );
      localStorage.setItem('generatedQrToken', qrInfo.token);

      if (user?.preference.autoDownloadQr) {
        downloadDataUrl(url, created.item.displayName);
      }
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'QR generation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl || !createdProfile) return;
    downloadDataUrl(qrDataUrl, createdProfile.displayName);
  };

  const printQR = () => {
    if (!qrDataUrl || !publicUrl || !createdProfile) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>RETURN QR</title></head><body style="margin:0;padding:30px;font-family:Arial,sans-serif;background:#f4f8ff;"><div style="max-width:700px;margin:0 auto;background:white;padding:30px;border-radius:24px;text-align:center;box-shadow:0 20px 60px rgba(1,76,179,.15)"><h1 style="margin:0 0 12px;font-size:32px;color:#014CB3">${createdProfile.displayName}</h1><p style="margin:0 0 20px;color:#4b5563">QR public profile page</p><img src="${qrDataUrl}" alt="QR Code" style="max-width:320px;width:100%;height:auto;" /><p style="margin-top:20px;word-break:break-word;color:#111827">${publicUrl}</p></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const copyPublicUrl = async () => {
    if (!publicUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#014CB3] via-[#0d63d0] to-[#60C10F] px-4 py-24 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">QR device tool</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Create a full QR identification page</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              This tool creates a QR tag, saves it to the database, links it to the identification profile, and opens a polished public details page for the finder.
            </p>
          </div>
          <div className="rounded-[2rem] border border-white/20 bg-white/10 px-5 py-4 shadow-2xl backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">Finder experience</p>
            <p className="mt-2 text-lg font-black">Styled profile page</p>
            <p className="mt-2 max-w-xs text-sm text-white/80">Scanning the QR now opens a readable profile page with image, contact info, location, notes, and database sync details.</p>
          </div>
        </div>

        {message ? <div className="mb-5 rounded-[1.5rem] bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">{message}</div> : null}
        {error ? <div className="mb-5 rounded-[1.5rem] bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
          <section className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur md:p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Type</span>
                <select value={form.type} onChange={(event) => handleChange('type', event.target.value)} className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none">
                  <option>Child</option>
                  <option>Adult</option>
                  <option>Pet</option>
                  <option>Object</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Name / item model</span>
                <input value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder="Ahmed, bracelet, school bag..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              <div className="space-y-2 text-sm md:col-span-2">
                <span className="font-bold text-white/80">Photo</span>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/15 bg-white/10">
                    {form.photo ? <img src={form.photo} alt="QR preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-10 w-10 text-white/55" />}
                  </div>
                  <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
                    <input value={form.photo} onChange={(event) => handleChange('photo', event.target.value)} placeholder="Optional image URL or upload below" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20">
                      <ImagePlus className="h-4 w-4" /> Upload photo
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => void handlePhotoUpload(event.target.files?.[0])} />
                    </label>
                    <p className="mt-3 text-xs leading-6 text-white/70">The photo appears inside the public QR page and helps the finder identify the person or item quickly.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-white/80">Last known location</span>
                  <button type="button" onClick={handleUseCurrentLocation} disabled={locating} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/20 disabled:opacity-60">
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} Use current location
                  </button>
                </div>
                <input value={form.location} onChange={(event) => handleChange('location', event.target.value)} placeholder="Damanhur, Beheira..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input value={form.latitude} onChange={(event) => handleChange('latitude', event.target.value)} placeholder="Latitude" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                  <input value={form.longitude} onChange={(event) => handleChange('longitude', event.target.value)} placeholder="Longitude" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                </div>
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Date / time</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="datetime-local" value={form.dateTime} onChange={(event) => handleChange('dateTime', event.target.value)} className="w-full rounded-2xl bg-white/95 py-3 pl-11 pr-4 text-slate-900 outline-none" />
                </div>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Emergency phone</span>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={form.emergencyContact} onChange={(event) => handleChange('emergencyContact', event.target.value)} placeholder="010xxxxxxxx" className="w-full rounded-2xl bg-white/95 py-3 pl-11 pr-4 text-slate-900 outline-none" />
                </div>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Description / age / model</span>
                <input value={form.description} onChange={(event) => handleChange('description', event.target.value)} placeholder="10 years, navy hoodie, serial model..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Finder notes</span>
                <input value={form.notes} onChange={(event) => handleChange('notes', event.target.value)} placeholder="Any medical, safety, or handling notes" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">Database result</p>
                  <p className="mt-2 text-lg font-black">Saving profile + QR device record</p>
                </div>
                <button onClick={() => void generateQrImage()} disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} {submitting ? 'Creating...' : 'Create QR profile'}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/80">A QR device is linked automatically in Devices, and the public page is ready to share or print immediately.</p>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5" />
                <h2 className="text-xl font-black">QR preview</h2>
              </div>
              <div className="mt-5 flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                {qrDataUrl ? <img src={qrDataUrl} alt="Generated QR" className="max-h-[280px] w-full max-w-[280px] rounded-2xl bg-white p-3" /> : <p className="max-w-xs text-center text-sm leading-7 text-white/70">Generate the QR to preview the final code here. The printed code will open the public details page for the finder.</p>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={downloadQR} disabled={!qrDataUrl} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-40">
                  <Download className="h-4 w-4" /> Download
                </button>
                <button onClick={printQR} disabled={!qrDataUrl} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-40">
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>
              {publicUrl ? (
                <>
                  <div className="mt-4 rounded-[1.5rem] border border-white/15 bg-white/5 px-4 py-3 text-xs text-white/90">
                    <p className="font-black uppercase tracking-[0.18em] text-white/60">Public page link</p>
                    <p className="mt-2 break-all leading-6">{publicUrl}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button onClick={() => void copyPublicUrl()} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#014CB3] shadow-lg">
                      <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}
                    </button>
                    <Link href={publicUrl} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20">
                      <ExternalLink className="h-4 w-4" /> Open page
                    </Link>
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-xl font-black">Public page details</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/85">
                <div className="rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Name</p>
                  <p className="mt-2 text-lg font-black">{createdProfile?.displayName || form.name || 'Not created yet'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Location</p>
                    <p className="mt-2 leading-6">{createdProfile?.lastLocationText || form.location || '—'}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Contact</p>
                    <p className="mt-2 leading-6">{emergencyPhone || '—'}</p>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Description</p>
                  <p className="mt-2 leading-6">{form.description || 'No description yet.'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5" />
                <h2 className="text-xl font-black">Database sync</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/85">
                <p><span className="font-black text-white">Profile ID:</span> {createdProfile?.id || 'Will appear after saving'}</p>
                <p><span className="font-black text-white">QR token:</span> {profileToken || 'Will appear after saving'}</p>
                <p><span className="font-black text-white">Created:</span> {formatDate(createdProfile?.createdAt)}</p>
                <p><span className="font-black text-white">Last sync:</span> {formatDate(createdProfile?.updatedAt)}</p>
                <p><span className="font-black text-white">Linked device:</span> QR device is created automatically in Devices</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 text-sm leading-7 text-white/85 shadow-2xl backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">What changes now</p>
              <p className="mt-2">The QR no longer points to raw JSON. It opens a clear page with photo, contact details, location, notes, and database identifiers so the finder sees useful information immediately.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
