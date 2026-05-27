'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BatteryMedium,
  Database,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Save,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import type { DeviceItem, IdentificationProfile } from '@/lib/shared-types';

const MapClient = dynamic(() => import('@/components/Map'), { ssr: false });

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function createEmptyForm() {
  return {
    label: '',
    serialNumber: '',
    linkedProfileId: '',
    status: 'ACTIVE' as DeviceItem['status'],
    trackingEnabled: true,
    updateIntervalMinutes: '5',
    batteryLevel: '84',
    lastLocationText: '',
    latitude: '',
    longitude: ''
  };
}

function formFromDevice(device: DeviceItem) {
  return {
    label: device.label,
    serialNumber: device.serialNumber,
    linkedProfileId: device.linkedProfileId || '',
    status: device.status,
    trackingEnabled: Boolean(device.trackingEnabled),
    updateIntervalMinutes: device.updateIntervalMinutes ? String(device.updateIntervalMinutes) : '5',
    batteryLevel: device.batteryLevel !== undefined ? String(device.batteryLevel) : '84',
    lastLocationText: device.lastLocationText || '',
    latitude: device.latitude !== undefined ? String(device.latitude) : '',
    longitude: device.longitude !== undefined ? String(device.longitude) : ''
  };
}

function GPSPageContent() {
  const searchParams = useSearchParams();
  const initialDeviceId = searchParams.get('deviceId') || '';
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [profiles, setProfiles] = useState<IdentificationProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const [devicesResponse, profilesResponse] = await Promise.all([api.devices(), api.identificationProfiles()]);
      const gpsDevices = (devicesResponse.items as DeviceItem[]).filter((device) => device.type === 'GPS');
      setDevices(gpsDevices);
      setProfiles(profilesResponse.items);

      const nextSelectedId = preferredId && gpsDevices.some((device) => device.id === preferredId)
        ? preferredId
        : initialDeviceId && gpsDevices.some((device) => device.id === initialDeviceId)
          ? initialDeviceId
          : gpsDevices[0]?.id || '';
      setSelectedId(nextSelectedId);
      setForm(nextSelectedId ? formFromDevice(gpsDevices.find((device) => device.id === nextSelectedId) as DeviceItem) : createEmptyForm());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load GPS devices.');
    } finally {
      setLoading(false);
    }
  }, [initialDeviceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedDevice = useMemo(() => devices.find((device) => device.id === selectedId) || null, [devices, selectedId]);
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === form.linkedProfileId) || null, [form.linkedProfileId, profiles]);
  const coordinates = useMemo(() => {
    const latitude = toOptionalNumber(form.latitude);
    const longitude = toOptionalNumber(form.longitude);
    if (latitude === undefined || longitude === undefined) return undefined;
    return [latitude, longitude] as [number, number];
  }, [form.latitude, form.longitude]);

  const locationMarkers = useMemo(() => {
    if (!selectedDevice || selectedDevice.locationHistory.length === 0) {
      return coordinates ? [{ position: coordinates, label: form.lastLocationText || 'Current location' }] : [];
    }
    return selectedDevice.locationHistory.slice(0, 8).map((entry, index) => ({
      position: [entry.latitude, entry.longitude] as [number, number],
      label: `${index === 0 ? 'Latest' : 'Point'} • ${formatDate(entry.createdAt)}`
    }));
  }, [coordinates, form.lastLocationText, selectedDevice]);

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedId(deviceId);
    const device = devices.find((entry) => entry.id === deviceId);
    setForm(device ? formFromDevice(device) : createEmptyForm());
    setMessage('');
    setError('');
  };

  const handleCreateNew = () => {
    setSelectedId('');
    setForm(createEmptyForm());
    setMessage('Ready to create a new GPS tracker.');
    setError('');
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
        setForm((current) => ({
          ...current,
          latitude,
          longitude,
          lastLocationText: current.lastLocationText || `Lat ${latitude}, Lng ${longitude}`
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

  const handleSave = async () => {
    if (!form.label.trim()) {
      setError('Please enter the GPS device label first.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        type: 'GPS',
        label: form.label.trim(),
        serialNumber: form.serialNumber || undefined,
        linkedProfileId: form.linkedProfileId || undefined,
        status: form.status,
        trackingEnabled: form.trackingEnabled,
        updateIntervalMinutes: toOptionalNumber(form.updateIntervalMinutes),
        batteryLevel: toOptionalNumber(form.batteryLevel),
        lastLocationText: form.lastLocationText || undefined,
        latitude: toOptionalNumber(form.latitude),
        longitude: toOptionalNumber(form.longitude)
      };

      if (selectedId) {
        await api.updateDevice(selectedId, payload);
        setMessage('GPS device updated successfully.');
        await loadData(selectedId);
      } else {
        const response = await api.createDevice(payload);
        setMessage('GPS device created successfully.');
        await loadData(response.item.id);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this GPS device.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedDevice) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm(`Delete ${selectedDevice.label}?`);
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    setMessage('');
    try {
      await api.deleteDevice(selectedId);
      setMessage('GPS device deleted successfully.');
      await loadData('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this GPS device.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#014CB3] via-[#0d63d0] to-[#60C10F] px-4 py-24 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">GPS tracker tool</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Real-time GPS device control</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/80 md:text-base">
              This page is fully interactive now. Create or select a GPS tracker, turn it on or off, capture a real location, save it into the database, and review the location history on the map.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void loadData(selectedId)} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 font-bold transition hover:bg-white/20">
              <RefreshCw className="h-4 w-4" /> Refresh devices
            </button>
            <button onClick={handleCreateNew} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black text-[#014CB3] shadow-lg">
              <Plus className="h-4 w-4" /> New GPS tracker
            </button>
          </div>
        </div>

        {message ? <div className="mb-5 rounded-[1.5rem] bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">{message}</div> : null}
        {error ? <div className="mb-5 rounded-[1.5rem] bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <aside className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5" />
              <h2 className="text-xl font-black">GPS devices</h2>
            </div>
            <p className="mt-3 text-sm text-white/75">Select a saved tracker or create a new one. Each GPS device here is connected to the database and can store location history.</p>
            <div className="mt-5 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => <div key={idx} className="h-24 animate-pulse rounded-[1.5rem] bg-white/10" />)
              ) : devices.length > 0 ? (
                devices.map((device) => {
                  const active = device.id === selectedId;
                  return (
                    <button key={device.id} onClick={() => handleSelectDevice(device.id)} className={`w-full rounded-[1.5rem] border p-4 text-left transition ${active ? 'border-white/40 bg-white/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-black">{device.label}</p>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]">{device.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-white/70">Database ID: {device.id}</p>
                      <p className="mt-2 text-sm text-white/85">{device.lastLocationText || 'No location saved yet.'}</p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.5rem] border border-white/15 bg-white/5 px-4 py-6 text-sm leading-7 text-white/75">No GPS devices yet. Create one from the form on the right and it will appear here with full controls.</div>
              )}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur md:p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Device label</span>
                <input value={form.label} onChange={(event) => updateField('label', event.target.value)} placeholder="School GPS bracelet" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Serial number</span>
                <input value={form.serialNumber} onChange={(event) => updateField('serialNumber', event.target.value)} placeholder="GPS-0001" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Linked profile</span>
                <select value={form.linkedProfileId} onChange={(event) => updateField('linkedProfileId', event.target.value)} className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none">
                  <option value="">No linked profile yet</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.displayName}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Status</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="DISCONNECTED">DISCONNECTED</option>
                  <option value="LOW_BATTERY">LOW_BATTERY</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Update interval (minutes)</span>
                <input value={form.updateIntervalMinutes} onChange={(event) => updateField('updateIntervalMinutes', event.target.value)} placeholder="5" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-bold text-white/80">Battery level</span>
                <div className="relative">
                  <BatteryMedium className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={form.batteryLevel} onChange={(event) => updateField('batteryLevel', event.target.value)} placeholder="84" className="w-full rounded-2xl bg-white/95 py-3 pl-11 pr-4 text-slate-900 outline-none" />
                </div>
              </label>

              <div className="space-y-2 text-sm md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-white/80">Latest location</span>
                  <button type="button" onClick={handleUseCurrentLocation} disabled={locating} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/20 disabled:opacity-60">
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} Use current location
                  </button>
                </div>
                <input value={form.lastLocationText} onChange={(event) => updateField('lastLocationText', event.target.value)} placeholder="Nasr City, Cairo" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input value={form.latitude} onChange={(event) => updateField('latitude', event.target.value)} placeholder="Latitude" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                  <input value={form.longitude} onChange={(event) => updateField('longitude', event.target.value)} placeholder="Longitude" className="w-full rounded-2xl bg-white/95 px-4 py-3 text-slate-900 outline-none" />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <button type="button" onClick={() => updateField('trackingEnabled', !form.trackingEnabled)} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black shadow-lg transition ${form.trackingEnabled ? 'bg-white text-[#014CB3]' : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'}`}>
                <Radio className="h-4 w-4" /> {form.trackingEnabled ? 'Tracking enabled' : 'Tracking paused'}
              </button>
              <button onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {selectedId ? 'Save GPS changes' : 'Create GPS device'}
              </button>
            </div>

            {selectedId ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-60">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete device
                </button>
                <Link href="/tracking/history" className="inline-flex items-center gap-2 rounded-full border border-[#60C10F] bg-[#60C10F]/15 px-4 py-2 text-sm font-bold text-white hover:bg-[#60C10F]/30 transition-colors">
                  <Route className="h-4 w-4 text-[#60C10F]" /> View History & Geofences
                </Link>
                {selectedProfile ? (
                  <Link href={`/identify/${selectedProfile.qrPublicToken}`} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                    <ExternalLink className="h-4 w-4" /> Open linked profile
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="space-y-5">
            <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                <Route className="h-5 w-5" />
                <h2 className="text-xl font-black">Live map</h2>
              </div>
              <div className="h-[250px]">
                {coordinates || locationMarkers.length > 0 ? (
                  <MapClient center={coordinates || locationMarkers[0].position} markers={locationMarkers.length > 0 ? locationMarkers : undefined} marker={coordinates} />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">Capture a real location and the map will show the saved point and recent history.</div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5" />
                <h2 className="text-xl font-black">Database sync</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/85">
                <p><span className="font-black text-white">Device ID:</span> {selectedDevice?.id || 'Will appear after creation'}</p>
                <p><span className="font-black text-white">Serial:</span> {form.serialNumber || 'Will be generated if empty'}</p>
                <p><span className="font-black text-white">Linked profile:</span> {selectedProfile?.displayName || 'Not linked yet'}</p>
                <p><span className="font-black text-white">Location points:</span> {selectedDevice?.locationHistory.length || 0}</p>
                <p><span className="font-black text-white">Last sync:</span> {formatDate(selectedDevice?.updatedAt)}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="text-xl font-black">Recent location history</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/85">
                {selectedDevice?.locationHistory.length ? (
                  selectedDevice.locationHistory.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="rounded-[1.5rem] border border-white/15 bg-white/5 p-4">
                      <p className="font-black">{entry.address || `Lat ${entry.latitude.toFixed(4)}, Lng ${entry.longitude.toFixed(4)}`}</p>
                      <p className="mt-2 text-white/70">{formatDate(entry.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-white/15 bg-white/5 p-4 text-white/70">No history saved yet. Use the location button and save the device to create a real GPS history entry.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function GPSPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center font-bold text-lg">
          Loading GPS dashboard...
        </div>
      )}
    >
      <GPSPageContent />
    </Suspense>
  );
}
