'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserCircle2
} from 'lucide-react';

/* ────────────────────────────────────────── Types ────────────────────────────────────── */

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
  emergencyContacts: Array<{ id?: string; contactName: string; relation?: string; phone: string }>;
  createdAt: string;
  updatedAt: string;
};

type GpsStatus = 'idle' | 'requesting' | 'success' | 'denied' | 'error';
type ReportStatus = 'idle' | 'sending' | 'sent' | 'error';

/* ────────────────────────────────────── Constants ────────────────────────────────────── */

const PERSON_CATEGORIES = new Set(['child', 'adult', 'elderly', 'person', 'pet']);

function isPersonProfile(category?: string | null): boolean {
  if (!category) return true;
  return PERSON_CATEGORIES.has(category.trim().toLowerCase());
}

/* ────────────────────────────────────── Lazy Map ─────────────────────────────────────── */

const MapClient = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/10" />
});

/* ────────────────────────────────────── Component ────────────────────────────────────── */

export default function PublicIdentifyPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [item, setItem] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // GPS + report state
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle');

  /* ─── Load profile ─── */
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
          headers: { Accept: 'application/json' }
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
            setError('The identification page took too long to load. Please try again.');
          } else {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load this identification page.');
          }
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [resolvedParams.token]);

  /* ─── Submit found report with GPS ─── */
  const submitFoundReport = useCallback(async (latitude: number, longitude: number) => {
    if (reportStatus === 'sent' || reportStatus === 'sending') return;
    setReportStatus('sending');
    try {
      await fetch(`/api/public/identify/${encodeURIComponent(resolvedParams.token)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finderLatitude: latitude, finderLongitude: longitude })
      });
      setReportStatus('sent');
    } catch {
      setReportStatus('error');
    }
  }, [resolvedParams.token, reportStatus]);

  /* ─── Auto GPS capture on mount ─── */
  useEffect(() => {
    if (!item || gpsStatus !== 'idle') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      // Still send a report without GPS
      void submitFoundReport(0, 0);
      return;
    }

    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsStatus('success');
        void submitFoundReport(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setGpsStatus('denied');
        // Send report without GPS so the owner still gets notified
        void fetch(`/api/public/identify/${encodeURIComponent(resolvedParams.token)}/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }).then(() => setReportStatus('sent')).catch(() => setReportStatus('error'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [item, gpsStatus, resolvedParams.token, submitFoundReport]);

  /* ─── Derived state ─── */
  useEffect(() => { setImageFailed(false); setShowMap(false); }, [item?.photoUrl]);

  const isPerson = useMemo(() => isPersonProfile(item?.category), [item?.category]);
  const primaryContact = item?.emergencyContacts?.[0];

  const contactLabel = useMemo(() => {
    if (!primaryContact) return '';
    if (isPerson) {
      return primaryContact.relation
        ? `اتصال بـ ${primaryContact.relation} الآن`
        : `اتصال بـ ${primaryContact.contactName} الآن`;
    }
    return `اتصال بـ صاحب ${item?.displayName || 'الشيء'} الآن`;
  }, [isPerson, primaryContact, item?.displayName]);

  const coordinates = useMemo(() => {
    if (item?.latitude === undefined || item?.longitude === undefined) return null;
    return [item.latitude, item.longitude] as [number, number];
  }, [item?.latitude, item?.longitude]);

  /* ─── GPS Status Badge ─── */
  const GpsStatusBadge = () => {
    if (gpsStatus === 'idle') return null;
    const configs: Record<Exclude<GpsStatus, 'idle'>, { icon: React.ReactNode; text: string; className: string }> = {
      requesting: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'جاري تحديد الموقع...', className: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
      success: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: 'تم إرسال الموقع للمالك', className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
      denied: { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'تم إبلاغ المالك (بدون موقع)', className: 'bg-orange-500/20 text-orange-200 border-orange-400/30' },
      error: { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'تم إبلاغ المالك', className: 'bg-orange-500/20 text-orange-200 border-orange-400/30' }
    };
    const config = configs[gpsStatus];
    return (
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}>
        {config.icon}
        <span>{config.text}</span>
      </div>
    );
  };

  /* ─── Render ─── */
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#014CB3] via-[#0d5fcb] to-[#60C10F] px-4 pb-28 pt-6 text-white md:px-8 md:pt-10">
      <div className="mx-auto max-w-3xl">

        {/* ── Header badge ── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            <ShieldCheck className="mr-2 inline-block h-4 w-4" />
            صفحة تعريف آمنة — RETURN
          </div>
          <GpsStatusBadge />
        </div>

        {loading ? (
          <div className="space-y-5">
            <div className="h-[360px] animate-pulse rounded-[2rem] bg-white/10" />
            <div className="h-[200px] animate-pulse rounded-[2rem] bg-white/10" />
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-white/20 bg-white/10 px-6 py-10 text-center shadow-2xl backdrop-blur">
            <h1 className="text-3xl font-black">الصفحة غير متاحة</h1>
            <p className="mt-4 text-white/80">{error}</p>
            <Link href="/" className="mt-6 inline-flex rounded-full border border-white/25 bg-white/15 px-5 py-3 font-bold hover:bg-white/20">
              العودة للرئيسية
            </Link>
          </div>
        ) : item ? (
          <div className="space-y-5">

            {/* ── Photo + Name Hero Card ── */}
            <section className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur">
              <div className="overflow-hidden">
                {item.photoUrl && !imageFailed ? (
                  <img
                    src={item.photoUrl}
                    alt={item.displayName}
                    className="h-[280px] w-full object-cover sm:h-[340px]"
                    loading="eager"
                    decoding="async"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="flex h-[240px] w-full items-center justify-center bg-white/5 text-white/50">
                    <UserCircle2 className="h-24 w-24" />
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
                  {isPerson ? 'بيانات التعريف' : 'بيانات الشيء'}
                </p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">{item.displayName}</h1>

                {/* Type + Age badges (person only) */}
                {isPerson && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-bold">
                      {item.category || 'شخص'}
                    </span>
                    {item.age !== undefined && (
                      <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-bold">
                        {item.age} سنة
                      </span>
                    )}
                    {item.bloodType && (
                      <span className="rounded-full border border-red-400/30 bg-red-500/15 px-4 py-1.5 text-sm font-bold text-red-200">
                        فصيلة الدم: {item.bloodType}
                      </span>
                    )}
                  </div>
                )}

                {/* Property description */}
                {!isPerson && item.clothesColor && (
                  <p className="mt-3 text-white/80">{item.clothesColor}</p>
                )}
              </div>
            </section>

            {/* ── Medical Notes Card (person only) ── */}
            {isPerson && item.medicalNotes && (
              <section className="rounded-[2rem] border border-amber-400/30 bg-amber-500/10 p-5 shadow-2xl backdrop-blur sm:p-6">
                <div className="flex items-center gap-3">
                  <Stethoscope className="h-6 w-6 text-amber-300" />
                  <h2 className="text-xl font-black text-amber-100">ملاحظات طبية مهمة</h2>
                </div>
                <p className="mt-4 text-base leading-8 text-amber-50/90">
                  {item.medicalNotes}
                </p>
              </section>
            )}

            {/* ── Thank-you Card (property only) ── */}
            {!isPerson && reportStatus === 'sent' && (
              <section className="rounded-[2rem] border border-emerald-400/30 bg-emerald-500/10 p-5 shadow-2xl backdrop-blur sm:p-6">
                <div className="flex items-center gap-3">
                  <Heart className="h-6 w-6 text-emerald-300" />
                  <h2 className="text-xl font-black text-emerald-100">شكراً لأمانتك</h2>
                </div>
                <p className="mt-4 text-base leading-8 text-emerald-50/90">
                  تم إرسال موقع {item.displayName} لصاحبها بنجاح وجاري قدومه لاستلامها.
                  يمكنك الاتصال مباشرة بالزر أدناه إذا أردت تسليمها يداً بيد.
                </p>
              </section>
            )}

            {/* ── Emergency Contact Card ── */}
            {primaryContact && (
              <section className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">جهة اتصال الطوارئ</p>
                <p className="mt-3 text-2xl font-black">{primaryContact.contactName}</p>
                {primaryContact.relation && (
                  <p className="mt-1 text-white/70">({primaryContact.relation})</p>
                )}
                <p className="mt-3 text-xl font-bold text-[#dcf6c0]" dir="ltr">{primaryContact.phone}</p>

                {/* Inline call button for desktop */}
                <div className="mt-5 hidden md:flex md:gap-3">
                  <a
                    href={`tel:${primaryContact.phone}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-black text-[#014CB3] shadow-lg transition-transform hover:scale-105"
                  >
                    <Phone className="h-5 w-5" />
                    {contactLabel}
                  </a>
                  {coordinates && (
                    <a
                      href={`https://www.google.com/maps?q=${coordinates[0]},${coordinates[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 font-bold hover:bg-white/20"
                    >
                      <Navigation className="h-4 w-4" /> الاتجاهات
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* ── Extra Notes ── */}
            {item.notes && (
              <section className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">ملاحظات إضافية</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/90">{item.notes}</p>
              </section>
            )}

            {/* ── Location Map ── */}
            {coordinates && (
              <section className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5" />
                    <h2 className="text-lg font-black">آخر موقع معروف</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMap((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
                  >
                    <Navigation className="h-4 w-4" /> {showMap ? 'إخفاء الخريطة' : 'عرض الخريطة'}
                  </button>
                </div>
                <div className="h-[260px] sm:h-[320px]">
                  {showMap ? (
                    <MapClient center={coordinates} marker={coordinates} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/75">
                      <p className="max-w-md text-sm leading-7">اضغط لعرض الخريطة التفاعلية بالموقع المسجل.</p>
                      <button
                        type="button"
                        onClick={() => setShowMap(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black text-[#014CB3] shadow-lg"
                      >
                        <MapPin className="h-4 w-4" /> تحميل الخريطة
                      </button>
                    </div>
                  )}
                </div>
                {item.lastLocationText && (
                  <div className="border-t border-white/10 px-5 py-3 text-sm text-white/70 sm:px-6">
                    📍 {item.lastLocationText}
                  </div>
                )}
              </section>
            )}

            {/* ── Safety footer ── */}
            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 text-center text-sm leading-7 text-white/75 shadow-2xl backdrop-blur">
              يتم عرض بيانات التعريف المخصصة لعملية الاسترداد فقط. البيانات الحساسة محمية داخل منصة RETURN.
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Sticky Call Button (mobile) ── */}
      {item && primaryContact?.phone && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-gradient-to-t from-[#014CB3] to-[#014CB3]/95 px-4 py-3 backdrop-blur-lg md:hidden">
          <a
            href={`tel:${primaryContact.phone}`}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-black text-[#014CB3] shadow-xl transition-transform active:scale-[0.98]"
            style={{
              boxShadow: '0 0 0 3px rgba(255,255,255,0.25), 0 8px 30px rgba(1,76,179,0.4)'
            }}
          >
            <Phone className="h-6 w-6" />
            <span>📞 {contactLabel}</span>
          </a>
        </div>
      )}
    </main>
  );
}
