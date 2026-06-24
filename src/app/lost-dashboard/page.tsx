'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  FileText, Grid,
  UserCircle, Bell, Monitor, Settings, LogOut,
  Search, SlidersHorizontal, ImageIcon, Clock, ChevronDown, Save, X, Menu
} from 'lucide-react';
import { api } from '@/lib/api';
import { CaseCollectionSection } from '@/components/dashboard/CaseCollectionSection';
import { DevicesManagementPanel } from '@/components/dashboard/DevicesManagementPanel';
import { ProfileSettingsPanel } from '@/components/dashboard/ProfileSettingsPanel';
import { MobileNavDrawer } from '@/components/dashboard/MobileNavDrawer';
import { useAuth } from '@/components/providers/AuthProvider';
import { AdminQuickActions } from '@/components/admin/AdminQuickActions';
import { isAdminUser } from '@/lib/access';

const translations = {
  EN: {
    navHome: 'Home',
    navMissing: 'Missing',
    navFound: 'Found',
    navDevices: 'Devices',
    navProfile: 'Profile',
    sideMyDashboard: 'My Dashboard',
    sideMyReports: 'My Reports',
    sideNotifications: 'Notifications',
    sideDevices: 'Devices',
    sideSettings: 'Settings',
    sideLogout: 'LOGOUT',
    hello: 'Hello,',
    myDashboard: 'My Dashboard',
    stats: 'Stats',
    activeReports: 'Active Reports',
    foundMatches: 'Found Matches',
    notifications: 'Notifications',
    reportSearch: 'Report & Search',
    reportMissing: 'REPORT MISSING',
    searchFound: 'SEARCH FOUND CASES',
    latestCase: 'Latest case progress',
    submitted: 'Submitted',
    published: 'Published',
    alertsSent: 'Alerts Sent',
    searching: 'Searching',
    matched: 'Matched',
    myReports: 'My Reports',
    explore: 'Explore',
    name: 'Name',
    age: 'Age',
    lastSeen: 'Last Seen',
    approxInfo: 'Approx. info',
    foundAt: 'Found at',
    view: 'view',
    markAllRead: 'Mark all as read',
    email: 'Email',
    tabAll: 'All',
    tabAlerts: 'Alerts',
    tabMessages: 'Messages',
    tabSystem: 'System',
    minutesAgo: 'Minutes ago',
    // Device-specific translations
    qrTitle: 'Identification',
    qrDesc: 'Create a printable QR code linked to an identification profile',
    qrBtn: 'Generate QR',
    nfcTitle: 'Smart Tags',
    nfcDesc: 'Link an NFC bracelet tag to an identification profile',
    nfcBtn: 'Link NFC',
    gpsTitle: 'Bracelets',
    gpsDesc: 'Connect a GPS device to track the last known location',
    gpsBtn: 'Connect Device',
    gpsWhatTitle: 'What is GPS?',
    gpsWhat: 'GPS (Global Positioning System) is a satellite-based navigation system that accurately determines geographic location on Earth. A device (such as a phone, bracelet, or car) receives signals from multiple satellites to calculate location, speed, direction, and time with high precision.',
    gpsHowTitle: 'How to use GPS: Turn on Location',
    gpsHow: 'Services (GPS) in your device settings.\nOpen a GPS-based application such as Maps.\nOnce your location is determined, you can:\nFind out where you are',
    qrDefTitle: 'QR Code Definition',
    qrDef: 'A Quick Response (QR) code is a type of two-dimensional barcode that can store information such as website links, text, or contact details. It is quickly read using a phone camera or a dedicated QR code scanner.',
    qrHowTitle: 'How to Use a QR Code',
    qrHow: '1. Open your phone\'s camera or a QR scanner app.\n2. Point the camera at the QR code.\n3. Your phone will automatically read the code.\n4. The result will appear, such as: All the missing person\'s information',
    nfcWhatTitle: 'What is NFC technology?',
    nfcWhat: 'NFC stands for Near Field Communication, and it\'s a short-range wireless communication technology that allows data exchange between two devices when they are brought very close together (usually less than 4 cm).',
    nfcHowTitle: 'How to use the bracelet:',
    nfcHow: '1. Wear the bracelet containing the NFC chip.\n2. When needed, bring the bracelet close to an NFC reader.\n3. The reader reads the data stored on the chip.\n4. The desired operation is performed, such as reading the person\'s data.',
    qr: 'QR',
    nfc: 'NFC',
    gps: 'GPS',
    // Settings-specific translations
    settingsTitle: 'Settings',
    secNotifications: 'Notifications',
    matchAlerts: 'Match Alerts',
    foundCaseUpdates: 'Found Case Updates',
    nearbyAlerts: 'Nearby Alerts',
    deviceAlerts: 'Device Alerts',
    emailNotification: 'Email Notification',
    secDevicePrefs: 'Device Preferences',
    enableQR: 'Enable QR Identification',
    enableNFC: 'Enable NFC access',
    enableGPS: 'Enable GPS location updates',
    enableBluetooth: 'Enable Bluetooth proximity assist',
    enableWifi: 'Enable Wi-Fi indoor assist',
    gpsInterval: 'GPS updates interval',
    autoDownloadQR: 'Auto-download QR after generation',
    secPrivacy: 'Privacy',
    showContact: 'Show contact number to verified finder',
    hideSensitive: 'Hide sensitive details by default',
    allowLocation: 'Allow location sharing in emergency',
    every5min: 'Every 5 min',
    every10min: 'Every 10 min',
    every30min: 'Every 30 min',
    saveSettings: 'Save settings',
    settingsSaved: 'Settings saved successfully.',
    settingsHint: 'Bluetooth and Wi-Fi are controlled here as optional AI support channels, not as separate devices.',
    notifs: [
      { title: 'Possible', highlight: 'Match', titleEnd: ' Found', sub: 'AI detected a', subHighlight: 'match for', subEnd: ' Ahmed Ali', btn: 'View Details', btnType: 'green' },
      { title: 'Nearby', highlight: 'Scan', titleEnd: ' Detected', sub: 'Bracelet Scanned near', subHighlight: 'Nasr City', subEnd: '', btn: 'View Location', btnType: 'green' },
      { title: 'New', highlight: 'Message', titleEnd: '', sub: 'Finder', subHighlight: 'sent', subEnd: ' you a message', btn: 'Open Chat', btnType: 'green' },
      { title: 'Possible', highlight: 'Match', titleEnd: ' Found', sub: 'AI detected a', subHighlight: 'match for', subEnd: ' Eyad Ahmed', btn: 'View Details', btnType: 'green' },
    ],
    // Profile-specific translations
    userSettings: 'User Settings',
    details: 'Details',
    edit: 'Edit',
    fullName: 'Full Name',
    dateBirth: 'date birth',
    telNumber: 'Tel - Number:',
    gender: 'Gender',
    country: 'Country',
    saveChanges: 'Save changes',
    password: 'Password',
    changePassword: 'Change password',
    putPassword: 'Put your password...',
    confirmPassword: 'Confirm password...',
    newPassword: 'New password',
    putNewPassword: 'Put your new password...',
    confirmNewPassword: 'Confirm new password...',
    forgotPassword: 'Forgot your password?',
    information: 'Information',
    preferences: 'Preferences',
    countryLabel: 'country:',
    deleteAccount: 'Delete Account',
    nameLabel: 'Name:',
    emailLabel: 'Email:',
    telLabel: 'Tel:',
    male: 'Male',
    female: 'Female',
    egypt: 'Egypt',
    usa: 'USA',
    ksa: 'KSA',
    // Profile edit specific translations
    editProfile: 'Edit Profile',
    saveProfile: 'Save Profile',
    cancel: 'Cancel',
  },
  AR: {
    navHome: 'الرئيسية',
    navMissing: 'المفقودون',
    navFound: 'الموجودون',
    navDevices: 'الأجهزة',
    navProfile: 'الملف الشخصي',
    sideMyDashboard: 'لوحتي',
    sideMyReports: 'تقاريري',
    sideNotifications: 'الإشعارات',
    sideDevices: 'الأجهزة',
    sideSettings: 'الإعدادات',
    sideLogout: 'تسجيل خروج',
    hello: 'مرحباً،',
    myDashboard: 'لوحة التحكم',
    stats: 'الإحصائيات',
    activeReports: 'التقارير النشطة',
    foundMatches: 'التطابقات',
    notifications: 'الإشعارات',
    reportSearch: 'الإبلاغ والبحث',
    reportMissing: 'الإبلاغ عن مفقود',
    searchFound: 'البحث في الحالات',
    latestCase: 'آخر تقدم للحالة',
    submitted: 'تم الإرسال',
    published: 'تم النشر',
    alertsSent: 'تم الإنذار',
    searching: 'جاري البحث',
    matched: 'تم التطابق',
    myReports: 'تقاريري',
    explore: 'استكشاف',
    name: 'الاسم',
    age: 'العمر',
    lastSeen: 'آخر ظهور',
    approxInfo: 'معلومات تقريبية',
    foundAt: 'تم العثور عليه في',
    view: 'عرض',
    markAllRead: 'تعيين الكل كمقروء',
    email: 'البريد الإلكتروني',
    tabAll: 'الكل',
    tabAlerts: 'تنبيهات',
    tabMessages: 'رسائل',
    tabSystem: 'النظام',
    minutesAgo: 'دقائق مضت',
    // Device-specific translations
    qrTitle: 'التعريف',
    qrDesc: 'أنشئ رمز QR قابلاً للطباعة مرتبطاً بملف تعريفي',
    qrBtn: 'إنشاء QR',
    nfcTitle: 'العلامات الذكية',
    nfcDesc: 'اربط سوار NFC بملف تعريفي',
    nfcBtn: 'ربط NFC',
    gpsTitle: 'الأساور',
    gpsDesc: 'اربط جهاز GPS لتتبع آخر موقع معروف',
    gpsBtn: 'ربط الجهاز',
    gpsWhatTitle: 'ما هو GPS؟',
    gpsWhat: 'نظام GPS (نظام تحديد المواقع العالمي) هو نظام ملاحة يعتمد على الأقمار الصناعية ويحدد الموقع الجغرافي بدقة على الأرض. يستقبل الجهاز (كالهاتف أو السوار أو السيارة) إشارات من أقمار صناعية متعددة لحساب الموقع والسرعة والاتجاه.',
    gpsHowTitle: 'كيفية استخدام GPS: تشغيل الموقع',
    gpsHow: 'شغّل خدمات GPS في إعدادات جهازك.\nافتح تطبيقاً يعتمد على GPS مثل الخرائط.\nبمجرد تحديد موقعك يمكنك:\nمعرفة مكانك',
    qrDefTitle: 'تعريف رمز QR',
    qrDef: 'رمز الاستجابة السريعة (QR) هو نوع من الرموز الشريطية ثنائية الأبعاد يمكنه تخزين معلومات مثل روابط المواقع أو النصوص أو بيانات الاتصال. يُقرأ بسرعة باستخدام كاميرا الهاتف أو ماسح QR مخصص.',
    qrHowTitle: 'كيفية استخدام رمز QR',
    qrHow: '١. افتح كاميرا هاتفك أو تطبيق ماسح QR.\n٢. وجّه الكاميرا نحو رمز QR.\n٣. سيقرأ هاتفك الرمز تلقائياً.\n٤. ستظهر النتيجة، مثل: جميع معلومات المفقود',
    nfcWhatTitle: 'ما هي تقنية NFC؟',
    nfcWhat: 'NFC اختصار للاتصال قريب المدى، وهي تقنية اتصال لاسلكي قصيرة المدى تتيح تبادل البيانات بين جهازين عند اقترابهما (عادةً أقل من 4 سم).',
    nfcHowTitle: 'كيفية استخدام السوار:',
    nfcHow: '١. ارتدِ السوار الذي يحتوي على شريحة NFC.\n٢. عند الحاجة، قرّب السوار من قارئ NFC.\n٣. يقرأ القارئ البيانات المخزنة على الشريحة.\n٤. تُنفّذ العملية المطلوبة مثل قراءة بيانات الشخص.',
    qr: 'QR',
    nfc: 'NFC',
    gps: 'GPS',
    // Settings-specific translations
    settingsTitle: 'الإعدادات',
    secNotifications: 'الإشعارات',
    matchAlerts: 'تنبيهات التطابق',
    foundCaseUpdates: 'تحديثات الحالات',
    nearbyAlerts: 'التنبيهات القريبة',
    deviceAlerts: 'تنبيهات الجهاز',
    emailNotification: 'إشعار البريد',
    secDevicePrefs: 'تفضيلات الجهاز',
    enableQR: 'تفعيل التعريف بـ QR',
    enableNFC: 'تفعيل NFC',
    enableGPS: 'تفعيل تحديثات GPS',
    enableBluetooth: 'تفعيل المساعدة عبر Bluetooth',
    enableWifi: 'تفعيل المساعدة عبر Wi-Fi',
    gpsInterval: 'فترة تحديث GPS',
    autoDownloadQR: 'تحميل QR تلقائياً',
    secPrivacy: 'الخصوصية',
    showContact: 'إظهار رقم الاتصال للباحث',
    hideSensitive: 'إخفاء التفاصيل الحساسة',
    allowLocation: 'السماح بمشاركة الموقع في الطوارئ',
    every5min: 'كل 5 دقائق',
    every10min: 'كل 10 دقائق',
    every30min: 'كل 30 دقيقة',
    saveSettings: 'حفظ الإعدادات',
    settingsSaved: 'تم حفظ الإعدادات بنجاح.',
    settingsHint: 'Bluetooth و Wi-Fi يتم التحكم بهما من هنا كخيارات مساعدة، وليس كأجهزة مستقلة.',
    notifs: [
      { title: 'تطابق', highlight: 'محتمل', titleEnd: ' تم العثور عليه', sub: 'اكتشف الذكاء الاصطناعي', subHighlight: 'تطابقاً لـ', subEnd: ' أحمد علي', btn: 'عرض التفاصيل', btnType: 'green' },
      { title: 'إشارة', highlight: 'قريبة', titleEnd: ' رُصدت', sub: 'تم مسح السوار بالقرب من', subHighlight: 'مدينة نصر', subEnd: '', btn: 'عرض الموقع', btnType: 'green' },
      { title: 'رسالة', highlight: 'جديدة', titleEnd: '', sub: 'أرسل إليك', subHighlight: 'الباحث', subEnd: ' رسالة', btn: 'فتح المحادثة', btnType: 'green' },
      { title: 'تطابق', highlight: 'محتمل', titleEnd: ' تم العثور عليه', sub: 'اكتشف الذكاء الاصطناعي', subHighlight: 'تطابقاً لـ', subEnd: ' إياد أحمد', btn: 'عرض التفاصيل', btnType: 'green' },
    ],
    // Profile-specific translations
    userSettings: 'إعدادات المستخدم',
    details: 'التفاصيل',
    edit: 'تعديل',
    fullName: 'الاسم الكامل',
    dateBirth: 'تاريخ الميلاد',
    telNumber: 'رقم الهاتف:',
    gender: 'الجنس',
    country: 'الدولة',
    saveChanges: 'حفظ التغييرات',
    password: 'كلمة المرور',
    changePassword: 'تغيير كلمة المرور',
    putPassword: 'أدخل كلمة المرور...',
    confirmPassword: 'تأكيد كلمة المرور...',
    newPassword: 'كلمة مرور جديدة',
    putNewPassword: 'أدخل كلمة المرور الجديدة...',
    confirmNewPassword: 'تأكيد كلمة المرور الجديدة...',
    forgotPassword: 'نسيت كلمة المرور؟',
    information: 'المعلومات',
    preferences: 'التفضيلات',
    countryLabel: 'الدولة:',
    deleteAccount: 'حذف الحساب',
    nameLabel: 'الاسم:',
    emailLabel: 'البريد:',
    telLabel: 'الهاتف:',
    male: 'ذكر',
    female: 'أنثى',
    egypt: 'مصر',
    usa: 'أمريكا',
    ksa: 'السعودية',
    // Profile edit specific translations
    editProfile: 'تعديل الملف',
    saveProfile: 'حفظ الملف',
    cancel: 'إلغاء',
  },
};

// Dummy report cards for My Reports tab
const dummyReports = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
];

// Minutes for notification timestamps
const MINUTES = [2, 10, 13, 20];

// ── SETTINGS COMPONENTS ──
// Toggle component
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none border-2 ${
        on ? 'bg-[#014CB3] border-[#014CB3]' : 'bg-white/20 border-white/30'
      }`}
    >
      <span
        className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
          on ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
      <span className={`absolute text-[9px] font-black tracking-widest ${on ? 'left-1.5 text-white' : 'right-1.5 text-white/70'}`}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

// Row with toggle
function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span className="min-w-0 flex-1 text-sm font-medium text-white/90">{label}</span>
      <Toggle on={value} onChange={onChange} />
    </div>
  );
}

// Row with dropdown
function SelectRow({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className={`flex flex-col gap-3 rounded-xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-5 relative ${open ? 'z-[100]' : 'z-10'}`}>
      <span className="min-w-0 flex-1 text-sm font-medium text-white/90">{label}</span>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-lg px-3 py-1 text-white text-xs font-semibold hover:bg-white/30 transition-all"
        >
          {value}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute right-0 top-8 bg-[#014CB3] border border-white/20 rounded-xl shadow-xl z-[110] overflow-hidden min-w-[120px]">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="block w-full text-left px-4 py-2 text-white text-xs hover:bg-white/20 transition-all"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Missing Component ──
function MissingContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.navMissing}
      description="Browse live missing reports from all users and open any case to review full details or matches."
      scope="global"
      caseType="MISSING"
      isRTL={isRTL}
      labels={{
        explore: t.explore,
        view: t.view,
        name: t.name,
        age: t.age,
        lastSeen: t.lastSeen,
        approxInfo: t.approxInfo,
        foundAt: t.foundAt,
        type: 'Type',
        status: 'Status',
        reference: 'Reference',
        description: 'Description'
      }}
      emptyTitle="No missing reports available"
      emptyBody="Once users submit missing reports, they will appear here for review and search."
    />
  );
}

// ── Found Component ──
function FoundContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.navFound}
      description="Search submitted found reports from all users to compare details, locations, and possible matches."
      scope="global"
      caseType="FOUND"
      isRTL={isRTL}
      labels={{
        explore: t.explore,
        view: t.view,
        name: t.name,
        age: t.age,
        lastSeen: t.lastSeen,
        approxInfo: t.approxInfo,
        foundAt: t.foundAt,
        type: 'Type',
        status: 'Status',
        reference: 'Reference',
        description: 'Description'
      }}
      emptyTitle="No found reports available"
      emptyBody="When finders submit reports, they will show up here with their latest status and details."
    />
  );
}

// ── My Reports Component ──
function MyReportsContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.myReports}
      description="These are your own missing reports, connected directly to the backend and updated in real time."
      scope="my"
      caseType="MISSING"
      isRTL={isRTL}
      addReportHref="/report-missing"
      addReportLabel="+ Add report"
      excludeStatuses={['MATCHED', 'RESOLVED', 'CLOSED']}
      labels={{
        explore: t.explore,
        view: t.view,
        name: t.name,
        age: t.age,
        lastSeen: t.lastSeen,
        approxInfo: t.approxInfo,
        foundAt: t.foundAt,
        type: 'Type',
        status: 'Status',
        reference: 'Reference',
        description: 'Description'
      }}
      emptyTitle="No missing reports yet"
      emptyBody="Submit your first missing report and it will appear here immediately with its case details."
    />
  );
}


function MatchesContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.foundMatches}
      description="Potential matches with 85% confidence or more appear here first, and confirmed final matches stay here for follow-up."
      scope="my"
      caseType="MISSING"
      allowedStatuses={['MATCHED', 'RESOLVED', 'CLOSED']}
      excludeResolved={false}
      isRTL={isRTL}
      labels={{
        explore: t.explore,
        view: t.view,
        name: t.name,
        age: t.age,
        lastSeen: t.lastSeen,
        approxInfo: t.approxInfo,
        foundAt: t.foundAt,
        type: 'Type',
        status: 'Status',
        reference: 'Reference',
        description: 'Description'
      }}
      emptyTitle="No final matches yet"
      emptyBody="When you confirm a final match from the case details page, the report will move here."
    />
  );
}

// ── Single Report Card ──
function ReportCard({ t, isRTL, report }: { t: typeof translations['EN']; isRTL: boolean; report: any }) {
  const displayName = report.displayName || report.name || 'Unnamed';
  const image = report.primaryImage || report.photo || null;
  const location = report.locationText || report.location || '—';
  const date = report.eventTime || report.lastSeenAt || report.createdAt || report.date || '—';
  const category = report.category || report.type || '—';
  const ageText = report.age ? `${report.age} years` : report.type || '—';

  const compatibility = {
    id: report.id,
    name: displayName,
    description: report.description || ageText,
    location,
    photo: image,
    dateTime: date,
    status: report.status || 'ACTIVE',
    referenceCode: report.referenceCode
  };

  return (
    <div className="bg-gradient-to-br from-[#1388e2]/33 to-[#2ecc71]/33 rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <div className="h-72 lg:h-full bg-white/70">
          {image ? (
            <img src={image} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-[#014CB3]/70">
              <ImageIcon className="w-16 h-16" />
              <span className="mt-2 text-sm font-semibold">No Photo</span>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 text-white">
          <h3 className="mb-3 text-xl font-black tracking-tight sm:text-2xl">{displayName}</h3>
          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
            <div>
              <p className="text-white/70 text-xs uppercase">Age</p>
              <p className="font-bold text-base">{ageText}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase">Category</p>
              <p className="font-bold text-base">{category}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase">Last Seen</p>
              <p className="font-bold text-base truncate">{location}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase">Date</p>
              <p className="font-bold text-base">{typeof date === 'string' ? date.replace('T', ' ').slice(0, 16) : '—'}</p>
            </div>
          </div>

          <div className="bg-white/15 rounded-xl border border-white/20 p-3 mb-4">
            <h4 className="text-xs text-white/80 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-sm text-white/90 min-h-[44px]">{report.description || 'No description provided.'}</p>
          </div>

          <div className="bg-white/15 rounded-xl border border-white/20 p-3 mb-5">
            <h4 className="text-xs text-white/80 uppercase tracking-wider mb-1">Reference</h4>
            <p className="text-sm text-white/90 truncate">{report.referenceCode || 'Not available'}</p>
          </div>

          <button
            onClick={() => {
              localStorage.setItem('currentReport', JSON.stringify(compatibility));
              localStorage.setItem('lastReportData', JSON.stringify(compatibility));
              window.location.href = report.id ? `/case-details?caseId=${report.id}` : '/case-details';
            }}
            className="w-full py-3 bg-white/20 hover:bg-white/35 text-white font-bold rounded-full border border-white/40 transition-all"
          >
            {t.view}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Found Report Card ──
function FoundReportCard({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <div className="bg-white/20 backdrop-blur-lg rounded-3xl border border-white/30 shadow-2xl overflow-hidden flex flex-col">

      {/* Photo placeholder */}
      <div className="bg-white/30 mx-4 mt-4 rounded-2xl flex flex-col items-center justify-center py-8 gap-2 border border-white/20">
        <ImageIcon className="w-10 h-10 text-gray-500/60" />
        <span className="text-gray-600/70 text-base font-semibold tracking-wide">photo</span>
      </div>

      {/* Info rows - Found specific fields */}
      <div className="px-6 py-4 space-y-2 flex-1">
        {[t.approxInfo, t.foundAt].map((label) => (
          <div
            key={label}
            className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <span className="text-white font-semibold text-sm w-20 flex-shrink-0 text-left" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {label}
            </span>
            {/* Placeholder bar */}
            <div className="flex-1 h-4 bg-white/25 rounded-full border border-white/20" />
          </div>
        ))}
      </div>

      {/* View button */}
      <div className="px-6 pb-5 flex justify-center">
        <button className="px-10 py-2 bg-white/30 backdrop-blur-md text-white font-bold text-sm rounded-full border border-white/40 hover:bg-white/50 transition-all shadow-md">
          {t.view}
        </button>
      </div>
    </div>
  );
}

// ── Notifications Component ──
function NotificationsContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  const [activeNotificationTab, setActiveNotificationTab] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tabs = [t.tabAll, t.tabAlerts, t.tabMessages, t.tabSystem];

  useEffect(() => {
    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const response = await api.notifications();
        if (!cancelled) {
          setItems(response.items);
        }
      } catch (error) {
        console.warn('Unable to load notifications', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (activeNotificationTab === 0) return items;
    return items.filter((item) => {
      const type = String(item.type || '').toLowerCase();
      if (activeNotificationTab === 1) return type.includes('match') || type.includes('scan') || type.includes('alert') || type.includes('case');
      if (activeNotificationTab === 2) return type.includes('message') || type.includes('chat');
      return !(type.includes('message') || type.includes('chat') || type.includes('match') || type.includes('scan') || type.includes('alert'));
    });
  }, [activeNotificationTab, items]);

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
    } catch (error) {
      console.warn('Unable to mark notifications read', error);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 border-b border-white/20 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl md:text-2xl">{t.notifications}</h2>
        <button onClick={() => void markAllRead()} className="w-full rounded-full bg-[#014CB3] px-5 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-blue-800 sm:w-auto">
          {t.markAllRead}
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-0 overflow-x-auto px-2 pb-6 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {tabs.map((tab, i) => (
          <React.Fragment key={tab}>
            <button
              onClick={() => setActiveNotificationTab(i)}
              className={`flex-shrink-0 whitespace-nowrap px-1 pb-1 text-xs font-bold transition-all sm:text-sm ${
                activeNotificationTab === i
                  ? 'text-white border-b-2 border-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab}
            </button>
            {i < tabs.length - 1 && (
              <span className="text-white/40 mx-3 font-light text-lg">/</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Notification Cards */}
      <div className="px-2 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white/10 rounded-2xl h-28 animate-pulse" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(item.createdAt).getTime()) / 60000));
            return (
              <div
                key={item.id}
                className={`flex flex-col gap-4 rounded-2xl border bg-white/15 px-4 py-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6 ${item.isRead ? 'border-white/10' : 'border-white/25'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base mb-1">{item.title}</p>
                  <p className="text-white/70 text-sm mb-2">{item.body}</p>
                  <div className="flex items-center gap-1 text-white/50 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{minutesAgo} {t.minutesAgo}</span>
                    {!item.isRead ? <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-[#60C10F]" /> : null}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!item.isRead) {
                      void api.markNotificationRead(item.id).catch(() => undefined);
                      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true, readAt: new Date().toISOString() } : entry));
                    }
                    if (item.actionUrl) window.location.href = item.actionUrl;
                  }}
                  className="w-full flex-shrink-0 rounded-full bg-[#60C10F] px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[#4da00b] sm:w-auto sm:py-2 sm:whitespace-nowrap"
                >
                  {item.actionUrl ? 'Open' : item.isRead ? 'Read' : 'Mark read'}
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-center text-white/75 py-16 rounded-2xl border border-white/15">No notifications yet.</div>
        )}
      </div>
    </>
  );
}

// ── Devices Component ──
function DevicesContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return <DevicesManagementPanel isRTL={isRTL} />;
}

// ── Settings Component ──
function SettingsContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  const { user, refreshUser } = useAuth();
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [foundCase, setFoundCase] = useState(true);
  const [nearbyAlerts, setNearbyAlerts] = useState(false);
  const [deviceAlerts, setDeviceAlerts] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);
  const [enableQR, setEnableQR] = useState(true);
  const [enableNFC, setEnableNFC] = useState(true);
  const [enableGPS, setEnableGPS] = useState(true);
  const [enableBluetooth, setEnableBluetooth] = useState(true);
  const [enableWifi, setEnableWifi] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [showContact, setShowContact] = useState(true);
  const [hideSensitive, setHideSensitive] = useState(true);
  const [allowLocation, setAllowLocation] = useState(true);
  const [gpsInterval, setGpsInterval] = useState(t.every5min);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const intervalLabelFromMinutes = (minutes?: number) => {
    if (minutes === 10) return t.every10min;
    if (minutes === 30) return t.every30min;
    return t.every5min;
  };

  const intervalMinutesFromLabel = (label: string) => {
    if (label === t.every10min) return 10;
    if (label === t.every30min) return 30;
    return 5;
  };

  useEffect(() => {
    if (!user) return;
    const pref = user.preference || {
      language: 'en',
      darkMode: false,
      notificationsEnabled: true,
      gpsIntervalMinutes: 5,
      showContactToFinder: true,
      hideSensitiveDetails: true,
      allowEmergencyLocation: true,
      enableQr: true,
      enableNfc: true,
      enableGps: true,
      enableBluetooth: true,
      enableWifi: true,
      matchAlerts: true,
      foundCaseUpdates: true,
      nearbyAlerts: false,
      deviceAlerts: true,
      autoDownloadQr: false,
      ownerMessages: true,
      locationRequests: true,
      autoOpenProfile: false,
      systemAnalysis: false,
    };
    setMatchAlerts(Boolean(pref.matchAlerts));
    setFoundCase(Boolean(pref.foundCaseUpdates));
    setNearbyAlerts(Boolean(pref.nearbyAlerts));
    setDeviceAlerts(Boolean(pref.deviceAlerts));
    setEmailNotif(Boolean(pref.notificationsEnabled));
    setEnableQR(Boolean(pref.enableQr));
    setEnableNFC(Boolean(pref.enableNfc));
    setEnableGPS(Boolean(pref.enableGps));
    setEnableBluetooth(Boolean(pref.enableBluetooth));
    setEnableWifi(Boolean(pref.enableWifi));
    setAutoDownload(Boolean(pref.autoDownloadQr));
    setShowContact(Boolean(pref.showContactToFinder));
    setHideSensitive(Boolean(pref.hideSensitiveDetails));
    setAllowLocation(Boolean(pref.allowEmergencyLocation));
    setGpsInterval(intervalLabelFromMinutes(pref.gpsIntervalMinutes));
  }, [
    t.every10min,
    t.every30min,
    t.every5min,
    user
  ]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateMe({
        preference: {
          matchAlerts,
          foundCaseUpdates: foundCase,
          nearbyAlerts,
          deviceAlerts,
          notificationsEnabled: emailNotif,
          enableQr: enableQR,
          enableNfc: enableNFC,
          enableGps: enableGPS,
          enableBluetooth,
          enableWifi,
          gpsIntervalMinutes: intervalMinutesFromLabel(gpsInterval),
          autoDownloadQr: autoDownload,
          showContactToFinder: showContact,
          hideSensitiveDetails: hideSensitive,
          allowEmergencyLocation: allowLocation
        }
      });
      await refreshUser();
      setMessage(t.settingsSaved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="border-b border-white/20 px-4 py-4 sm:px-8">
        <h1 className="text-lg font-extrabold tracking-tight text-white italic sm:text-xl md:text-2xl">{t.settingsTitle}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 overflow-visible p-4 sm:gap-8 sm:p-6 md:grid-cols-2">
        <div className="space-y-6 overflow-visible">
          <div className="overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secNotifications}</h2>
            <div className="space-y-3 overflow-visible">
              <SettingRow label={t.matchAlerts} value={matchAlerts} onChange={() => setMatchAlerts(!matchAlerts)} />
              <SettingRow label={t.foundCaseUpdates} value={foundCase} onChange={() => setFoundCase(!foundCase)} />
              <SettingRow label={t.nearbyAlerts} value={nearbyAlerts} onChange={() => setNearbyAlerts(!nearbyAlerts)} />
              <SettingRow label={t.deviceAlerts} value={deviceAlerts} onChange={() => setDeviceAlerts(!deviceAlerts)} />
              <SettingRow label={t.emailNotification} value={emailNotif} onChange={() => setEmailNotif(!emailNotif)} />
            </div>
          </div>

          <div className="overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secPrivacy}</h2>
            <div className="space-y-3 overflow-visible">
              <SettingRow label={t.showContact} value={showContact} onChange={() => setShowContact(!showContact)} />
              <SettingRow label={t.hideSensitive} value={hideSensitive} onChange={() => setHideSensitive(!hideSensitive)} />
            </div>
          </div>
        </div>

        <div className="space-y-6 overflow-visible">
          <div className="overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secDevicePrefs}</h2>
            <div className="space-y-3 overflow-visible">
              <SettingRow label={t.enableQR} value={enableQR} onChange={() => setEnableQR(!enableQR)} />
              <SettingRow label={t.enableNFC} value={enableNFC} onChange={() => setEnableNFC(!enableNFC)} />
              <SettingRow label={t.enableGPS} value={enableGPS} onChange={() => setEnableGPS(!enableGPS)} />
              <SettingRow label={t.enableBluetooth} value={enableBluetooth} onChange={() => setEnableBluetooth(!enableBluetooth)} />
              <SettingRow label={t.enableWifi} value={enableWifi} onChange={() => setEnableWifi(!enableWifi)} />
              <SelectRow
                label={t.gpsInterval}
                value={gpsInterval}
                options={[t.every5min, t.every10min, t.every30min]}
                onChange={setGpsInterval}
              />
              <SettingRow label={t.autoDownloadQR} value={autoDownload} onChange={() => setAutoDownload(!autoDownload)} />
              <p className="text-xs text-white/60 leading-6">{t.settingsHint}</p>
            </div>
          </div>

          <div className="space-y-3 overflow-visible">
            <SettingRow label={t.allowLocation} value={allowLocation} onChange={() => setAllowLocation(!allowLocation)} />
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        {error ? <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        <div className="flex justify-end">
          <button onClick={() => void handleSaveSettings()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#014CB3] shadow-lg disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : t.saveSettings}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Profile Components ──
function InputField({ placeholder, value, onChange, type = 'text', readOnly = false }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string; readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
        readOnly
          ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed opacity-75'
          : 'bg-gray-100 border-gray-200 text-gray-600 placeholder-gray-400 focus:border-[#60C10F]'
      }`}
    />
  );
}

function SelectField({ placeholder, options, disabled = false }: { placeholder: string; options: string[]; disabled?: boolean }) {
  const [val, setVal] = useState('');
  return (
    <div className="relative">
      <select
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={disabled}
        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all appearance-none ${
          disabled
            ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed opacity-75'
            : 'bg-gray-100 border-gray-200 text-gray-500 focus:border-[#60C10F] cursor-pointer'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ── Profile Content Component ──
function ProfileContent({ t }: { t: typeof translations['EN']; isRTL: boolean }) {
  return <ProfileSettingsPanel t={t as any} />;
}

// ── Overview Component ──
function OverviewContent({ t, isRTL, flowSteps, router, setActiveTab }: {
  t: typeof translations['EN'];
  isRTL: boolean;
  flowSteps: Array<{ label: string; row: string }>;
  router: any;
  setActiveTab: (tab: any) => void;
}) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const response = await api.dashboardSummary();
        if (!cancelled) {
          setSummary(response);
        }
      } catch (error) {
        console.warn('Unable to load dashboard summary', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { val: summary?.stats?.activeReports ?? 0, label: t.activeReports },
    { val: summary?.stats?.matchedReports ?? 0, label: t.foundMatches },
    { val: summary?.stats?.unreadNotifications ?? 0, label: t.notifications },
  ];

  const latestCase = summary?.recentCases?.[0];

  return (
    <>
      {/* Stats */}
      <section className="mb-10">
        <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">{t.stats}</h2>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {(loading ? [
            { val: '…', label: t.activeReports },
            { val: '…', label: t.foundMatches },
            { val: '…', label: t.notifications },
          ] : stats).map((stat, i) => (
            <div
              key={i}
              className="flex min-h-[150px] w-[clamp(130px,15vw,190px)] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-white/30 bg-white/20 px-3 py-4 shadow-2xl backdrop-blur-lg sm:min-h-[clamp(150px,16vw,200px)] sm:rounded-[2rem] md:gap-4 md:py-5"
            >
              <span className="block text-4xl font-black leading-none text-white md:text-5xl">{stat.val}</span>
              <span className="block max-w-full px-1 text-center text-[10px] font-bold uppercase leading-snug tracking-tight text-white md:text-xs">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Report & Search */}
      <section className="mb-10">
        <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">{t.reportSearch}</h2>
        <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
          <button
            onClick={() => router.push('/report-missing')}
            className="w-full max-w-[520px] rounded-2xl border-b-[6px] border-[#3d7a0a] bg-[#60C10F] px-6 py-4 text-lg font-black uppercase text-white shadow-2xl transition-all hover:bg-[#5bc00d] active:border-b-0 active:translate-y-1 sm:border-b-8 sm:px-8 sm:py-6 sm:text-2xl md:text-3xl"
          >
            {t.reportMissing}
          </button>

          <button
            onClick={() => setActiveTab('found')}
            className="w-full max-w-[520px] rounded-2xl border-b-[6px] border-[#002e6d] bg-[#014CB3] px-6 py-4 text-lg font-black uppercase text-white shadow-2xl transition-all hover:bg-[#013fa0] active:border-b-0 active:translate-y-1 sm:border-b-8 sm:px-8 sm:py-6 sm:text-2xl md:text-3xl"
          >
            {t.searchFound}
          </button>
        </div>
      </section>

      {isAdminUser(user) ? (
        <section className="mb-10 max-w-5xl mx-auto">
          <AdminQuickActions locale={isRTL ? 'AR' : 'EN'} compact />
        </section>
      ) : null}

      {latestCase ? (
        <section className="mb-8">
          <div className="max-w-4xl mx-auto bg-white/15 backdrop-blur-md border border-white/20 rounded-3xl p-5 text-white shadow-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Latest backend case</p>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-xl font-black sm:text-2xl">{latestCase.displayName}</h3>
                <p className="text-white/75 text-sm mt-1">{latestCase.referenceCode} • {latestCase.locationText || 'Location not set yet'}</p>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('currentReport', JSON.stringify({
                    id: latestCase.id,
                    name: latestCase.displayName,
                    description: latestCase.description || '',
                    location: latestCase.locationText || '',
                    photo: latestCase.primaryImage || null,
                    dateTime: latestCase.createdAt,
                    status: latestCase.status,
                    referenceCode: latestCase.referenceCode
                  }));
                  window.location.href = `/case-details?caseId=${latestCase.id}`;
                }}
                className="w-full rounded-full bg-white px-5 py-3 font-black text-[#014CB3] transition-transform hover:scale-105 sm:w-auto"
              >
                Open case
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Flow Chart */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-8">{t.latestCase}</h2>

        <div className="relative w-full overflow-x-auto">
          <div className="relative min-w-[320px] sm:min-w-[560px]" style={{ height: '150px' }}>

            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1000 150"
              preserveAspectRatio="none"
            >
              <defs>
                <marker id="arrowW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="white" />
                </marker>
              </defs>
              {!isRTL ? (
                <>
                  <path d="M 180 38 C 210 38 210 108 240 108" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                  <path d="M 380 108 C 410 108 410 38 440 38" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                  <path d="M 580 38 C 610 38 610 108 640 108" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                  <path d="M 780 108 C 810 108 810 38 840 38" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                </>
              ) : (
                <>
                  <path d="M 820 38 C 790 38 790 108 760 108" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                  <path d="M 620 108 C 590 108 590 38 560 38" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                  <path d="M 420 38 C 390 38 390 108 360 108" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                  <path d="M 220 108 C 190 108 190 38 160 38" fill="none" stroke="white" strokeWidth="3" markerEnd="url(#arrowW)" />
                </>
              )}
            </svg>

            {flowSteps.map((step, idx) => (
              <div
                key={idx}
                className="z-10 bg-white/25 backdrop-blur-md rounded-2xl border border-white/40 shadow-lg absolute flex items-center justify-center"
                style={{
                  left: isRTL ? 'auto' : `${idx * 20}%`,
                  right: isRTL ? `${idx * 20}%` : 'auto',
                  top: step.row === 'top' ? '8px' : '78px',
                  width: '18%',
                  padding: '10px 8px',
                  textAlign: 'center',
                }}
              >
                <span
                  className={`text-xs font-black tracking-tight text-black/80 sm:text-sm md:text-base ${
                    idx === 0 || idx === 4 ? 'italic' : ''
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ── DevicesHeaderContent Component ──
function DevicesHeaderContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return <DevicesManagementPanel isRTL={isRTL} />;
}

export default function DashboardLostPage() {
  const [currentLanguage, setCurrentLanguage] = useState<'EN' | 'AR'>('EN');
  const [activeTab, setActiveTab] = useState<'overview' | 'myReports' | 'matches' | 'notifications' | 'devices' | 'settings' | 'profile' | 'missing' | 'found' | 'devicesHeader'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuth();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('return:lastDashboard', 'lost');
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab && ['overview', 'myReports', 'notifications', 'devices', 'settings', 'profile', 'missing', 'found', 'devicesHeader'].includes(requestedTab)) {
      setActiveTab(requestedTab as typeof activeTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem('preferred-language') as 'EN' | 'AR' | null;
    if (saved === 'EN' || saved === 'AR') setCurrentLanguage(saved);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'myReports') setActiveTab('myReports');
      if (tab === 'missing') setActiveTab('missing');
      if (tab === 'overview') setActiveTab('overview');
    }
  }, []);

  // Bi-directional language sync - listen for changes from other dashboards
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'preferred-language' && (e.newValue === 'EN' || e.newValue === 'AR')) {
        setCurrentLanguage(e.newValue);
      }
    };

    const handleFocusSync = () => {
      const saved = localStorage.getItem('preferred-language') as 'EN' | 'AR' | null;
      if (saved && (saved === 'EN' || saved === 'AR') && saved !== currentLanguage) {
        setCurrentLanguage(saved);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocusSync);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, [currentLanguage]);

  const toggleLanguage = () => {
    const next = currentLanguage === 'EN' ? 'AR' : 'EN';
    setCurrentLanguage(next);
    localStorage.setItem('preferred-language', next);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/guest-homepage');
    }
  };

  const isRTL = currentLanguage === 'AR';
  const t = translations[currentLanguage];

  const navLinks = [t.navHome, t.navMissing, t.navFound, t.foundMatches, t.navDevices, t.navProfile];
  const sideItems = [
    { label: t.sideMyReports, icon: <FileText className="w-5 h-5" />, onClick: () => setActiveTab('myReports') },
    { label: t.foundMatches, icon: <Search className="w-5 h-5" />, onClick: () => setActiveTab('matches') },
    { label: t.sideNotifications, icon: <Bell className="w-5 h-5" />, onClick: () => setActiveTab('notifications') },
    { label: t.sideDevices, icon: <Monitor className="w-5 h-5" />, onClick: () => setActiveTab('devices') },
    { label: t.sideSettings, icon: <Settings className="w-5 h-5" />, onClick: () => setActiveTab('settings') },
  ];

  const flowSteps = [
    { label: t.submitted, row: 'top' },
    { label: t.published, row: 'bottom' },
    { label: t.alertsSent, row: 'top' },
    { label: t.searching, row: 'bottom' },
    { label: t.matched, row: 'top' },
  ];

  const handleTopNavClick = (index: number) => {
    if (index === 0) setActiveTab('overview');
    if (index === 1) setActiveTab('missing');
    if (index === 2) setActiveTab('found');
    if (index === 3) setActiveTab('matches');
    if (index === 4) setActiveTab('devices');
    if (index === 5) setActiveTab('profile');
    closeMobileMenu();
  };

  const renderSidebarContent = (afterNavigate?: () => void, mobileLayout = false) => (
    <>
      <nav className="mt-2 space-y-2">
        <div
          onClick={() => {
            setActiveTab('overview');
            afterNavigate?.();
          }}
          className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors shadow-lg ${
            activeTab === 'overview'
              ? isRTL
                ? 'rounded-r-full border-r-4 border-white bg-white/25'
                : 'rounded-l-full border-l-4 border-white bg-white/25'
              : isRTL
                ? 'rounded-r-full hover:bg-white/10'
                : 'rounded-l-full hover:bg-white/10'
          }`}
        >
          <Grid className={`h-5 w-5 flex-shrink-0 ${activeTab === 'overview' ? 'text-white' : 'text-white/70'}`} />
          <span className={`truncate text-sm ${activeTab === 'overview' ? 'font-bold text-white' : 'font-medium text-white/70'}`}>
            {t.sideMyDashboard}
          </span>
        </div>

        {sideItems.map((item) => {
          const isItemActive =
            (item.label === t.sideMyReports && activeTab === 'myReports') ||
            (item.label === t.foundMatches && activeTab === 'matches') ||
            (item.label === t.sideNotifications && activeTab === 'notifications') ||
            (item.label === t.sideDevices && activeTab === 'devices') ||
            (item.label === t.sideSettings && activeTab === 'settings');

          return (
            <div
              key={item.label}
              onClick={() => {
                item.onClick();
                afterNavigate?.();
              }}
              className={`group flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                isItemActive
                  ? isRTL
                    ? 'rounded-r-full border-r-4 border-white bg-white/25 shadow-lg'
                    : 'rounded-l-full border-l-4 border-white bg-white/25 shadow-lg'
                  : isRTL
                    ? 'rounded-r-full hover:bg-white/10'
                    : 'rounded-l-full hover:bg-white/10'
              }`}
            >
              <span className={`flex-shrink-0 ${isItemActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className={`truncate text-sm font-medium ${isItemActive ? 'font-bold text-white' : 'text-white/70 group-hover:text-white'}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => {
          void handleLogout();
          afterNavigate?.();
        }}
        className={`flex items-center gap-2 bg-[#014CB3] px-4 py-2 text-white transition-all hover:bg-blue-800 ${
          mobileLayout
            ? 'mt-6 w-full rounded-2xl'
            : `absolute bottom-0 z-20 ${isRTL ? 'right-0 rounded-tl-2xl' : 'left-0 rounded-tr-2xl'}`
        }`}
      >
        <LogOut className={`h-5 w-5 ${isRTL ? '' : 'rotate-180'}`} />
        <span className="text-sm font-bold uppercase tracking-wider">{t.sideLogout}</span>
      </button>
    </>
  );

  return (
    <div
      className="flex flex-col min-h-screen font-sans select-none"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
    >
      {/* ── TOP NAV ── */}
      <nav className="z-50 flex h-16 flex-shrink-0 items-center gap-2 bg-white px-3 shadow-sm md:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Image src="/photos/8.png" alt="RETURN" width={110} height={36} priority />
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center justify-center gap-4 px-1 md:min-w-0 md:gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link}
                href={
                  i === 0
                    ? '/'
                    : i === 1
                      ? '/missing'
                      : i === 2
                        ? '/found-dashboard'
                        : i === 3
                          ? '/lost-dashboard?tab=matches'
                          : i === 4
                            ? '/devices'
                            : '/profile'
                }
                onClick={(e) => {
                  e.preventDefault();
                  handleTopNavClick(i);
                }}
                className={`cursor-pointer whitespace-nowrap pb-1 text-xs font-semibold transition-all sm:text-sm ${
                  (i === 0 && activeTab === 'overview') ||
                  (i === 1 && activeTab === 'missing') ||
                  (i === 2 && activeTab === 'found') ||
                  (i === 3 && activeTab === 'matches') ||
                  (i === 4 && activeTab === 'devices') ||
                  (i === 5 && activeTab === 'profile')
                    ? 'border-b-2 border-[#60C10F] text-[#60C10F]'
                    : 'text-gray-500 hover:text-[#60C10F]'
                }`}
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <button
            onClick={toggleLanguage}
            className="rounded-full border-2 border-[#60C10F] px-3 py-1 text-xs font-bold text-[#60C10F] transition-all hover:bg-[#60C10F] hover:text-white"
          >
            {currentLanguage === 'EN' ? 'AR' : 'EN'}
          </button>
          <UserCircle className="h-9 w-9 flex-shrink-0 text-gray-400 md:h-10 md:w-10" />
          <span className="hidden max-w-[140px] truncate text-sm font-extrabold uppercase tracking-wide text-gray-800 md:inline lg:max-w-none">
            {user?.name?.toUpperCase() || 'RETURN USER'}
          </span>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">

        {/* ── DESKTOP SIDEBAR ── */}
        <aside
          className="relative hidden flex-shrink-0 bg-gradient-to-b from-[#014CB3] to-[#60C10F] md:flex"
          style={{ width: 'clamp(180px, 16vw, 240px)' }}
        >
          <div className="relative flex flex-1 flex-col overflow-hidden px-2 py-6">
            {renderSidebarContent()}
          </div>
        </aside>

        <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobileMenu} isRTL={isRTL}>
          <div className="px-3 py-4">{renderSidebarContent(closeMobileMenu, true)}</div>
        </MobileNavDrawer>

        {/* ── MAIN ── */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-10 ${
          activeTab === 'profile'
            ? 'bg-gradient-to-br from-[#60C10F]/60 to-[#014CB3]/60'
            : 'bg-gradient-to-br from-[#014CB3] to-[#60C10F]'
        }`}>

          {/* Header Row - Not shown for profile */}
          {activeTab !== 'profile' && (
            <div className="mb-10 flex items-center justify-between border-b border-white/25 pb-4 text-white">
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.myDashboard}</h1>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xl font-medium md:text-2xl">{t.hello}</span>
                <span className="text-xl font-extrabold text-[#002e6d] drop-shadow-sm md:text-2xl">
                  {(user?.name?.split(' ')[0] || 'RETURN').toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Conditional Content based on Active Tab */}
          {activeTab === 'overview' ? (
            <OverviewContent t={t} isRTL={isRTL} flowSteps={flowSteps} router={router} setActiveTab={setActiveTab} />
          ) : activeTab === 'missing' ? (
            <MissingContent t={t} isRTL={isRTL} />
          ) : activeTab === 'found' ? (
            <FoundContent t={t} isRTL={isRTL} />
          ) : activeTab === 'myReports' ? (
            <MyReportsContent t={t} isRTL={isRTL} />
          ) : activeTab === 'matches' ? (
            <MatchesContent t={t} isRTL={isRTL} />
          ) : activeTab === 'notifications' ? (
            <NotificationsContent t={t} isRTL={isRTL} />
          ) : activeTab === 'devices' ? (
            <DevicesContent t={t} isRTL={isRTL} />
          ) : activeTab === 'devicesHeader' ? (
            <DevicesHeaderContent t={t} isRTL={isRTL} />
          ) : activeTab === 'settings' ? (
            <SettingsContent t={t} isRTL={isRTL} />
          ) : activeTab === 'profile' ? (
            <ProfileContent t={t} isRTL={isRTL} />
          ) : null}

        </main>
      </div>
    </div>
  );
}