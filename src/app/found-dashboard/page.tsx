'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  FileText, Grid,
  UserCircle, Bell, Monitor, Settings, LogOut,
  Search, SlidersHorizontal, ImageIcon, Clock, ChevronDown, Save, X,
  MapPinned
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';
import { CaseCollectionSection } from '@/components/dashboard/CaseCollectionSection';
import { DevicesManagementPanel } from '@/components/dashboard/DevicesManagementPanel';
import { ProfileSettingsPanel } from '@/components/dashboard/ProfileSettingsPanel';
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
    sideHistory: 'History & Geofencing',
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
    view: 'view',
    markAllRead: 'Mark all as read',
    email: 'Email',
    tabAll: 'All',
    tabAlerts: 'Alerts',
    tabMessages: 'Messages',
    tabSystem: 'System',
    minutesAgo: 'Minutes ago',
    qrTitle: 'QR Scanner',
    qrDesc: 'Scan a QR code attached to an item to view its Identification profile',
    qrBtn: 'Scan QR',
    nfcTitle: 'NFC Scanner',
    nfcDesc: 'Tap your phone near an NFC bracelet to read the identification profile',
    nfcBtn: 'Scan NFC',
    gpsTitle: 'GPS',
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
    settingsTitle: 'Settings',
    secNotifications: 'Notifications',
    matchAlerts: 'Match Alerts',
    ownerMessages: 'Owner Messages',
    locationRequests: 'Location Requests',
    nearbyAlerts: 'Nearby Alerts',
    emailNotification: 'Email Notification',
    secDevicePrefs: 'Device Preferences',
    enableQRScanner: 'Enable QR Scanner',
    enableNFCScanner: 'Enable NFC Scanner',
    enableBluetooth: 'Enable Bluetooth proximity assist',
    enableWifi: 'Enable Wi-Fi indoor assist',
    allowLocationSharing: 'Allow location sharing',
    autoOpenProfile: 'Auto-open identification profile after scan',
    secPrivacy: 'Privacy',
    allowOwnerContact: 'Allow owner to see your contact number',
    allowSharingInfo: 'Allow sharing information during contact',
    secSystem: 'System',
    allowSystemAnalysis: 'Allow system analysis',
    every5min: 'Every 5 min',
    every10min: 'Every 10 min',
    every30min: 'Every 30 min',
    saveSettings: 'Save settings',
    settingsSaved: 'Settings saved successfully.',
    settingsHint: 'Bluetooth and Wi-Fi are controlled here as optional finder-side channels, not as separate devices.',
    notifs: [
      { title: 'Possible', highlight: 'Match', titleEnd: ' Found', sub: 'AI detected a', subHighlight: 'match for', subEnd: ' Ahmed Ali', btn: 'View Details', btnType: 'green' },
      { title: 'Nearby', highlight: 'Scan', titleEnd: ' Detected', sub: 'Bracelet Scanned near', subHighlight: 'Nasr City', subEnd: '', btn: 'View Location', btnType: 'green' },
      { title: 'New', highlight: 'Message', titleEnd: '', sub: 'Finder', subHighlight: 'sent', subEnd: ' you a message', btn: 'Open Chat', btnType: 'green' },
      { title: 'Possible', highlight: 'Match', titleEnd: ' Found', sub: 'AI detected a', subHighlight: 'match for', subEnd: ' Eyad Ahmed', btn: 'View Details', btnType: 'green' },
    ],
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
    editProfile: 'Edit Profile',
    saveProfile: 'Save Profile',
    cancel: 'Cancel',
    itemsFound: 'Item Found',
    possibleMatches: 'Possible Matches',
    identifyFoundItem: 'Identify Found Item',
    scanWithCamera: 'SCAN WITH CAMERA',
    detectUsingAI: 'DETECT USING AI RECOGNIZATION',
    scanQRCode: 'SCAN QR CODE',
    scanQRTag: 'SCAN QR TAG ATTACHED TO ITEM',
    tapNFCTag: 'TAP NFC TAG',
    holdPhoneNear: 'HOLD PHONE NEAR NFC BRACELET',
    approxInfo: 'Approx. info',
    foundAt: 'Found at',
    founderNotifs: [
      { title: 'Owner', highlight: 'Contacted', titleEnd: ' You', sub: 'Ahmed Ali sent you a', subHighlight: 'location request', subEnd: ' for their lost item', btn: 'Respond', btnType: 'blue' },
      { title: 'New', highlight: 'Match', titleEnd: ' Request', sub: 'AI detected your found item might', subHighlight: 'match', subEnd: ' Sarah Mohamed\'s case', btn: 'Review Match', btnType: 'green' },
      { title: 'Location', highlight: 'Shared', titleEnd: ' Successfully', sub: 'Your location was', subHighlight: 'shared with', subEnd: ' item owner', btn: 'View Details', btnType: 'green' },
      { title: 'Thank', highlight: 'You', titleEnd: ' Message', sub: 'Omar Hassan sent a', subHighlight: 'thank you', subEnd: ' message for finding their item', btn: 'Read Message', btnType: 'green' },
    ],
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
    sideHistory: 'سجل التتبع والسياج الجغرافي',
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
    view: 'عرض',
    markAllRead: 'تعيين الكل كمقروء',
    email: 'البريد الإلكتروني',
    tabAll: 'الكل',
    tabAlerts: 'تنبيهات',
    tabMessages: 'رسائل',
    tabSystem: 'النظام',
    minutesAgo: 'دقائق مضت',
    qrTitle: 'ماسح QR',
    qrDesc: 'امسح رمز QR المرفق بعنصر لعرض ملف التعريف الخاص به',
    qrBtn: 'مسح QR',
    nfcTitle: 'ماسح NFC',
    nfcDesc: 'اضغط بهاتفك بالقرب من سوار NFC لقراءة ملف التعريف',
    nfcBtn: 'مسح NFC',
    gpsTitle: 'GPS',
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
    settingsTitle: 'الإعدادات',
    secNotifications: 'الإشعارات',
    matchAlerts: 'تنبيهات التطابق',
    ownerMessages: 'رسائل المالك',
    locationRequests: 'طلبات الموقع',
    nearbyAlerts: 'التنبيهات القريبة',
    emailNotification: 'إشعار البريد',
    secDevicePrefs: 'تفضيلات الجهاز',
    enableQRScanner: 'تفعيل ماسح QR',
    enableNFCScanner: 'تفعيل ماسح NFC',
    enableBluetooth: 'تفعيل المساعدة عبر Bluetooth',
    enableWifi: 'تفعيل المساعدة عبر Wi-Fi',
    allowLocationSharing: 'السماح بمشاركة الموقع',
    autoOpenProfile: 'فتح ملف التعريف تلقائيًا بعد المسح',
    secPrivacy: 'الخصوصية',
    allowOwnerContact: 'السماح للمالك برؤية رقم الاتصال الخاص بك',
    allowSharingInfo: 'السماح بمشاركة المعلومات أثناء الاتصال',
    secSystem: 'النظام',
    allowSystemAnalysis: 'السماح بتحليل النظام',
    every5min: 'كل 5 دقائق',
    every10min: 'كل 10 دقائق',
    every30min: 'كل 30 دقيقة',
    saveSettings: 'حفظ الإعدادات',
    settingsSaved: 'تم حفظ الإعدادات بنجاح.',
    settingsHint: 'Bluetooth و Wi-Fi يتم التحكم بهما من هنا كقنوات مساعدة للباحث، وليس كأجهزة مستقلة.',
    notifs: [
      { title: 'تطابق', highlight: 'محتمل', titleEnd: ' تم العثور عليه', sub: 'اكتشف الذكاء الاصطناعي', subHighlight: 'تطابقاً لـ', subEnd: ' أحمد علي', btn: 'عرض التفاصيل', btnType: 'green' },
      { title: 'إشارة', highlight: 'قريبة', titleEnd: ' رُصدت', sub: 'تم مسح السوار بالقرب من', subHighlight: 'مدينة نصر', subEnd: '', btn: 'عرض الموقع', btnType: 'green' },
      { title: 'رسالة', highlight: 'جديدة', titleEnd: '', sub: 'أرسل إليك', subHighlight: 'الباحث', subEnd: ' رسالة', btn: 'فتح المحادثة', btnType: 'green' },
      { title: 'تطابق', highlight: 'محتمل', titleEnd: ' تم العثور عليه', sub: 'اكتشف الذكاء الاصطناعي', subHighlight: 'تطابقاً لـ', subEnd: ' إياد أحمد', btn: 'عرض التفاصيل', btnType: 'green' },
    ],
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
    editProfile: 'تعديل الملف',
    saveProfile: 'حفظ الملف',
    cancel: 'إلغاء',
    itemsFound: 'عنصر موجود',
    possibleMatches: 'تطابقات محتملة',
    identifyFoundItem: 'تحديد العنصر الموجود',
    scanWithCamera: 'المسح بالكاميرا',
    detectUsingAI: 'الكشف باستخدام التعرف بالذكاء الاصطناعي',
    scanQRCode: 'مسح رمز الاستجابة السريعة',
    scanQRTag: 'مسح علامة QR المرفقة بالعنصر',
    tapNFCTag: 'انقر على علامة NFC',
    holdPhoneNear: 'أمسك الهاتف بالقرب من سوار NFC',
    approxInfo: 'معلومات تقريبية',
    foundAt: 'موجود في',
    founderNotifs: [
      { title: 'المالك', highlight: 'تواصل', titleEnd: ' معك', sub: 'أحمد علي أرسل لك', subHighlight: 'طلب موقع', subEnd: ' لعنصره المفقود', btn: 'الرد', btnType: 'blue' },
      { title: 'طلب', highlight: 'تطابق', titleEnd: ' جديد', sub: 'اكتشف الذكاء الاصطناعي أن عنصرك الموجود قد', subHighlight: 'يطابق', subEnd: ' حالة سارة محمد', btn: 'مراجعة التطابق', btnType: 'green' },
      { title: 'تم', highlight: 'مشاركة', titleEnd: ' الموقع', sub: 'تم', subHighlight: 'مشاركة موقعك مع', subEnd: ' مالك العنصر', btn: 'عرض التفاصيل', btnType: 'green' },
      { title: 'رسالة', highlight: 'شكر', titleEnd: '', sub: 'عمر حسن أرسل رسالة', subHighlight: 'شكر', subEnd: ' لك لإيجاد عنصره', btn: 'قراءة الرسالة', btnType: 'green' },
    ],
  },
};

const dummyReports = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const MINUTES = [2, 10, 13, 20];

// ── SETTINGS COMPONENTS ──
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none border-2 ${
        on ? 'bg-[#014CB3] border-[#014CB3]' : 'bg-white/20 border-white/30'
      }`}
    >
      <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${on ? 'translate-x-7' : 'translate-x-1'}`} />
      <span className={`absolute text-[9px] font-black tracking-widest ${on ? 'left-1.5 text-white' : 'right-1.5 text-white/70'}`}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between bg-white/15 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20">
      <span className="text-white/90 text-sm font-medium">{label}</span>
      <Toggle on={value} onChange={onChange} />
    </div>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void; }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={`flex items-center justify-between bg-white/15 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20 relative ${open ? 'z-[100]' : 'z-10'}`}>
      <span className="text-white/90 text-sm font-medium">{label}</span>
      <div className="relative" ref={dropdownRef}>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 bg-white/20 border border-white/30 rounded-lg px-3 py-1 text-white text-xs font-semibold hover:bg-white/30 transition-all">
          {value}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute right-0 top-8 bg-[#014CB3] border border-white/20 rounded-xl shadow-xl z-[110] overflow-hidden min-w-[120px]">
            {options.map((opt) => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className="block w-full text-left px-4 py-2 text-white text-xs hover:bg-white/20 transition-all">
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
      description="Review all active missing reports so the finder side can compare people, items, and locations quickly."
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
      emptyBody="Newly submitted missing reports will appear here automatically for the finder workflow."
    />
  );
}

// ── Found Component ──
function FoundContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.navFound}
      description="Browse the full list of found reports, compare statuses, and open detailed case pages from the finder dashboard."
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
      emptyBody="Once finders create reports, they will appear here with their current match status."
    />
  );
}

// ── My Reports Component ──
function MyReportsContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.myReports}
      description="These are the found reports created by your current account, loaded directly from the backend."
      scope="my"
      caseType="FOUND"
      isRTL={isRTL}
      addReportHref="/report-missing?mode=found"
      addReportLabel="+ Add found report"
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
      emptyTitle="No found reports yet"
      emptyBody="Create a found report and it will appear here instantly for follow-up and matching."
    />
  );
}


function MatchesContent({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <CaseCollectionSection
      title={t.foundMatches}
      description="Potential matches with 85% confidence or more appear here first, and confirmed final matches stay here for follow-up."
      scope="my"
      caseType="FOUND"
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
      emptyBody="When you confirm a final match from the case details page, the found report will move here automatically."
    />
  );
}

// ── Single Report Card ──
function ReportCard({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <div className="bg-white/20 backdrop-blur-lg rounded-3xl border border-white/30 shadow-2xl overflow-hidden flex flex-col">
      <div className="bg-white/30 mx-4 mt-4 rounded-2xl flex flex-col items-center justify-center py-8 gap-2 border border-white/20">
        <ImageIcon className="w-10 h-10 text-gray-500/60" />
        <span className="text-gray-600/70 text-base font-semibold tracking-wide">photo</span>
      </div>
      <div className="px-6 py-4 space-y-2 flex-1">
        {[t.name, t.age, t.lastSeen].map((label) => (
          <div key={label} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-white font-semibold text-sm w-20 flex-shrink-0 text-left" style={{ textAlign: isRTL ? 'right' : 'left' }}>{label}</span>
            <div className="flex-1 h-4 bg-white/25 rounded-full border border-white/20" />
          </div>
        ))}
      </div>
      <div className="px-6 pb-5 flex justify-center">
        <button className="px-10 py-2 bg-white/30 backdrop-blur-md text-white font-bold text-sm rounded-full border border-white/40 hover:bg-white/50 transition-all shadow-md">
          {t.view}
        </button>
      </div>
    </div>
  );
}

// ── Found Report Card ──
function FoundReportCard({ t, isRTL }: { t: typeof translations['EN']; isRTL: boolean }) {
  return (
    <div className="bg-white/20 backdrop-blur-lg rounded-3xl border border-white/30 shadow-2xl overflow-hidden flex flex-col">
      <div className="bg-white/30 mx-4 mt-4 rounded-2xl flex flex-col items-center justify-center py-8 gap-2 border border-white/20">
        <ImageIcon className="w-10 h-10 text-gray-500/60" />
        <span className="text-gray-600/70 text-base font-semibold tracking-wide">photo</span>
      </div>
      <div className="px-6 py-4 space-y-2 flex-1">
        {[t.approxInfo, t.foundAt].map((label) => (
          <div key={label} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-white font-semibold text-sm w-20 flex-shrink-0 text-left" style={{ textAlign: isRTL ? 'right' : 'left' }}>{label}</span>
            <div className="flex-1 h-4 bg-white/25 rounded-full border border-white/20" />
          </div>
        ))}
      </div>
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
        console.warn('Unable to load finder notifications', error);
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

  const filteredItems = items.filter((item) => {
    if (activeNotificationTab === 0) return true;
    const type = String(item.type || '').toLowerCase();
    if (activeNotificationTab === 1) return type.includes('match') || type.includes('scan') || type.includes('alert') || type.includes('case');
    if (activeNotificationTab === 2) return type.includes('message') || type.includes('chat');
    return !(type.includes('message') || type.includes('chat') || type.includes('match') || type.includes('scan') || type.includes('alert'));
  });

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
      <div className="flex justify-between items-center px-2 py-4 border-b border-white/20 mb-6">
        <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">{t.notifications}</h2>
        <button onClick={markAllRead} className="bg-[#014CB3] hover:bg-blue-800 text-white text-xs font-bold px-5 py-2 rounded-full transition-all shadow-lg">
          {t.markAllRead}
        </button>
      </div>
      <div className={`flex items-center gap-0 px-2 pt-1 pb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {tabs.map((tab, i) => (
          <React.Fragment key={tab}>
            <button onClick={() => setActiveNotificationTab(i)} className={`text-sm font-bold px-1 pb-1 transition-all ${activeNotificationTab === i ? 'text-white border-b-2 border-white' : 'text-white/60 hover:text-white'}`}>
              {tab}
            </button>
            {i < tabs.length - 1 && <span className="text-white/40 mx-3 font-light text-lg">/</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="px-2 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white/10 rounded-3xl border border-white/15 h-28 animate-pulse" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <div key={item.id} className={`bg-white/15 backdrop-blur-md rounded-2xl border shadow-lg px-6 py-4 flex items-center justify-between gap-4 ${item.isRead ? 'border-white/10' : 'border-white/25'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base mb-1">{item.title}</p>
                <p className="text-white/70 text-sm mb-2">{item.body}</p>
                <div className="flex items-center gap-1 text-white/50 text-xs"><Clock className="w-3 h-3" /><span>{new Date(item.createdAt).toLocaleString()}</span></div>
              </div>
              {item.actionUrl ? (
                <button onClick={() => { window.location.href = item.actionUrl; }} className="flex-shrink-0 bg-[#60C10F] hover:bg-[#4da00b] text-white text-xs font-bold px-4 py-2 rounded-full transition-all shadow-md whitespace-nowrap">
                  Open
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div className="text-center text-white/70 py-20 border border-white/20 rounded-2xl">No notifications yet.</div>
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
  const [ownerMessages, setOwnerMessages] = useState(true);
  const [locationRequests, setLocationRequests] = useState(false);
  const [nearbyAlerts, setNearbyAlerts] = useState(false);
  const [emailNotif, setEmailNotif] = useState(false);
  const [enableQRScanner, setEnableQRScanner] = useState(true);
  const [enableNFCScanner, setEnableNFCScanner] = useState(true);
  const [enableBluetooth, setEnableBluetooth] = useState(true);
  const [enableWifi, setEnableWifi] = useState(true);
  const [allowLocationShare, setAllowLocationShare] = useState(true);
  const [autoOpenProfile, setAutoOpenProfile] = useState(false);
  const [allowOwnerContact, setAllowOwnerContact] = useState(true);
  const [allowSharingInfo, setAllowSharingInfo] = useState(true);
  const [allowSystemAnalysis, setAllowSystemAnalysis] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setMatchAlerts(Boolean(user.preference.matchAlerts));
    setOwnerMessages(Boolean(user.preference.ownerMessages));
    setLocationRequests(Boolean(user.preference.locationRequests));
    setNearbyAlerts(Boolean(user.preference.nearbyAlerts));
    setEmailNotif(Boolean(user.preference.notificationsEnabled));
    setEnableQRScanner(Boolean(user.preference.enableQr));
    setEnableNFCScanner(Boolean(user.preference.enableNfc));
    setEnableBluetooth(Boolean(user.preference.enableBluetooth));
    setEnableWifi(Boolean(user.preference.enableWifi));
    setAllowLocationShare(Boolean(user.preference.allowEmergencyLocation));
    setAutoOpenProfile(Boolean(user.preference.autoOpenProfile));
    setAllowOwnerContact(Boolean(user.preference.showContactToFinder));
    setAllowSharingInfo(!user.preference.hideSensitiveDetails);
    setAllowSystemAnalysis(Boolean(user.preference.systemAnalysis));
  }, [user]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateMe({
        preference: {
          matchAlerts,
          ownerMessages,
          locationRequests,
          nearbyAlerts,
          notificationsEnabled: emailNotif,
          enableQr: enableQRScanner,
          enableNfc: enableNFCScanner,
          enableBluetooth,
          enableWifi,
          allowEmergencyLocation: allowLocationShare,
          autoOpenProfile,
          showContactToFinder: allowOwnerContact,
          hideSensitiveDetails: !allowSharingInfo,
          systemAnalysis: allowSystemAnalysis
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
      <div className="px-8 py-4 border-b border-white/20">
        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight italic">{t.settingsTitle}</h1>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-visible">
        <div className="space-y-6 overflow-visible">
          <div className="overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secNotifications}</h2>
            <div className="space-y-3 overflow-visible">
              <SettingRow label={t.matchAlerts} value={matchAlerts} onChange={() => setMatchAlerts(!matchAlerts)} />
              <SettingRow label={t.ownerMessages} value={ownerMessages} onChange={() => setOwnerMessages(!ownerMessages)} />
              <SettingRow label={t.locationRequests} value={locationRequests} onChange={() => setLocationRequests(!locationRequests)} />
              <SettingRow label={t.nearbyAlerts} value={nearbyAlerts} onChange={() => setNearbyAlerts(!nearbyAlerts)} />
              <SettingRow label={t.emailNotification} value={emailNotif} onChange={() => setEmailNotif(!emailNotif)} />
            </div>
          </div>
          <div className="overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secPrivacy}</h2>
            <div className="space-y-3 overflow-visible">
              <SettingRow label={t.allowOwnerContact} value={allowOwnerContact} onChange={() => setAllowOwnerContact(!allowOwnerContact)} />
              <SettingRow label={t.allowSharingInfo} value={allowSharingInfo} onChange={() => setAllowSharingInfo(!allowSharingInfo)} />
            </div>
          </div>
        </div>
        <div className="space-y-6 overflow-visible">
          <div className="overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secDevicePrefs}</h2>
            <div className="space-y-3 overflow-visible">
              <SettingRow label={t.enableQRScanner} value={enableQRScanner} onChange={() => setEnableQRScanner(!enableQRScanner)} />
              <SettingRow label={t.enableNFCScanner} value={enableNFCScanner} onChange={() => setEnableNFCScanner(!enableNFCScanner)} />
              <SettingRow label={t.enableBluetooth} value={enableBluetooth} onChange={() => setEnableBluetooth(!enableBluetooth)} />
              <SettingRow label={t.enableWifi} value={enableWifi} onChange={() => setEnableWifi(!enableWifi)} />
              <SettingRow label={t.allowLocationSharing} value={allowLocationShare} onChange={() => setAllowLocationShare(!allowLocationShare)} />
              <SettingRow label={t.autoOpenProfile} value={autoOpenProfile} onChange={() => setAutoOpenProfile(!autoOpenProfile)} />
              <p className="text-xs text-white/60 leading-6">{t.settingsHint}</p>
            </div>
          </div>
          <div className="space-y-3 overflow-visible">
            <h2 className="text-white/80 font-bold text-base mb-3 italic">{t.secSystem}</h2>
            <SettingRow label={t.allowSystemAnalysis} value={allowSystemAnalysis} onChange={() => setAllowSystemAnalysis(!allowSystemAnalysis)} />
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
function OverviewContent({ t, isRTL, flowSteps }: {
  t: typeof translations['EN'];
  isRTL: boolean;
  flowSteps: Array<{ label: string; row: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const response = await api.dashboardSummary();
        if (!cancelled) setSummary(response);
      } catch (error) {
        console.warn('Unable to load finder dashboard summary', error);
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
    { val: summary?.stats?.foundReports ?? 0, label: t.itemsFound },
    { val: summary?.stats?.matchedReports ?? 0, label: t.possibleMatches },
    { val: summary?.stats?.unreadNotifications ?? 0, label: t.notifications },
  ];

  return (
    <>
      <section className="mb-10">
        <div className="flex justify-between items-center mb-8 border-b border-white/25 pb-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{t.myDashboard}</h2>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
             <span className="text-xl md:text-2xl font-medium text-white">{t.hello}</span>
             <span className="text-xl md:text-2xl font-extrabold text-[#002e6d] drop-shadow-sm">{(user?.name?.split(' ')[0] || 'RETURN').toUpperCase()}</span>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">{t.stats}</h2>
        <div className="flex justify-center gap-6 flex-wrap">
          {(loading ? [
            { val: '…', label: t.itemsFound },
            { val: '…', label: t.possibleMatches },
            { val: '…', label: t.notifications },
          ] : stats).map((stat, i) => (
            <div key={i} className="bg-white/20 backdrop-blur-lg rounded-[2rem] flex flex-col items-center justify-center border border-white/30 shadow-2xl" style={{ width: 'clamp(130px, 15vw, 190px)', height: 'clamp(130px, 15vw, 190px)' }}>
              <span className="font-black text-white mb-1" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>{stat.val}</span>
              <span className="text-xs md:text-sm font-bold text-white uppercase tracking-tight text-center px-2">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {isAdminUser(user) ? (
        <section className="mb-10 max-w-5xl mx-auto">
          <AdminQuickActions locale={isRTL ? 'AR' : 'EN'} compact />
        </section>
      ) : null}

      <section className="mb-10">
        <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">{t.identifyFoundItem}</h2>
        <div className="flex justify-center gap-6 flex-wrap">
          <button onClick={() => router.push('/found-dashboard/scan-qr')} className="px-8 py-5 bg-[#014CB3] text-white rounded-2xl border-b-[6px] border-[#002e6d] active:border-b-0 active:translate-y-1 transition-all shadow-xl flex flex-col items-center min-w-[240px]">
            <span className="text-lg md:text-xl font-black uppercase tracking-wide">{t.scanQRCode}</span>
            <span className="text-xs md:text-sm font-medium mt-1">{t.scanQRTag}</span>
          </button>
          <button onClick={() => router.push('/lost-dashboard/nfc')} className="px-8 py-5 bg-[#014CB3] text-white rounded-2xl border-b-[6px] border-[#002e6d] active:border-b-0 active:translate-y-1 transition-all shadow-xl flex flex-col items-center min-w-[240px]">
            <span className="text-lg md:text-xl font-black uppercase tracking-wide">{t.tapNFCTag}</span>
            <span className="text-xs md:text-sm font-medium mt-1">{t.holdPhoneNear}</span>
          </button>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'myReports' | 'matches' | 'notifications' | 'devices' | 'history' | 'settings' | 'profile' | 'missing' | 'found' | 'devicesHeader'>('overview');
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('return:lastDashboard', 'found');
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab && ['overview', 'myReports', 'notifications', 'devices', 'history', 'settings', 'profile', 'missing', 'found', 'devicesHeader'].includes(requestedTab)) {
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
  }, []);

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

  // 🔴 التعديل الأساسي هنا: رجعنا الروابط تشتغل عن طريق الـ activeTab في نفس الصفحة
  const navItems = [
    { label: t.navHome, tab: 'overview' },
    { label: t.navMissing, tab: 'missing' },
    { label: t.navFound, tab: 'found' },
    { label: t.possibleMatches, tab: 'matches' },
    { label: t.navDevices, tab: 'devices' },
    { label: t.navProfile, tab: 'profile' }
  ];

  const sideItems = [
    { label: t.sideMyReports, icon: <FileText className="w-5 h-5" />, onClick: () => setActiveTab('myReports') },
    { label: t.possibleMatches, icon: <Search className="w-5 h-5" />, onClick: () => setActiveTab('matches') },
    { label: t.sideNotifications, icon: <Bell className="w-5 h-5" />, onClick: () => setActiveTab('notifications') },
    { label: t.sideDevices, icon: <Monitor className="w-5 h-5" />, onClick: () => setActiveTab('devices') },
    { label: t.sideHistory, icon: <MapPinned className="w-5 h-5" />, onClick: () => setActiveTab('history') },
    { label: t.sideSettings, icon: <Settings className="w-5 h-5" />, onClick: () => setActiveTab('settings') },
  ];

  const flowSteps = [
    { label: t.submitted, row: 'top' },
    { label: t.published, row: 'bottom' },
    { label: t.alertsSent, row: 'top' },
    { label: t.searching, row: 'bottom' },
    { label: t.matched, row: 'top' },
  ];

  return (
    <div
      className="flex flex-col min-h-screen font-sans select-none"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
    >
      {/* ── TOP NAV ── */}
      <nav className="h-16 bg-white flex items-center justify-between px-6 z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center">
          <Image src="/photos/8.png" alt="RETURN" width={110} height={36} priority />
        </div>

        {/* تم تحويلها لأزرار عادية (button) بتغير الـ Tab بدلاً من نقلك لصفحة أخرى */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.tab as any)}
                className={`text-sm font-semibold transition-all pb-1 cursor-pointer ${
                  isActive
                    ? 'text-[#60C10F] border-b-2 border-[#60C10F]'
                    : 'text-gray-500 hover:text-[#60C10F]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="text-xs font-bold px-3 py-1 rounded-full border-2 border-[#60C10F] text-[#60C10F] hover:bg-[#60C10F] hover:text-white transition-all"
          >
            {currentLanguage === 'EN' ? 'AR' : 'EN'}
          </button>
          <UserCircle className="w-10 h-10 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-extrabold text-gray-800 uppercase tracking-wide whitespace-nowrap">
            {user?.name?.toUpperCase() || 'RETURN USER'}
          </span>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ── */}
        <aside className="relative flex-shrink-0 bg-gradient-to-b from-[#014CB3] to-[#60C10F] flex" style={{ width: 'clamp(180px, 16vw, 240px)' }}>
          <div className="flex-1 flex flex-col py-6 px-2 relative overflow-hidden">
            <nav className="space-y-2 mt-2">
              <div
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors shadow-lg ${
                  activeTab === 'overview'
                    ? isRTL ? 'bg-white/25 border-white border-r-4 rounded-r-full' : 'bg-white/25 border-white border-l-4 rounded-l-full'
                    : isRTL ? 'hover:bg-white/10 rounded-r-full' : 'hover:bg-white/10 rounded-l-full'
                }`}
              >
                <Grid className={`w-5 h-5 flex-shrink-0 ${activeTab === 'overview' ? 'text-white' : 'text-white/70'}`} />
                <span className={`text-sm truncate ${activeTab === 'overview' ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>{t.sideMyDashboard}</span>
              </div>
              {sideItems.map((item) => (
                <div
                  key={item.label}
                  onClick={item.onClick}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors group ${
                    (item.label === t.sideMyReports && activeTab === 'myReports') ||
                    (item.label === t.possibleMatches && activeTab === 'matches') ||
                    (item.label === t.sideNotifications && activeTab === 'notifications') ||
                    (item.label === t.sideDevices && activeTab === 'devices') ||
                    (item.label === t.sideHistory && activeTab === 'history') ||
                    (item.label === t.sideSettings && activeTab === 'settings')
                      ? isRTL ? 'bg-white/25 border-white border-r-4 rounded-r-full shadow-lg' : 'bg-white/25 border-white border-l-4 rounded-l-full shadow-lg'
                      : isRTL ? 'hover:bg-white/10 rounded-r-full' : 'hover:bg-white/10 rounded-l-full'
                  }`}
                >
                  <span className={`flex-shrink-0 ${
                    (item.label === t.sideMyReports && activeTab === 'myReports') ||
                    (item.label === t.possibleMatches && activeTab === 'matches') ||
                    (item.label === t.sideNotifications && activeTab === 'notifications') ||
                    (item.label === t.sideDevices && activeTab === 'devices') ||
                    (item.label === t.sideHistory && activeTab === 'history') ||
                    (item.label === t.sideSettings && activeTab === 'settings')
                      ? 'text-white' : 'text-white/70 group-hover:text-white'
                  }`}>{item.icon}</span>
                  <span className={`font-medium text-sm truncate ${
                    (item.label === t.sideMyReports && activeTab === 'myReports') ||
                    (item.label === t.possibleMatches && activeTab === 'matches') ||
                    (item.label === t.sideNotifications && activeTab === 'notifications') ||
                    (item.label === t.sideDevices && activeTab === 'devices') ||
                    (item.label === t.sideHistory && activeTab === 'history') ||
                    (item.label === t.sideSettings && activeTab === 'settings')
                      ? 'text-white font-bold' : 'text-white/70 group-hover:text-white'
                  }`}>{item.label}</span>
                </div>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className={`absolute bottom-0 bg-[#014CB3] text-white px-4 py-2 flex items-center gap-2 hover:bg-blue-800 transition-all z-20 ${
                isRTL ? 'right-0 rounded-tl-2xl' : 'left-0 rounded-tr-2xl'
              }`}
            >
              <LogOut className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
              <span className="font-bold text-sm uppercase tracking-wider">{t.sideLogout}</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className={`flex-1 p-6 md:p-10 overflow-y-auto ${
          activeTab === 'profile'
            ? 'bg-gradient-to-br from-[#60C10F]/60 to-[#014CB3]/60'
            : 'bg-gradient-to-br from-[#014CB3] to-[#60C10F]'
        }`}>

          {activeTab === 'overview' ? (
            <OverviewContent t={t} isRTL={isRTL} flowSteps={flowSteps} />
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
          ) : activeTab === 'history' ? (
            <div className="-m-6 md:-m-10 h-full">
              <iframe
                src="/tracking/history"
                className="w-full h-full border-0 rounded-xl"
                style={{ minHeight: 'calc(100vh - 140px)' }}
              />
            </div>
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