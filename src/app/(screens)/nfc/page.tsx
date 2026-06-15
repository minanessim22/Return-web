'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Copy,
  Database,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  SmartphoneCharging,
  Tag
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export default function NFCPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    type: 'Child',
    name: '',
    photo: '',
    location: '', // maps to lastLocationText
    emergencyContact: user?.phone || '',
    contactName: user?.name || '',
    relation: 'Owner',
    age: '',
    bloodType: '',
    medicalNotes: '',
    clothesColor: '',
    notes: '', // maps to instructions/special notes
    nfcTagUid: '',
    hardwareModel: 'SMART_TAG_LITE' as 'SMART_TAG_LITE' | 'SMART_TAG_PRO'
  });
  const [linkingState, setLinkingStatus] = useState<'idle' | 'progress' | 'success'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkedProfile, setLinkedProfile] = useState<IdentificationProfile | null>(null);
  const [linkedTagUid, setLinkedTagUid] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [hardwareEndpoint, setHardwareEndpoint] = useState('');
  const [hardwareTelemetryEndpoint, setHardwareTelemetryEndpoint] = useState('');
  const [hardwareHeader, setHardwareHeader] = useState('');
  const [hardwareToken, setHardwareToken] = useState('');
  const [hardwareDeviceId, setHardwareDeviceId] = useState('');
  const [hardwareSerialNumber, setHardwareSerialNumber] = useState('');

  useEffect(() => {
    if (user?.phone && !form.emergencyContact) {
      setForm((prev) => ({ ...prev, emergencyContact: user.phone || '' }));
    }
    if (user?.name && !form.contactName) {
      setForm((prev) => ({ ...prev, contactName: user.name || '' }));
    }
  }, [form.emergencyContact, form.contactName, user?.phone, user?.name]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, photo: dataUrl }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the selected image.');
    }
  };

  const handleLink = async () => {
    if (!form.name.trim()) {
      setError('Please enter the profile name first.');
      return;
    }

    setError('');
    setMessage('');
    setCopied(false);
    setLinkingStatus('progress');

    try {
      const isObject = form.type === 'Object';
      const created = await api.createIdentificationProfile({
        displayName: form.name.trim(),
        type: form.type,
        category: form.type,
        photo: form.photo || undefined,
        lastLocationText: form.location.trim() || undefined,
        age: !isObject && form.age ? Number(form.age) : undefined,
        notes: form.notes.trim() || undefined,
        medicalNotes: !isObject ? (form.medicalNotes.trim() || undefined) : undefined,
        clothesColor: isObject ? (form.clothesColor.trim() || undefined) : undefined,
        bloodType: (!isObject && form.type !== 'Pet') ? (form.bloodType.trim() || undefined) : undefined,
        emergencyContact: form.emergencyContact || user?.phone || '',
        emergencyContacts: [
          {
            contactName: form.contactName.trim() || user?.name || 'Owner',
            relation: form.relation.trim() || 'Owner',
            phone: form.emergencyContact || user?.phone || ''
          }
        ]
      });

      const linked = await api.linkNfcTag(created.item.id, { nfcTagUid: form.nfcTagUid || undefined, hardwareModel: form.hardwareModel });
      const profileWithNfc = { ...created.item, nfcTagUid: linked.nfcTagUid };
      const nextPublicUrl = `${window.location.origin}/identify/${created.item.qrPublicToken}`;

      localStorage.setItem(
        'linkedNFCData',
        JSON.stringify({
          profileId: created.item.id,
          nfcTagUid: linked.nfcTagUid,
          name: created.item.displayName,
          photo: created.item.photoUrl || form.photo || null,
          location: created.item.lastLocationText || form.location,
          token: created.item.qrPublicToken
        })
      );

      setLinkedProfile(profileWithNfc);
      setLinkedTagUid(linked.nfcTagUid);
      setPublicUrl(linked.hardware?.publicUrl || nextPublicUrl);
      setHardwareEndpoint(linked.hardware?.endpointUrl || `${window.location.origin}/api/hardware/nfc/scan`);
      setHardwareTelemetryEndpoint(linked.hardware?.telemetryUrl || '');
      setHardwareHeader(linked.hardware?.headerName || 'x-device-token');
      setHardwareToken(linked.hardware?.deviceToken || '');
      setHardwareDeviceId(linked.hardware?.deviceId || '');
      setHardwareSerialNumber(linked.hardware?.serialNumber || `NFC-${linked.nfcTagUid}`);
      setMessage(`NFC tag linked successfully. Tag UID: ${linked.nfcTagUid}`);
      setLinkingStatus('success');
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Unable to link NFC tag.');
      setLinkingStatus('idle');
    }
  };

  const copyText = async (value?: string) => {
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const copyUid = async () => {
    await copyText(linkedTagUid);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4FAD2C] via-[#1183c8] to-[#044FAF] px-4 py-24 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">NFC device tool</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Link a real NFC tag to a profile</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              Write all important details, choose the date and location with real controls, and save the NFC record into the database with a working UID plus a hardware-ready bridge for the NFC reader.
            </p>
          </div>
          <div className="rounded-[2rem] border border-white/20 bg-white/10 px-5 py-4 shadow-2xl backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">NFC result</p>
            <p className="mt-2 text-lg font-black">Real linked tag</p>
            <p className="mt-2 max-w-xs text-sm text-white/80">The UID is stored with the profile, an NFC device is created in Devices, and the hardware reader can send live scans to the backend immediately.</p>
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
                <span className="font-bold text-white/80">Hardware model</span>
                <select value={form.hardwareModel} onChange={(event) => handleChange('hardwareModel', event.target.value as 'SMART_TAG_LITE' | 'SMART_TAG_PRO')} className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none">
                  <option value="SMART_TAG_LITE">Smart Tag Lite - NFC + Barcode</option>
                  <option value="SMART_TAG_PRO">Smart Tag Pro - NFC + Barcode + GPS</option>
                </select>
                <p className="text-xs leading-6 text-white/70">Lite is for NFC + barcode only. Pro keeps the same NFC/barcode flow and also exposes a GPS telemetry endpoint for the hardware tracker.</p>
              </label>              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Name / item model</span>
                <input value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder="Ahmed, wallet, school bag..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              <div className="space-y-2 text-sm md:col-span-2">
                <span className="font-bold text-white/80">Photo</span>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/15 bg-white/10">
                    {form.photo ? <img src={form.photo} alt="NFC preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-10 w-10 text-white/55" />}
                  </div>
                  <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
                    <input value={form.photo} onChange={(event) => handleChange('photo', event.target.value)} placeholder="Optional image URL or upload below" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20">
                      <ImagePlus className="h-4 w-4" /> Upload photo
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => void handlePhotoUpload(event.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              </div>

              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-bold text-white/80">Approximate Address / City</span>
                <input value={form.location} onChange={(event) => handleChange('location', event.target.value)} placeholder="e.g. Tagamoa, Cairo (helps finder narrow down home area)" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              {/* Emergency Contact Group */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:col-span-2 border-t border-white/10 pt-5 mt-2">
                <label className="space-y-2 text-sm">
                  <span className="font-bold text-white/80">Contact Name</span>
                  <input value={form.contactName} onChange={(event) => handleChange('contactName', event.target.value)} placeholder="e.g. Mohamed" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-bold text-white/80">Emergency Phone</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input value={form.emergencyContact} onChange={(event) => handleChange('emergencyContact', event.target.value)} placeholder="010xxxxxxxx" className="w-full rounded-2xl bg-white/95 py-3 pl-11 pr-4 text-slate-900 outline-none" />
                  </div>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-bold text-white/80">Relation / Role</span>
                  <input value={form.relation} onChange={(event) => handleChange('relation', event.target.value)} placeholder="e.g. Father, Mother, Owner" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                </label>
              </div>

              {/* Dynamic Sections Based on Type */}
              {form.type !== 'Object' ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:col-span-2 border-t border-white/10 pt-5 mt-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-bold text-white/80">Age (years)</span>
                    <input type="number" min="0" value={form.age} onChange={(event) => handleChange('age', event.target.value)} placeholder="e.g. 8" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                  </label>

                  {form.type !== 'Pet' ? (
                    <label className="space-y-2 text-sm">
                      <span className="font-bold text-white/80">Blood Type</span>
                      <select value={form.bloodType} onChange={(event) => handleChange('bloodType', event.target.value)} className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none">
                        <option value="">Unknown / Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </label>
                  ) : <div className="hidden md:block" />}

                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-bold text-white/80">Medical Notes / Critical Conditions</span>
                    <textarea rows={3} value={form.medicalNotes} onChange={(event) => handleChange('medicalNotes', event.target.value)} placeholder="e.g. Autism, suffers from asthma, wears glasses..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none resize-none" />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:col-span-2 border-t border-white/10 pt-5 mt-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-bold text-white/80">Item Description / Brand / Model</span>
                    <textarea rows={3} value={form.clothesColor} onChange={(event) => handleChange('clothesColor', event.target.value)} placeholder="e.g. Black leather wallet, contains IDs, silver buckle..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none resize-none" />
                  </label>
                </div>
              )}

              {/* Instructions for Finder */}
              <div className="space-y-2 text-sm md:col-span-2 border-t border-white/10 pt-5 mt-2">
                <label className="space-y-2 text-sm">
                  <span className="font-bold text-white/80">Instructions for Finder / Special Notes</span>
                  <textarea rows={3} value={form.notes} onChange={(event) => handleChange('notes', event.target.value)} placeholder="e.g. Please call immediately, reward if returned safe..." className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none resize-none" />
                </label>
              </div>

              <label className="space-y-2 text-sm md:col-span-2 border-t border-white/10 pt-5">
                <span className="font-bold text-white/80">NFC tag UID</span>
                <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                      <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input value={form.nfcTagUid} onChange={(event) => handleChange('nfcTagUid', event.target.value.toUpperCase())} placeholder="Leave empty to auto-generate the UID" className="w-full rounded-2xl bg-white/95 py-3 pl-11 pr-4 text-slate-900 outline-none" />
                    </div>
                    <button type="button" onClick={() => handleChange('nfcTagUid', `NFC-${Date.now().toString(16).toUpperCase().slice(-8)}`)} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20">
                      <Tag className="h-4 w-4" /> Generate UID
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-white/70">This field now works as a real NFC identifier. If you leave it empty, the system generates a unique UID automatically and stores it in the database, then prepares a hardware token for the reader integration.</p>
                </div>
              </label>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">Database result</p>
                  <p className="mt-2 text-lg font-black">Saving profile + NFC device record</p>
                </div>
                <button onClick={() => void handleLink()} disabled={linkingState === 'progress'} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-60">
                  {linkingState === 'progress' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SmartphoneCharging className="h-4 w-4" />} {linkingState === 'progress' ? 'Linking...' : 'Link NFC tag'}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/80">The created hardware record will appear in Devices, the public barcode page is ready immediately, and the backend exposes an NFC endpoint plus an optional GPS telemetry endpoint for the Pro model.</p>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <SmartphoneCharging className="h-5 w-5" />
                <h2 className="text-xl font-black">NFC link result</h2>
              </div>
              <div className="mt-4 rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">UID</p>
                <p className="mt-2 break-all text-lg font-black">{linkedTagUid || form.nfcTagUid || 'Not linked yet'}</p>
                <button onClick={() => void copyUid()} disabled={!linkedTagUid} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-40">
                  <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy UID'}
                </button>
              </div>
              <div className="mt-4 rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Linked profile</p>
                <p className="mt-2 text-lg font-black">{linkedProfile?.displayName || form.name || 'Will appear after linking'}</p>
                <p className="mt-2 text-sm leading-6 text-white/80">{linkedProfile?.lastLocationText || form.location || 'No location selected yet.'}</p>
                {publicUrl ? (
                  <Link href={publicUrl} target="_blank" className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                    <ExternalLink className="h-4 w-4" /> Open public profile
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5" />
                <h2 className="text-xl font-black">Database sync</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/85">
                <p><span className="font-black text-white">Profile ID:</span> {linkedProfile?.id || 'Will appear after saving'}</p>
                <p><span className="font-black text-white">NFC UID:</span> {linkedTagUid || 'Will appear after saving'}</p>
                <p><span className="font-black text-white">Created:</span> {formatDate(linkedProfile?.createdAt)}</p>
                <p><span className="font-black text-white">Last sync:</span> {formatDate(linkedProfile?.updatedAt)}</p>
                <p><span className="font-black text-white">Hardware model:</span> {form.hardwareModel === 'SMART_TAG_PRO' ? 'Smart Tag Pro' : 'Smart Tag Lite'}</p>
                <p><span className="font-black text-white">Device record:</span> NFC-based hardware is created automatically in Devices</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-xl font-black">Hardware-ready bridge</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/85">
                <p><span className="font-black text-white">Endpoint:</span> {hardwareEndpoint || `${typeof window !== 'undefined' ? window.location.origin : ''}/api/hardware/nfc/scan`}</p>
                <p><span className="font-black text-white">Header:</span> {hardwareHeader || 'x-device-token'}</p>
                <p><span className="font-black text-white">Barcode page:</span> {publicUrl || 'Will appear after linking'}</p>
                <p><span className="font-black text-white">Device token:</span> {hardwareToken || 'Will appear after linking'}</p>
                <p><span className="font-black text-white">Device ID:</span> {hardwareDeviceId || 'Will appear after linking'}</p>
                <p><span className="font-black text-white">Serial:</span> {hardwareSerialNumber || 'Will appear after linking'}</p>
                {hardwareTelemetryEndpoint ? <p><span className="font-black text-white">GPS telemetry:</span> {hardwareTelemetryEndpoint}</p> : null}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button onClick={() => void copyText(hardwareToken)} disabled={!hardwareToken} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-40">
                    <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy device token'}
                  </button>
                  <button onClick={() => void copyText(hardwareEndpoint)} disabled={!hardwareEndpoint} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                    <ExternalLink className="h-4 w-4" /> Copy endpoint
                  </button>
                </div>
                <p className="text-xs leading-6 text-white/70">The NFC reader can POST <span className="font-black text-white">nfcTagUid</span>, optional location, and battery data to the backend by using the device token in the header above. The barcode / QR side is already ready through the public profile page, and Smart Tag Pro hardware can also POST live GPS data to the telemetry endpoint.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 text-sm leading-7 text-white/85 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-xl font-black">What changed</h2>
              </div>
              <p className="mt-4">The page now supports both Smart Tag Lite (NFC + barcode) and Smart Tag Pro (NFC + barcode + GPS). The NFC UID is stored as a real device identifier, the barcode page is ready immediately, and the Pro model exposes a dedicated GPS telemetry endpoint for the hardware team.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
