'use client';

/**
 * /tracking/history
 * ─────────────────────────────────────────────────────────────────
 * Location History + Daily Stats + Geofencing management page.
 * Premium mobile-first design.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, BarChart3, Shield, Plus, Trash2, ToggleLeft, ToggleRight,
  Clock, Navigation, Zap, Battery, Activity, ChevronDown, ChevronUp,
  Calendar, TrendingUp, AlertCircle, CheckCircle2, X
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
  alertType?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' });
}

const DEVICE_ID = 'colota01'; // TODO: make dynamic from URL param or device picker

// ── Component ─────────────────────────────────────────────────────

export default function TrackingHistoryPage() {
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'geofences'>('stats');
  const [stats, setStats] = useState<DayStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showCreateFence, setShowCreateFence] = useState(false);
  const [newFence, setNewFence] = useState({ name: '', lat: '', lon: '', radiusMeters: '200', alertOnEnter: true, alertOnExit: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load Stats ────────────────────────────────────────────────

  const loadStats = useCallback(async (date: string) => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/tracker/stats?device_id=${DEVICE_ID}&date=${date}`);
      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(selectedDate); }, [selectedDate, loadStats]);

  // ── Load Trail ─────────────────────────────────────────────────

  const loadTrail = useCallback(async (date: string) => {
    setTrailLoading(true);
    try {
      const from = `${date}T00:00:00.000Z`;
      const to   = `${date}T23:59:59.999Z`;
      const res = await fetch(`/api/tracker/history?device_id=${DEVICE_ID}&from=${from}&to=${to}&limit=2000`);
      const data = await res.json();
      setTrail(Array.isArray(data.trail) ? data.trail : []);
    } catch {
      setTrail([]);
    } finally {
      setTrailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadTrail(selectedDate);
  }, [activeTab, selectedDate, loadTrail]);

  // ── Load Geofences ─────────────────────────────────────────────

  const loadGeofences = useCallback(async () => {
    setGeoLoading(true);
    try {
      const res = await fetch(`/api/tracker/geofences?device_id=${DEVICE_ID}`);
      const data = await res.json();
      setGeofences(Array.isArray(data.geofences) ? data.geofences : []);
    } catch {
      setGeofences([]);
    } finally {
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'geofences') loadGeofences();
  }, [activeTab, loadGeofences]);

  // ── Create Geofence ────────────────────────────────────────────

  const handleCreateFence = async () => {
    if (!newFence.name.trim() || !newFence.lat || !newFence.lon) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/tracker/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: DEVICE_ID,
          name: newFence.name.trim(),
          lat: Number(newFence.lat),
          lon: Number(newFence.lon),
          radiusMeters: Number(newFence.radiusMeters),
          alertOnEnter: newFence.alertOnEnter,
          alertOnExit: newFence.alertOnExit,
        }),
      });
      if (!res.ok) throw new Error();
      setNewFence({ name: '', lat: '', lon: '', radiusMeters: '200', alertOnEnter: true, alertOnExit: true });
      setShowCreateFence(false);
      await loadGeofences();
      showToast('تم إنشاء النطاق الجغرافي بنجاح ✅');
    } catch {
      showToast('فشل إنشاء النطاق الجغرافي', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFence = async (fence: Geofence) => {
    try {
      const res = await fetch(`/api/tracker/geofences?id=${fence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !fence.isActive }),
      });
      if (!res.ok) throw new Error();
      await loadGeofences();
      showToast(fence.isActive ? 'تم تعطيل النطاق' : 'تم تفعيل النطاق');
    } catch {
      showToast('فشل تحديث النطاق', 'error');
    }
  };

  const handleDeleteFence = async (id: string) => {
    if (!confirm('هل تريد حذف هذا النطاق الجغرافي؟')) return;
    try {
      const res = await fetch(`/api/tracker/geofences?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await loadGeofences();
      showToast('تم حذف النطاق بنجاح');
    } catch {
      showToast('فشل حذف النطاق', 'error');
    }
  };

  // ── Trail map points ───────────────────────────────────────────

  const trailCoords: [number, number][] = trail.map((p) => [p.lat, p.lon]);
  const mapCenter: [number, number] = trail.length > 0
    ? [trail[trail.length - 1].lat, trail[trail.length - 1].lon]
    : [30.0444, 31.2357];

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #0a1628 100%)', color: '#fff', fontFamily: "'Inter', sans-serif", direction: 'rtl' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '16px', right: '50%', transform: 'translateX(50%)',
          zIndex: 9999, padding: '12px 24px', borderRadius: '14px', fontWeight: 700,
          background: toast.type === 'success' ? 'rgba(96,193,15,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', fontSize: '14px',
          animation: 'slideDown 0.3s ease'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(1,76,179,0.3), rgba(96,193,15,0.15))', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 20px 16px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #014CB3, #60C10F)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0 }}>سجل التتبع والنطاقات</h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>جهاز: {DEVICE_ID}</p>
            </div>
          </div>

          {/* Date picker */}
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar style={{ width: '14px', height: '14px', color: '#60C10F' }} />
            <input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '6px 12px', color: '#fff', fontSize: '13px', fontFamily: 'inherit', direction: 'ltr' }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: '8px', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'stats', label: 'إحصاءات يومية', icon: BarChart3 },
            { id: 'history', label: 'مسار التنقل', icon: Navigation },
            { id: 'geofences', label: 'النطاقات الجغرافية', icon: Shield },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                background: activeTab === id ? 'linear-gradient(135deg, #014CB3, #60C10F)' : 'rgba(255,255,255,0.06)',
                color: activeTab === id ? '#fff' : 'rgba(255,255,255,0.5)',
                fontWeight: activeTab === id ? 800 : 500,
                fontSize: '11px', transition: 'all 0.2s',
              }}
            >
              <Icon style={{ width: '16px', height: '16px' }} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Daily Stats ───────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div style={{ paddingTop: '20px', paddingBottom: '40px' }}>
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)' }}>
                <Activity style={{ width: '32px', height: '32px', margin: '0 auto 12px', animation: 'pulse 1.5s infinite' }} />
                <p>جاري تحميل الإحصاءات...</p>
              </div>
            ) : !stats || stats.totalPoints === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <MapPin style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: 'rgba(255,255,255,0.2)' }} />
                <p style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>لا توجد بيانات لهذا اليوم</p>
              </div>
            ) : (
              <>
                {/* Main Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <StatCard icon={<Navigation style={{ width: '18px', height: '18px' }} />} label="المسافة" value={`${stats.totalDistanceKm} km`} color="#014CB3" />
                  <StatCard icon={<Clock style={{ width: '18px', height: '18px' }} />} label="وقت النشاط" value={`${stats.activeMinutes} دقيقة`} color="#60C10F" />
                  <StatCard icon={<Zap style={{ width: '18px', height: '18px' }} />} label="متوسط السرعة" value={`${stats.avgSpeedKmh} km/h`} color="#8B5CF6" />
                  <StatCard icon={<MapPin style={{ width: '18px', height: '18px' }} />} label="إجمالي النقاط" value={`${stats.totalPoints}`} color="#F59E0B" />
                </div>

                {/* Battery and Time */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>تفاصيل اليوم</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <InfoRow icon={<Clock style={{ width: '14px', height: '14px', color: '#60C10F' }} />} label="أول ظهور" value={fmtTime(stats.firstSeen)} />
                    <InfoRow icon={<Clock style={{ width: '14px', height: '14px', color: '#014CB3' }} />} label="آخر ظهور" value={fmtTime(stats.lastSeen)} />
                    <InfoRow icon={<Battery style={{ width: '14px', height: '14px', color: '#F59E0B' }} />} label="متوسط البطارية" value={stats.avgBattery !== null ? `${stats.avgBattery}%` : '—'} />
                    <InfoRow icon={<Battery style={{ width: '14px', height: '14px', color: '#EF4444' }} />} label="أدنى بطارية" value={stats.minBattery !== null ? `${stats.minBattery}%` : '—'} />
                    <InfoRow icon={<TrendingUp style={{ width: '14px', height: '14px', color: '#8B5CF6' }} />} label="أقصى سرعة" value={`${stats.maxSpeedKmh} km/h`} />
                    <InfoRow icon={<AlertCircle style={{ width: '14px', height: '14px', color: '#EF4444' }} />} label="تنبيهات السقوط" value={`${stats.alertCount?.fall || 0}`} />
                  </div>
                </div>

                {/* Weekly Bar Chart */}
                {stats.weekSummary && stats.weekSummary.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>آخر 7 أيام</p>
                    <WeekChart data={stats.weekSummary} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab: History Map ────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div style={{ paddingTop: '20px', paddingBottom: '40px' }}>
            {trailLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)' }}>
                <Navigation style={{ width: '32px', height: '32px', margin: '0 auto 12px', animation: 'pulse 1.5s infinite' }} />
                <p>جاري تحميل مسار التنقل...</p>
              </div>
            ) : trail.length < 2 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <MapPin style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: 'rgba(255,255,255,0.2)' }} />
                <p style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>لا يوجد مسار لهذا اليوم</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '8px' }}>يحتاج إلى نقطتين على الأقل لرسم المسار</p>
              </div>
            ) : (
              <>
                <div style={{ borderRadius: '20px', overflow: 'hidden', height: '380px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <DynamicMap
                    center={mapCenter}
                    markers={[{ position: mapCenter, label: 'آخر موقع', live: true }]}
                    trail={trailCoords}
                    zoom={14}
                    scrollWheelZoom={true}
                    showControls={true}
                    animate={false}
                  />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>نقاط المسار ({trail.length})</p>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {trail.slice(0, 50).map((pt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: pt.alertType === 'fall' ? '#EF4444' : '#60C10F' }} />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', flexShrink: 0 }}>{new Date(pt.recordedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}</span>
                        {pt.battery !== undefined && (
                          <span style={{ fontSize: '11px', color: pt.battery <= 20 ? '#EF4444' : '#60C10F', fontWeight: 700, marginRight: 'auto' }}>🔋{pt.battery}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Geofences ─────────────────────────────────────────── */}
        {activeTab === 'geofences' && (
          <div style={{ paddingTop: '20px', paddingBottom: '40px' }}>
            {/* Create button */}
            <button
              onClick={() => setShowCreateFence(!showCreateFence)}
              style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px dashed rgba(96,193,15,0.4)', background: 'rgba(96,193,15,0.06)', color: '#60C10F', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '16px', transition: 'all 0.2s' }}
            >
              <Plus style={{ width: '18px', height: '18px' }} />
              {showCreateFence ? 'إلغاء' : 'إنشاء نطاق جغرافي جديد'}
            </button>

            {/* Create form */}
            {showCreateFence && (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '18px', border: '1px solid rgba(96,193,15,0.2)', padding: '20px', marginBottom: '20px' }}>
                <p style={{ fontWeight: 800, fontSize: '15px', marginBottom: '16px', color: '#60C10F' }}>🛡️ نطاق جغرافي جديد</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <FenceInput label="اسم النطاق" placeholder="مثال: المنزل، المدرسة..." value={newFence.name} onChange={(v) => setNewFence({ ...newFence, name: v })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <FenceInput label="خط العرض (Lat)" placeholder="30.0444" value={newFence.lat} onChange={(v) => setNewFence({ ...newFence, lat: v })} type="number" />
                    <FenceInput label="خط الطول (Lon)" placeholder="31.2357" value={newFence.lon} onChange={(v) => setNewFence({ ...newFence, lon: v })} type="number" />
                  </div>
                  <FenceInput label="نصف القطر (متر)" placeholder="200" value={newFence.radiusMeters} onChange={(v) => setNewFence({ ...newFence, radiusMeters: v })} type="number" />

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <ToggleField label="تنبيه عند الدخول" value={newFence.alertOnEnter} onChange={(v) => setNewFence({ ...newFence, alertOnEnter: v })} />
                    <ToggleField label="تنبيه عند الخروج" value={newFence.alertOnExit} onChange={(v) => setNewFence({ ...newFence, alertOnExit: v })} />
                  </div>

                  <button
                    onClick={handleCreateFence}
                    disabled={saving}
                    style={{ padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #014CB3, #60C10F)', color: '#fff', fontWeight: 800, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'جاري الحفظ...' : '✅ حفظ النطاق'}
                  </button>
                </div>
              </div>
            )}

            {/* Geofences list */}
            {geoLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
                <Shield style={{ width: '28px', height: '28px', margin: '0 auto 12px', animation: 'pulse 1.5s infinite' }} />
                <p>جاري التحميل...</p>
              </div>
            ) : geofences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Shield style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: 'rgba(255,255,255,0.2)' }} />
                <p style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>لا توجد نطاقات جغرافية بعد</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '8px' }}>أنشئ نطاقاً لتلقي تنبيهات عند الدخول أو الخروج منه</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {geofences.map((fence) => (
                  <div key={fence.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '18px', border: `1px solid ${fence.isActive ? 'rgba(96,193,15,0.25)' : 'rgba(255,255,255,0.08)'}`, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: fence.isActive ? '#60C10F' : 'rgba(255,255,255,0.3)', flexShrink: 0, ...(fence.isActive ? { animation: 'pulse 2s infinite' } : {}) }} />
                          <p style={{ fontWeight: 800, fontSize: '15px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fence.name}</p>
                        </div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '0 0 8px', fontFamily: 'monospace' }}>
                          {fence.lat.toFixed(5)}, {fence.lon.toFixed(5)} • نصف القطر: {fence.radiusMeters}م
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {fence.alertOnEnter && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(96,193,15,0.15)', color: '#60C10F', border: '1px solid rgba(96,193,15,0.3)', fontWeight: 700 }}>📍 تنبيه عند الدخول</span>}
                          {fence.alertOnExit && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700 }}>🚪 تنبيه عند الخروج</span>}
                          {fence.lastState && fence.lastState !== 'unknown' && (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: fence.lastState === 'inside' ? 'rgba(96,193,15,0.2)' : 'rgba(255,255,255,0.08)', color: fence.lastState === 'inside' ? '#60C10F' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                              {fence.lastState === 'inside' ? '✅ داخل النطاق' : '⭕ خارج النطاق'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleToggleFence(fence)}
                          style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: fence.isActive ? 'rgba(96,193,15,0.15)' : 'rgba(255,255,255,0.08)', color: fence.isActive ? '#60C10F' : 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 700 }}
                        >
                          {fence.isActive ? '✅ مفعّل' : '⏸ معطّل'}
                        </button>
                        <button
                          onClick={() => handleDeleteFence(fence.id)}
                          style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#F87171', fontSize: '12px', fontWeight: 700 }}
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideDown { from { transform:translateY(-20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 900, margin: 0, color }}>{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <div>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: '13px', fontWeight: 800, margin: 0 }}>{value}</p>
      </div>
    </div>
  );
}

function FenceInput({ label, placeholder, value, onChange, type = 'text' }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 12px', color: '#fff', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', direction: type === 'number' ? 'ltr' : 'rtl' }}
      />
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${value ? 'rgba(96,193,15,0.3)' : 'rgba(255,255,255,0.1)'}`, background: value ? 'rgba(96,193,15,0.1)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: value ? '#60C10F' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: '12px' }}
    >
      {value ? <ToggleRight style={{ width: '16px', height: '16px' }} /> : <ToggleLeft style={{ width: '16px', height: '16px' }} />}
      {label}
    </button>
  );
}

function WeekChart({ data, selectedDate, onSelectDate }: { data: { date: string; distanceKm: number; points: number; activeMinutes: number }[]; selectedDate: string; onSelectDate: (d: string) => void }) {
  const maxDist = Math.max(...data.map((d) => d.distanceKm), 0.1);
  const sorted = [...data].reverse();

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '100px' }}>
      {sorted.map((day) => {
        const height = Math.max((day.distanceKm / maxDist) * 80, day.points > 0 ? 6 : 0);
        const isSelected = day.date === selectedDate;
        return (
          <div
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          >
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '80px' }}>
              <div style={{ width: '100%', height: `${height}px`, borderRadius: '6px 6px 0 0', background: isSelected ? 'linear-gradient(180deg,#60C10F,#014CB3)' : 'rgba(255,255,255,0.15)', transition: 'all 0.2s' }} />
            </div>
            <p style={{ fontSize: '9px', color: isSelected ? '#60C10F' : 'rgba(255,255,255,0.3)', margin: 0, fontWeight: isSelected ? 800 : 500 }}>
              {new Date(day.date + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'narrow' })}
            </p>
          </div>
        );
      })}
    </div>
  );
}
