'use client';

/**
 * /tracking/history
 * ─────────────────────────────────────────────────────────────────
 * Location History · Daily Stats · Geofencing
 * Premium graduation-project quality design.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { CircleOverlay } from '@/components/Map';
import {
  MapPin, BarChart3, Shield, Plus, Trash2,
  Clock, Navigation, Zap, Battery, Activity, ArrowLeft,
  Calendar, TrendingUp, AlertCircle, Eye, EyeOff, ChevronRight,
  Radio, ChevronDown,
} from 'lucide-react';

const DynamicMap = dynamic(() => import('@/components/Map'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────

interface Geofence {
  id: string;
  deviceId: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  isActive: boolean;
  lastState?: 'inside' | 'outside' | 'unknown';
}

interface DayStats {
  date: string;
  totalPoints: number;
  totalDistanceKm: number;
  activeMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgBattery: number | null;
  minBattery: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  alertCount: Record<string, number>;
  weekSummary: { date: string; distanceKm: number; points: number; activeMinutes: number }[];
}

interface TrailPoint {
  lat: number;
  lon: number;
  recordedAt: string;
  battery?: number;
  speed?: number;
  alertType?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
// ── Page ──────────────────────────────────────────────────────────

interface GpsDevice {
  id: string;
  serialNumber: string;
  label: string;
  status: string;
}

// ── Page ──────────────────────────────────────────────────────────

export default function TrackingHistoryPage() {
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'geofences'>('stats');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Devices
  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [showDevicePicker, setShowDevicePicker] = useState(false);

  // Stats
  const [stats, setStats] = useState<DayStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Trail
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);

  // Geofences
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [fenceName, setFenceName] = useState('');
  const [fenceRadius, setFenceRadius] = useState('200');
  const [fenceCenter, setFenceCenter] = useState<[number, number] | null>(null);
  const [alertEnter, setAlertEnter] = useState(true);
  const [alertExit, setAlertExit] = useState(true);
  const [saving, setSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // ── Load devices on mount ───────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/devices');
        if (r.ok) {
          const d = await r.json();
          const items: GpsDevice[] = (d.items || []).filter((dev: any) => dev.type === 'GPS');
          setDevices(items);
          if (items.length > 0) {
            setSelectedDevice(items[0].serialNumber || items[0].id);
          }
        }
      } catch { /* ignore */ }
      finally { setDevicesLoading(false); }
    })();
  }, []);

  // ── Loaders ─────────────────────────────────────────────────────

  const loadStats = useCallback(async (date: string) => {
    if (!selectedDevice) return;
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/tracker/stats?device_id=${selectedDevice}&date=${date}`);
      setStats(r.ok ? await r.json() : null);
    } catch { setStats(null); }
    finally { setStatsLoading(false); }
  }, [selectedDevice]);

  const loadTrail = useCallback(async (date: string) => {
    if (!selectedDevice) return;
    setTrailLoading(true);
    try {
      const r = await fetch(`/api/tracker/history?device_id=${selectedDevice}&from=${date}T00:00:00Z&to=${date}T23:59:59Z&limit=2000`);
      const d = await r.json();
      setTrail(Array.isArray(d.trail) ? d.trail : []);
    } catch { setTrail([]); }
    finally { setTrailLoading(false); }
  }, [selectedDevice]);

  const loadGeo = useCallback(async () => {
    if (!selectedDevice) return;
    setGeoLoading(true);
    try {
      const r = await fetch(`/api/tracker/geofences?device_id=${selectedDevice}`);
      const d = await r.json();
      setGeofences(Array.isArray(d.geofences) ? d.geofences : []);
    } catch { setGeofences([]); }
    finally { setGeoLoading(false); }
  }, [selectedDevice]);

  useEffect(() => { if (selectedDevice) loadStats(selectedDate); }, [selectedDate, selectedDevice, loadStats]);
  useEffect(() => { if (activeTab === 'history' && selectedDevice) loadTrail(selectedDate); }, [activeTab, selectedDate, selectedDevice, loadTrail]);
  useEffect(() => { if (activeTab === 'geofences' && selectedDevice) loadGeo(); }, [activeTab, selectedDevice, loadGeo]);

  // ── Geofence CRUD ───────────────────────────────────────────────

  const createFence = async () => {
    if (!fenceName.trim()) return notify('Please enter a name', false);
    if (!fenceCenter) return notify('Click on the map to place geofence center', false);
    setSaving(true);
    try {
      const r = await fetch('/api/tracker/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice, name: fenceName.trim(),
          lat: fenceCenter[0], lon: fenceCenter[1],
          radiusMeters: Number(fenceRadius) || 200,
          alertOnEnter: alertEnter, alertOnExit: alertExit,
        }),
      });
      if (!r.ok) throw new Error();
      setFenceName(''); setFenceCenter(null); setFenceRadius('200'); setShowCreate(false);
      await loadGeo();
      notify('Geofence created successfully ✓');
    } catch { notify('Failed to create geofence', false); }
    finally { setSaving(false); }
  };

  const toggleFence = async (f: Geofence) => {
    try {
      await fetch(`/api/tracker/geofences?id=${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !f.isActive }),
      });
      await loadGeo();
      notify(f.isActive ? 'Geofence disabled' : 'Geofence enabled');
    } catch { notify('Update failed', false); }
  };

  const deleteFence = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    try {
      await fetch(`/api/tracker/geofences?id=${id}`, { method: 'DELETE' });
      await loadGeo();
      notify('Geofence deleted');
    } catch { notify('Delete failed', false); }
  };

  // ── Derived ─────────────────────────────────────────────────────

  const trailCoords: [number, number][] = trail.map((p) => [p.lat, p.lon]);
  const mapCenter: [number, number] = trail.length > 0
    ? [trail[trail.length - 1].lat, trail[trail.length - 1].lon]
    : [30.0444, 31.2357];

  const fenceCircles: CircleOverlay[] = [
    ...geofences.map((g) => ({
      center: [g.lat, g.lon] as [number, number],
      radiusMeters: g.radiusMeters,
      color: g.isActive ? '#60C10F' : '#888',
      label: `${g.name} (${g.radiusMeters}m)`,
    })),
    ...(fenceCenter ? [{
      center: fenceCenter,
      radiusMeters: Number(fenceRadius) || 200,
      color: '#F59E0B',
      label: fenceName || 'New geofence',
    }] : []),
  ];

  // ── Tabs config ─────────────────────────────────────────────────

  const tabs = [
    { id: 'stats', label: 'Daily Stats', icon: BarChart3 },
    { id: 'history', label: 'Trail Map', icon: Navigation },
    { id: 'geofences', label: 'Geofences', icon: Shield },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-down" style={{ animation: 'slideDown 0.3s ease' }}>
          <div className={`px-5 py-3 rounded-2xl shadow-xl font-bold text-sm backdrop-blur-lg ${
            toast.ok ? 'bg-emerald-500/95 text-white' : 'bg-red-500/95 text-white'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Location Intelligence
              </h1>
              {/* Device selector */}
              <div className="relative mt-1">
                <button
                  onClick={() => setShowDevicePicker(!showDevicePicker)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 font-medium hover:text-[#014CB3] transition-colors"
                >
                  <Radio className="w-3 h-3" />
                  Device: <span className="text-[#014CB3] font-bold">{selectedDevice || 'None'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDevicePicker ? 'rotate-180' : ''}`} />
                </button>
                {showDevicePicker && (
                  <div className="absolute top-6 left-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[200px] py-1">
                    {devicesLoading ? (
                      <p className="px-4 py-2 text-xs text-gray-400">Loading devices...</p>
                    ) : devices.length === 0 ? (
                      <p className="px-4 py-2 text-xs text-gray-400">No GPS devices found</p>
                    ) : devices.map((dev) => (
                      <button
                        key={dev.id}
                        onClick={() => { setSelectedDevice(dev.serialNumber || dev.id); setShowDevicePicker(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-blue-50 transition-colors ${
                          (dev.serialNumber || dev.id) === selectedDevice ? 'text-[#014CB3] font-bold bg-blue-50/50' : 'text-gray-600'
                        }`}
                      >
                        <span className="font-bold">{dev.label || dev.serialNumber}</span>
                        <span className="text-gray-300 ml-1.5">{dev.serialNumber}</span>
                        {dev.status === 'ACTIVE' && <span className="ml-2 text-emerald-500">●</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#014CB3]/20 focus:border-[#014CB3]"
              />
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-white text-[#014CB3] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">

        {/* ══════════════════════════════════════════════════════════
            TAB: DAILY STATS
           ══════════════════════════════════════════════════════════ */}
        {activeTab === 'stats' && (
          <div>
            {statsLoading ? (
              <LoadingState label="Loading statistics..." />
            ) : !stats || stats.totalPoints === 0 ? (
              <EmptyState icon={MapPin} title="No data for this day" subtitle="Select a different date or wait for the device to report." />
            ) : (
              <div className="space-y-5">
                {/* Hero stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={Navigation} label="Distance" value={`${stats.totalDistanceKm} km`} color="#014CB3" />
                  <StatCard icon={Clock} label="Active time" value={`${stats.activeMinutes} min`} color="#60C10F" />
                  <StatCard icon={Zap} label="Avg speed" value={`${stats.avgSpeedKmh} km/h`} color="#8B5CF6" />
                  <StatCard icon={MapPin} label="Total points" value={String(stats.totalPoints)} color="#F59E0B" />
                </div>

                {/* Detail grid */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Day Overview</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-50">
                    <DetailCell icon={<Clock className="w-3.5 h-3.5 text-emerald-500" />} label="First seen" value={fmtTime(stats.firstSeen)} />
                    <DetailCell icon={<Clock className="w-3.5 h-3.5 text-blue-500" />} label="Last seen" value={fmtTime(stats.lastSeen)} />
                    <DetailCell icon={<TrendingUp className="w-3.5 h-3.5 text-purple-500" />} label="Max speed" value={`${stats.maxSpeedKmh} km/h`} />
                    <DetailCell icon={<Battery className="w-3.5 h-3.5 text-amber-500" />} label="Avg battery" value={stats.avgBattery !== null ? `${stats.avgBattery}%` : '—'} />
                    <DetailCell icon={<Battery className="w-3.5 h-3.5 text-red-500" />} label="Min battery" value={stats.minBattery !== null ? `${stats.minBattery}%` : '—'} />
                    <DetailCell icon={<AlertCircle className="w-3.5 h-3.5 text-red-500" />} label="Fall alerts" value={String(stats.alertCount?.fall || 0)} />
                  </div>
                </div>

                {/* Week chart */}
                {stats.weekSummary && stats.weekSummary.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-4">Last 7 Days</p>
                    <WeekChart data={stats.weekSummary} selectedDate={selectedDate} onSelect={setSelectedDate} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: TRAIL MAP
           ══════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {trailLoading ? (
              <LoadingState label="Loading trail data..." />
            ) : trail.length < 2 ? (
              <EmptyState icon={Navigation} title="No trail for this day" subtitle="Needs at least 2 GPS points to draw a trail." />
            ) : (
              <>
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg" style={{ height: '420px' }}>
                  <DynamicMap
                    center={mapCenter}
                    markers={[{ position: mapCenter, label: 'Last location', live: true }]}
                    trail={trailCoords}
                    zoom={14}
                    scrollWheelZoom={true}
                    showControls={true}
                    animate={false}
                  />
                </div>

                {/* Trail points list */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Trail Points</p>
                    <span className="text-xs font-bold text-gray-400">{trail.length} points</span>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-50">
                    {trail.slice(0, 80).map((pt, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pt.alertType === 'fall' ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className="text-[11px] text-gray-400 font-mono flex-shrink-0 w-[70px]">
                          {new Date(pt.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono truncate">
                          {pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}
                        </span>
                        {pt.battery !== undefined && (
                          <span className={`text-[11px] font-bold ml-auto flex-shrink-0 ${pt.battery <= 20 ? 'text-red-500' : 'text-emerald-500'}`}>
                            🔋 {pt.battery}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: GEOFENCES
           ══════════════════════════════════════════════════════════ */}
        {activeTab === 'geofences' && (
          <div className="space-y-4">

            {/* Map with all geofences + click to place */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg" style={{ height: showCreate ? '320px' : '260px' }}>
              <DynamicMap
                center={fenceCenter || mapCenter}
                markers={fenceCenter ? [{ position: fenceCenter, label: fenceName || 'New geofence' }] : []}
                zoom={13}
                scrollWheelZoom={true}
                showControls={true}
                circles={fenceCircles}
                onMapClick={showCreate ? (lat, lon) => setFenceCenter([lat, lon]) : undefined}
              />
            </div>

            {/* Create button */}
            <button
              onClick={() => { setShowCreate(!showCreate); if (showCreate) setFenceCenter(null); }}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 ${
                showCreate
                  ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  : 'bg-gradient-to-r from-[#014CB3] to-[#60C10F] text-white shadow-lg hover:shadow-xl hover:scale-[1.01]'
              }`}
            >
              <Plus className="w-4 h-4" />
              {showCreate ? 'Cancel' : 'Create New Geofence'}
            </button>

            {/* Create form */}
            {showCreate && (
              <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#014CB3]" />
                  <p className="font-black text-sm text-gray-800">New Geofence</p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 font-medium leading-relaxed">
                  👆 <strong>Click on the map above</strong> to set the geofence center point. A yellow circle will appear showing the boundary.
                </div>

                {fenceCenter && (
                  <p className="text-xs font-mono text-gray-400">
                    📍 Center: {fenceCenter[0].toFixed(5)}, {fenceCenter[1].toFixed(5)}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Home, School, Office..."
                      value={fenceName}
                      onChange={(e) => setFenceName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 font-medium placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#014CB3]/20 focus:border-[#014CB3]"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Radius (meters)</span>
                    <input
                      type="number"
                      placeholder="200"
                      value={fenceRadius}
                      onChange={(e) => setFenceRadius(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 font-medium placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#014CB3]/20 focus:border-[#014CB3]"
                    />
                  </label>
                </div>

                <div className="flex gap-3">
                  <ToggleButton label="Alert on enter" active={alertEnter} onClick={() => setAlertEnter(!alertEnter)} />
                  <ToggleButton label="Alert on exit" active={alertExit} onClick={() => setAlertExit(!alertExit)} />
                </div>

                <button
                  onClick={createFence}
                  disabled={saving || !fenceCenter}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-[#014CB3] text-white hover:bg-[#014CB3]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {saving ? 'Saving...' : '✓ Save Geofence'}
                </button>
              </div>
            )}

            {/* Geofences list */}
            {geoLoading ? (
              <LoadingState label="Loading geofences..." />
            ) : geofences.length === 0 && !showCreate ? (
              <EmptyState icon={Shield} title="No geofences yet" subtitle="Create a virtual boundary to receive alerts when the device enters or leaves an area." />
            ) : (
              <div className="space-y-3">
                {geofences.map((f) => (
                  <div key={f.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    f.isActive ? 'border-emerald-200' : 'border-gray-100 opacity-70'
                  }`}>
                    <div className="p-4 flex items-start gap-3">
                      {/* Status dot */}
                      <div className="mt-1 flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full ${
                          f.isActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(96,193,15,0.4)]' : 'bg-gray-300'
                        }`} style={f.isActive ? { animation: 'pulse 2.5s ease-in-out infinite' } : {}} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-gray-800 truncate">{f.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {f.lat.toFixed(5)}, {f.lon.toFixed(5)} · {f.radiusMeters}m radius
                        </p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {f.alertOnEnter && <Badge text="📍 Enter" color="emerald" />}
                          {f.alertOnExit && <Badge text="🚪 Exit" color="red" />}
                          {f.lastState && f.lastState !== 'unknown' && (
                            <Badge
                              text={f.lastState === 'inside' ? '✓ Inside' : '○ Outside'}
                              color={f.lastState === 'inside' ? 'blue' : 'gray'}
                            />
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleFence(f)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                            f.isActive
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {f.isActive ? <><Eye className="w-3 h-3 inline mr-1" />On</> : <><EyeOff className="w-3 h-3 inline mr-1" />Off</>}
                        </button>
                        <button
                          onClick={() => deleteFence(f.id)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />Del
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideDown { from { transform:translateX(-50%) translateY(-16px); opacity:0; } to { transform:translateX(-50%) translateY(0); opacity:1; } }
      `}</style>
    </div>
  );
}

// ── Sub Components ────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}12` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{label}</p>
      <p className="text-lg sm:text-xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

function DetailCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-black text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
        active
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-gray-50 text-gray-400'
      }`}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    red: 'bg-red-50 text-red-500 border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    gray: 'bg-gray-50 text-gray-500 border-gray-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorMap[color] || colorMap.gray}`}>
      {text}
    </span>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-300">
      <Activity className="w-8 h-8 mb-3 animate-spin" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-200" />
      </div>
      <p className="text-sm font-bold text-gray-400">{title}</p>
      <p className="text-xs text-gray-300 mt-1.5 max-w-xs">{subtitle}</p>
    </div>
  );
}

function WeekChart({ data, selectedDate, onSelect }: { data: { date: string; distanceKm: number; points: number }[]; selectedDate: string; onSelect: (d: string) => void }) {
  const maxDist = Math.max(...data.map((d) => d.distanceKm), 0.1);
  const sorted = [...data].reverse();

  return (
    <div className="flex gap-2 items-end" style={{ height: '120px' }}>
      {sorted.map((day) => {
        const pct = Math.max((day.distanceKm / maxDist) * 90, day.points > 0 ? 8 : 2);
        const sel = day.date === selectedDate;
        return (
          <button
            key={day.date}
            onClick={() => onSelect(day.date)}
            className="flex-1 flex flex-col items-center gap-1 group"
          >
            <span className={`text-[9px] font-bold transition-colors ${sel ? 'text-[#014CB3]' : 'text-gray-300 group-hover:text-gray-400'}`}>
              {day.distanceKm > 0 ? `${day.distanceKm}` : ''}
            </span>
            <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
              <div
                className={`w-full rounded-lg transition-all duration-200 ${
                  sel
                    ? 'bg-gradient-to-t from-[#014CB3] to-[#60C10F]'
                    : 'bg-gray-100 group-hover:bg-gray-200'
                }`}
                style={{ height: `${pct}%`, minHeight: '3px' }}
              />
            </div>
            <span className={`text-[9px] font-bold ${sel ? 'text-[#014CB3]' : 'text-gray-300'}`}>
              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
