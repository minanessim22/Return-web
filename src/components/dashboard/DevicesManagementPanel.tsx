'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BatteryMedium, Database, MapPin, Plus, Power, QrCode, Radio, RefreshCw, Save, ShieldCheck, SmartphoneCharging, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getHardwareModelLabel } from '@/lib/device-models';
import type { DeviceItem, IdentificationProfile } from '@/lib/shared-types';
import { useTrackerStream } from '@/lib/useTrackerStream';
import { LiveTrackingMap } from '@/components/LiveTrackingMap';
import { TrackingHistoryPanel } from '@/components/tracking/TrackingHistoryPanel';

type DeviceDraft = {
  label: string;
  status: DeviceItem['status'];
  trackingEnabled: boolean;
  updateIntervalMinutes: string;
  linkedProfileId: string;
  lastLocationText: string;
  latitude: string;
  longitude: string;
  batteryLevel: string;
};

type DeviceForm = {
  type: DeviceItem['type'];
  hardwareModel: 'STANDALONE' | 'SMART_TAG_LITE' | 'SMART_TAG_PRO';
  label: string;
  serialNumber: string;
  linkedProfileId: string;
  trackingEnabled: boolean;
  updateIntervalMinutes: string;
  lastLocationText: string;
  latitude: string;
  longitude: string;
};

const deviceStatuses: DeviceItem['status'][] = ['ACTIVE', 'PAUSED', 'DISCONNECTED', 'LOW_BATTERY', 'INACTIVE'];

function emptyForm(): DeviceForm {
  return {
    type: 'NFC',
    hardwareModel: 'SMART_TAG_LITE',
    label: '',
    serialNumber: '',
    linkedProfileId: '',
    trackingEnabled: true,
    updateIntervalMinutes: '5',
    lastLocationText: '',
    latitude: '',
    longitude: ''
  };
}

function toDraft(device: DeviceItem): DeviceDraft {
  return {
    label: device.label,
    status: device.status,
    trackingEnabled: Boolean(device.trackingEnabled),
    updateIntervalMinutes: device.updateIntervalMinutes ? String(device.updateIntervalMinutes) : '5',
    linkedProfileId: device.linkedProfileId || '',
    lastLocationText: device.lastLocationText || '',
    latitude: device.latitude !== undefined ? String(device.latitude) : '',
    longitude: device.longitude !== undefined ? String(device.longitude) : '',
    batteryLevel: device.batteryLevel !== undefined ? String(device.batteryLevel) : ''
  };
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DevicesManagementPanel({ isRTL = false }: { isRTL?: boolean }) {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [profiles, setProfiles] = useState<IdentificationProfile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DeviceDraft>>({});
  const [form, setForm] = useState<DeviceForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [historyDeviceId, setHistoryDeviceId] = useState('');

  useTrackerStream(); // keeps the SSE connection alive for LiveTrackingMap

  const t = useMemo(() => {
    return isRTL
      ? {
          heading: 'الأجهزة المرتبطة',
          subtitle: 'أضف أجهزة GPS و QR و NFC الحقيقية، واربطها بملفات التعريف، وحدّث آخر موقع وحالة كل جهاز من نفس الشاشة. إعدادات Bluetooth و Wi-Fi أصبحت داخل الإعدادات.' ,
          addDevice: 'إضافة جهاز جديد',
          type: 'النوع',
          hardwareModel: 'موديل الهاردوير',
          label: 'اسم الجهاز',
          serial: 'الرقم التسلسلي',
          linkedProfile: 'الملف المرتبط',
          tracking: 'تتبع مباشر',
          interval: 'فترة التحديث بالدقائق',
          lastLocation: 'آخر موقع معروف',
          latitude: 'خط العرض',
          longitude: 'خط الطول',
          create: 'حفظ الجهاز',
          quickTools: 'أدوات سريعة',
          quickToolsBody: 'استخدم صفحات QR و NFC و GPS المتخصصة من هنا، بينما يتم تفعيل Bluetooth و Wi-Fi من شاشة الإعدادات فقط.',
          openQr: 'إنشاء QR',
          openNfc: 'ربط NFC',
          openGps: 'صفحة GPS',
          totalDevices: 'إجمالي الأجهزة',
          activeDevices: 'أجهزة نشطة',
          linkedProfiles: 'ملفات مرتبطة',
          noDevices: 'لا توجد أجهزة بعد',
          noDevicesBody: 'أضف أول جهاز وسيظهر هنا مع حالة الاتصال والموقع والتحديثات.',
          saveChanges: 'حفظ التعديلات',
          pause: 'إيقاف مؤقت',
          activate: 'تفعيل',
          updated: 'آخر تحديث',
          locationHistory: 'عدد نقاط الموقع',
          battery: 'البطارية',
          status: 'الحالة',
          connectedProfile: 'الملف المرتبط',
          none: 'بدون',
          profilePlaceholder: 'اختر ملفًا',
          deviceSaved: 'تم حفظ الجهاز بنجاح.',
          deviceUpdated: 'تم تحديث الجهاز بنجاح.',
          createProfileHint: 'أنشئ ملف تعريف أولاً من صفحة QR أو NFC لو محتاج تربط الجهاز بشخص أو عنصر.',
          activeOnly: 'نشط',
          trackingOn: 'التتبع مفعل',
          trackingOff: 'التتبع متوقف',
          deviceGuideTitle: 'طريقة استخدام كل جهاز',
          deleteDevice: 'حذف الجهاز',
          deleting: 'جارٍ الحذف...',
          turnOff: 'إيقاف الجهاز',
          turnOn: 'تشغيل الجهاز',
          openTool: 'فتح الصفحة',
          databaseRecord: 'مرجع قاعدة البيانات',
          syncedToDatabase: 'محفوظ في قاعدة البيانات',
          historyTitle: 'السجل والسياج الجغرافي',
          historyBody: 'اختر جهاز GPS لعرض المسار التاريخي والموقع الحي والسياج الجغرافي.',
          historySelect: 'اختيار جهاز GPS',
          historySelectPlaceholder: 'اختر جهازًا',
          historyEmpty: 'اختر جهاز GPS لعرض السجل والسياج.',
          historyNoGps: 'لا توجد أجهزة GPS بعد.'
        }
      : {
          heading: 'Connected devices',
          subtitle: 'Register real GPS, QR, and NFC devices, link them to identification profiles, and update the latest known location from one place. Bluetooth and Wi-Fi now live in Settings only.',
          addDevice: 'Add a new device',
          type: 'Type',
          hardwareModel: 'Hardware model',
          label: 'Device label',
          serial: 'Serial number',
          linkedProfile: 'Linked profile',
          tracking: 'Live tracking enabled',
          interval: 'Update interval (minutes)',
          lastLocation: 'Last known location',
          latitude: 'Latitude',
          longitude: 'Longitude',
          create: 'Save device',
          quickTools: 'Quick tools',
          quickToolsBody: 'Use the dedicated QR, NFC, and GPS pages here, while Bluetooth and Wi-Fi are enabled from Settings only.',
          openQr: 'Generate QR',
          openNfc: 'Link NFC',
          openGps: 'Open GPS page',
          totalDevices: 'Total devices',
          activeDevices: 'Active devices',
          linkedProfiles: 'Linked profiles',
          noDevices: 'No devices yet',
          noDevicesBody: 'Add your first device and it will appear here with status, location, and live update controls.',
          saveChanges: 'Save changes',
          pause: 'Pause',
          activate: 'Activate',
          updated: 'Updated',
          locationHistory: 'Location points',
          battery: 'Battery',
          status: 'Status',
          connectedProfile: 'Linked profile',
          none: 'None',
          profilePlaceholder: 'Choose a profile',
          deviceSaved: 'Device saved successfully.',
          deviceUpdated: 'Device updated successfully.',
          createProfileHint: 'Create an identification profile first from the QR or NFC page if you want to attach this device to a person or item.',
          activeOnly: 'Active',
          trackingOn: 'Tracking enabled',
          trackingOff: 'Tracking paused',
          deviceGuideTitle: 'How to use each device',
          deleteDevice: 'Delete device',
          deleting: 'Deleting…',
          turnOff: 'Turn off',
          turnOn: 'Turn on',
          openTool: 'Open page',
          databaseRecord: 'Database record',
          syncedToDatabase: 'Saved to database',
          historyTitle: 'History & Geofencing',
          historyBody: 'Choose a GPS device to review its breadcrumb trail, live location, and geofences.',
          historySelect: 'GPS device',
          historySelectPlaceholder: 'Select a GPS device',
          historyEmpty: 'Select a GPS device to load history and geofencing.',
          historyNoGps: 'No GPS devices available yet.'
        };
  }, [isRTL]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const [devicesResponse, profilesResponse] = await Promise.all([api.devices(), api.identificationProfiles()]);
      setDevices(devicesResponse.items);
      setProfiles(profilesResponse.items);
      setDrafts((current) => {
        const next: Record<string, DeviceDraft> = {};
        for (const device of devicesResponse.items) {
          next[device.id] = current[device.id] || toDraft(device);
        }
        return next;
      });
      if (!options?.silent) {
        setError('');
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load devices.';
      if (!options?.silent || devices.length === 0) {
        setError(message);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [devices.length]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const linkedProfilesCount = useMemo(() => devices.filter((item) => item.linkedProfileId).length, [devices]);
  const activeDevicesCount = useMemo(() => devices.filter((item) => item.status === 'ACTIVE').length, [devices]);
  const gpsCapableDevices = useMemo(() => devices.filter((device) => device.type === 'GPS' || device.supportsGps), [devices]);
  const selectedHistoryDevice = useMemo(() => gpsCapableDevices.find((device) => device.serialNumber === historyDeviceId) ?? null, [gpsCapableDevices, historyDeviceId]);

  useEffect(() => {
    if (historyDeviceId && !gpsCapableDevices.some((device) => device.serialNumber === historyDeviceId)) {
      setHistoryDeviceId('');
    }
  }, [gpsCapableDevices, historyDeviceId]);



  const handleCreateDevice = async () => {
    if (!form.label.trim()) {
      setError(isRTL ? 'اكتب اسم الجهاز أولاً.' : 'Please provide a device label first.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.createDevice({
        type: form.type,
        hardwareModel: form.hardwareModel,
        label: form.label,
        serialNumber: form.serialNumber || undefined,
        linkedProfileId: form.linkedProfileId || undefined,
        trackingEnabled: form.trackingEnabled,
        updateIntervalMinutes: toOptionalNumber(form.updateIntervalMinutes),
        lastLocationText: form.lastLocationText || undefined,
        latitude: toOptionalNumber(form.latitude),
        longitude: toOptionalNumber(form.longitude)
      });
      setForm(emptyForm());
      setMessage(t.deviceSaved);
      await loadData({ silent: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this device.');
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (deviceId: string, patch: Partial<DeviceDraft>) => {
    setDrafts((current) => ({
      ...current,
      [deviceId]: {
        ...(current[deviceId] || toDraft(devices.find((item) => item.id === deviceId) as DeviceItem)),
        ...patch
      }
    }));
  };

  const handleSaveDevice = async (deviceId: string, patch?: Partial<DeviceDraft>) => {
    const draft = { ...(drafts[deviceId] || toDraft(devices.find((item) => item.id === deviceId) as DeviceItem)), ...(patch || {}) };
    setSavingId(deviceId);
    setError('');
    setMessage('');
    try {
      await api.updateDevice(deviceId, {
        label: draft.label,
        status: draft.status,
        trackingEnabled: draft.trackingEnabled,
        updateIntervalMinutes: toOptionalNumber(draft.updateIntervalMinutes),
        linkedProfileId: draft.linkedProfileId || null,
        lastLocationText: draft.lastLocationText,
        latitude: toOptionalNumber(draft.latitude),
        longitude: toOptionalNumber(draft.longitude),
        batteryLevel: toOptionalNumber(draft.batteryLevel)
      });
      setMessage(t.deviceUpdated);
      await loadData({ silent: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this device.');
    } finally {
      setSavingId(null);
    }
  };


  const handleDeleteDevice = async (deviceId: string, label: string) => {
    const confirmed = typeof window === 'undefined' ? true : window.confirm(isRTL ? `هل تريد حذف الجهاز ${label}؟` : `Delete ${label}?`);
    if (!confirmed) return;

    setDeletingId(deviceId);
    setError('');
    setMessage('');
    try {
      await api.deleteDevice(deviceId);
      setDevices((current) => current.filter((item) => item.id !== deviceId));
      setMessage(isRTL ? 'تم حذف الجهاز.' : 'Device deleted successfully.');
      await loadData({ silent: true });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this device.');
    } finally {
      setDeletingId(null);
    }
  };

  const openDeviceTool = (device: DeviceItem) => {
    if (device.type === 'GPS') {
      router.push(`/gps?deviceId=${device.id}`);
      return;
    }
    if (device.type === 'QR') {
      router.push('/qr');
      return;
    }
    router.push('/nfc');
  };

  const quickCards = [
    {
      title: 'QR',
      body: t.openQr,
      icon: <QrCode className="w-7 h-7" />,
      action: () => router.push('/qr')
    },
    {
      title: 'NFC',
      body: t.openNfc,
      icon: <SmartphoneCharging className="w-7 h-7" />,
      action: () => router.push('/nfc')
    },
    {
      title: 'GPS',
      body: t.openGps,
      icon: <MapPin className="w-7 h-7" />,
      action: () => router.push('/gps')
    }
  ];

  const devicePurpose = (type: DeviceItem['type']) => {
    if (type === 'GPS') {
      return isRTL
        ? 'جهاز تتبع حي يرسل آخر موقع والبطارية ويُستخدم عندما تريد متابعة الحركة على الخريطة.'
        : 'Live tracker that sends the latest location, battery level, and interval updates for map-based recovery.';
    }
    if (type === 'QR') {
      return isRTL
        ? 'ملصق أو بطاقة يمكن لأي شخص مسحها لفتح ملف التعريف والتواصل بسرعة.'
        : 'Printable tag that lets any finder scan the code, open the linked profile, and contact you quickly.';
    }
    return isRTL
      ? 'سوار أو بطاقة NFC مع قارئ أو هاتف يتصل بالباك إند ويرسل UID وبيانات المسح مباشرة.'
      : 'Hardware-ready NFC tag flow where a reader or phone can forward the UID and scan event to the backend immediately.';
  };


  const hardwareSummary = (device: DeviceItem) => {
    if (device.hardwareModel === 'SMART_TAG_PRO') return isRTL ? 'Smart Tag Pro: NFC + Barcode + GPS' : 'Smart Tag Pro: NFC + Barcode + GPS';
    if (device.hardwareModel === 'SMART_TAG_LITE') return isRTL ? 'Smart Tag Lite: NFC + Barcode' : 'Smart Tag Lite: NFC + Barcode';
    return isRTL ? 'Standalone device' : 'Standalone device';
  };

  const capabilityBadges = (device: DeviceItem) => {
    const badges = [] as string[];
    if (device.supportsNfc) badges.push('NFC');
    if (device.supportsBarcode) badges.push('Barcode');
    if (device.supportsGps) badges.push('GPS');
    return badges;
  };

  const deviceActionHint = (type: DeviceItem['type']) => {
    if (type === 'GPS') return isRTL ? 'حدّث الموقع والفاصل الزمني واربطه بملف تعريف.' : 'Update the live location, battery, interval, and linked profile.';
    if (type === 'QR') return isRTL ? 'أنشئ رمز QR واطبعه واربطه بملف تعريف مناسب.' : 'Generate and print the QR code, then link it to the correct profile.';
    return isRTL ? 'اربط UID بالملف ثم انسخ رمز الجهاز من شاشة NFC وجهّز القارئ لإرسال المسح إلى الباك إند.' : 'Link the wristband UID to a profile, copy the device token from the NFC screen, then let the reader send live scans to the backend.';
  };

  const deviceGuideSteps: Array<{ type: DeviceItem['type']; title: string; steps: string[] }> = [
    {
      type: 'GPS',
      title: 'GPS',
      steps: isRTL
        ? ['اربط الجهاز بملف التعريف المناسب.', 'حدّث آخر موقع وفترة الإرسال.', 'استخدمه للحركة الخارجية والمسافات الطويلة.']
        : ['Link the tracker to the correct profile.', 'Set the latest location and reporting interval.', 'Use it for outdoor movement and long-range recovery.']
    },
    {
      type: 'QR',
      title: 'QR',
      steps: isRTL
        ? ['أنشئ الكود واطبعه على بطاقة أو ملصق.', 'اربطه بملف التعريف الصحيح.', 'استخدمه عندما تتوقع أن يقوم شخص آخر بالمسح.']
        : ['Generate the code and print it on a tag or card.', 'Link it to the right profile.', 'Use it when a finder can easily scan the item.']
    },
    {
      type: 'NFC',
      title: 'NFC',
      steps: isRTL
        ? ['أدخل UID الخاص بالبطاقة أو السوار.', 'انسخ رمز الجهاز من شاشة NFC ووصل القارئ أو الهاتف بالموقع.', 'أرسل حدث المسح إلى مسار الهاردوير ليظهر الحدث مباشرة.']
        : ['Register the card or wristband UID.', 'Copy the device token from the NFC screen and connect the reader.', 'Send the scan event to the hardware endpoint for live identification.']
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/20 pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{t.heading}</h2>
          <p className="text-white/75 text-sm mt-2 max-w-3xl">{t.subtitle}</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: t.totalDevices, value: devices.length, icon: <Database className="w-5 h-5" /> },
          { label: t.activeDevices, value: activeDevicesCount, icon: <Radio className="w-5 h-5" /> },
          { label: t.linkedProfiles, value: linkedProfilesCount, icon: <ShieldCheck className="w-5 h-5" /> }
        ].map((card) => (
          <div key={card.label} className="rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">{card.label}</p>
              {card.icon}
            </div>
            <p className="mt-3 text-3xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Live GPS Map – always visible ──────────────────────── */}
      <LiveTrackingMap
        height="420px"
        showLog={true}
        isRTL={isRTL}
      />

      <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl text-white space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              <h3 className="text-xl font-black">{t.historyTitle}</h3>
            </div>
            <p className="text-sm text-white/70 mt-2 max-w-3xl">{t.historyBody}</p>
          </div>
          <label className="space-y-2 text-sm min-w-[240px]">
            <span className="text-white/70">{t.historySelect}</span>
            <select
              value={historyDeviceId}
              onChange={(event) => setHistoryDeviceId(event.target.value)}
              disabled={loading || gpsCapableDevices.length === 0}
              className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none disabled:opacity-60"
            >
              <option value="">{t.historySelectPlaceholder}</option>
              {gpsCapableDevices.map((device) => (
                <option key={device.id} value={device.serialNumber}>
                  {device.label} · {device.serialNumber}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="h-44 rounded-2xl border border-white/15 bg-white/10 animate-pulse" />
        ) : gpsCapableDevices.length === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-sm text-white/70">
            {t.historyNoGps}
          </div>
        ) : historyDeviceId ? (
          <TrackingHistoryPanel
            deviceId={historyDeviceId}
            deviceLabel={selectedHistoryDevice?.label ?? historyDeviceId}
            embedded
          />
        ) : (
          <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-sm text-white/70">
            {t.historyEmpty}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <Plus className="w-5 h-5" />
            <h3 className="text-xl font-black">{t.addDevice}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.hardwareModel}</span>
              <select value={form.hardwareModel} onChange={(event) => setForm((current) => ({ ...current, hardwareModel: event.target.value as DeviceForm['hardwareModel'], type: event.target.value === 'STANDALONE' ? current.type : 'NFC', trackingEnabled: event.target.value === 'SMART_TAG_PRO' }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none">
                <option value="STANDALONE">Standalone device</option>
                <option value="SMART_TAG_LITE">Smart Tag Lite - NFC + Barcode</option>
                <option value="SMART_TAG_PRO">Smart Tag Pro - NFC + Barcode + GPS</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.type}</span>
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as DeviceItem['type'] }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none">
                <option value="GPS">GPS</option>
                <option value="QR">QR</option>
                <option value="NFC">NFC</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.label}</span>
              <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.serial}</span>
              <input value={form.serialNumber} onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.linkedProfile}</span>
              <select value={form.linkedProfileId} onChange={(event) => setForm((current) => ({ ...current, linkedProfileId: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none">
                <option value="">{t.profilePlaceholder}</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.displayName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.interval}</span>
              <input value={form.updateIntervalMinutes} onChange={(event) => setForm((current) => ({ ...current, updateIntervalMinutes: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.lastLocation}</span>
              <input value={form.lastLocationText} onChange={(event) => setForm((current) => ({ ...current, lastLocationText: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.latitude}</span>
              <input value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/70">{t.longitude}</span>
              <input value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
            </label>
          </div>
          <label className="mt-4 inline-flex items-center gap-3 text-sm text-white/90">
            <input type="checkbox" checked={form.trackingEnabled} onChange={(event) => setForm((current) => ({ ...current, trackingEnabled: event.target.checked }))} />
            {t.tracking}
          </label>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/65 max-w-xl">{t.createProfileHint}</p>
            <button onClick={() => void handleCreateDevice()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : t.create}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl text-white">
          <h3 className="text-xl font-black mb-2">{t.quickTools}</h3>
          <p className="text-sm text-white/70 mb-4">{t.quickToolsBody}</p>
          <div className="space-y-3">
            {quickCards.map((card) => (
              <button key={card.title} onClick={card.action} className="w-full rounded-3xl border border-white/15 bg-white/10 px-4 py-4 text-left hover:bg-white/20 transition">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/15 p-3">{card.icon}</div>
                  <div>
                    <p className="text-lg font-black">{card.title}</p>
                    <p className="text-sm text-white/70">{card.body}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl text-white">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-xl font-black">{t.deviceGuideTitle}</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {deviceGuideSteps.map((guide) => (
            <div key={`${guide.type}-${guide.title}`} className="rounded-3xl border border-white/15 bg-white/10 p-4">
              <p className="text-lg font-black">{guide.title}</p>
              <ol className="mt-3 space-y-2 text-sm text-white/80 list-decimal list-inside">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-44 rounded-3xl border border-white/15 bg-white/10 animate-pulse" />
          ))
        ) : devices.length > 0 ? (
          devices.map((device) => {
            const draft = drafts[device.id] || toDraft(device);
            const profileName = profiles.find((profile) => profile.id === (draft.linkedProfileId || device.linkedProfileId))?.displayName;
            return (
              <div key={device.id} className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl text-white">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black">{device.label}</h3>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase">{device.type}</span>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase">{getHardwareModelLabel(device.hardwareModel || 'STANDALONE')}</span>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase">{draft.status}</span>
                    </div>
                    <p className="text-sm text-white/70 mt-2">{device.serialNumber}</p>
                    <p className="text-sm text-white/80 mt-2 max-w-3xl">{devicePurpose(device.type)}</p>
                    <p className="text-xs text-white/70 mt-2">{hardwareSummary(device)}</p>
                    <p className="text-xs text-white/60 mt-2">{deviceActionHint(device.type)}</p>
                  </div>
                  <div className="text-sm text-white/75 text-right space-y-1">
                    <p>{t.updated}: {formatDate(device.updatedAt)}</p>
                    <p>{t.locationHistory}: {device.locationHistory.length}</p>
                    <p className="text-[11px] text-white/60">{t.databaseRecord}: {device.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                  <label className="space-y-2 text-sm">
                    <span className="text-white/70">{t.label}</span>
                    <input value={draft.label} onChange={(event) => updateDraft(device.id, { label: event.target.value })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-white/70">{t.status}</span>
                    <select value={draft.status} onChange={(event) => updateDraft(device.id, { status: event.target.value as DeviceItem['status'] })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none">
                      {deviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-white/70">{t.linkedProfile}</span>
                    <select value={draft.linkedProfileId} onChange={(event) => updateDraft(device.id, { linkedProfileId: event.target.value })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none">
                      <option value="">{t.none}</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-white/70">{t.battery}</span>
                    <input value={draft.batteryLevel} onChange={(event) => updateDraft(device.id, { batteryLevel: event.target.value })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="text-white/70">{t.lastLocation}</span>
                    <input value={draft.lastLocationText} onChange={(event) => updateDraft(device.id, { lastLocationText: event.target.value })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-white/70">{t.latitude}</span>
                    <input value={draft.latitude} onChange={(event) => updateDraft(device.id, { latitude: event.target.value })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-white/70">{t.longitude}</span>
                    <input value={draft.longitude} onChange={(event) => updateDraft(device.id, { longitude: event.target.value })} className="w-full rounded-2xl bg-white/90 text-slate-900 px-4 py-3 outline-none" />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
                      <BatteryMedium className="w-4 h-4" /> {draft.batteryLevel || device.batteryLevel || '—'}%
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
                      <ShieldCheck className="w-4 h-4" /> {profileName || t.none}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold">
                      <Database className="w-4 h-4" /> {t.syncedToDatabase}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
                      {draft.trackingEnabled ? <Radio className="w-4 h-4" /> : <Power className="w-4 h-4" />} {draft.trackingEnabled ? t.trackingOn : t.trackingOff}
                    </span>
                    {capabilityBadges(device).map((badge) => (
                      <span key={badge} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold">
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-white/90">
                      <input type="checkbox" checked={draft.trackingEnabled} onChange={(event) => updateDraft(device.id, { trackingEnabled: event.target.checked })} />
                      {t.tracking}
                    </label>
                    <button onClick={() => openDeviceTool(device)} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 transition">
                      {t.openTool}
                    </button>
                    <button onClick={() => void handleSaveDevice(device.id, { status: 'ACTIVE', trackingEnabled: true })} disabled={savingId === device.id} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 transition disabled:opacity-60">
                      {t.turnOn}
                    </button>
                    <button onClick={() => void handleSaveDevice(device.id, { status: 'INACTIVE', trackingEnabled: false })} disabled={savingId === device.id} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 transition disabled:opacity-60">
                      {t.turnOff}
                    </button>
                    {device.type === 'GPS' ? (
                      <button onClick={() => void handleSaveDevice(device.id, { status: draft.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })} disabled={savingId === device.id} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 transition disabled:opacity-60">
                        {draft.status === 'ACTIVE' ? t.pause : t.activate}
                      </button>
                    ) : null}
                    <button onClick={() => void handleSaveDevice(device.id)} disabled={savingId === device.id} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-60">
                      <Save className="w-4 h-4" /> {savingId === device.id ? 'Saving…' : t.saveChanges}
                    </button>
                    <button onClick={() => void handleDeleteDevice(device.id, device.label)} disabled={deletingId === device.id} className="inline-flex items-center gap-2 rounded-full border border-red-200/50 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-500/20 transition disabled:opacity-60">
                      <Trash2 className="w-4 h-4" /> {deletingId === device.id ? t.deleting : t.deleteDevice}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-white/25 bg-white/10 px-6 py-12 text-center text-white">
            <p className="text-2xl font-black">{t.noDevices}</p>
            <p className="mt-3 text-sm text-white/70 max-w-2xl mx-auto">{t.noDevicesBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
