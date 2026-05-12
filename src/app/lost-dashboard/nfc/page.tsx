"use client";

import React, { useState } from 'react';
import { ShieldCheck, Search, Phone, ChevronRight, CreditCard } from 'lucide-react';

export default function LostDashboardNFC() {
  const [currentScreen, setCurrentScreen] = useState('start'); // 'start' أو 'reading'

  // دالة الانتقال لصفحة البحث
  const handleStartReading = () => {
    setCurrentScreen('reading');
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans overflow-hidden">
      {/* شريط التنقل العلوي - Header */}
      <header className="h-20 bg-white border-b flex items-center justify-between px-6 md:px-20 shrink-0 z-50">
        <div className="flex items-center gap-1">
          <span className="text-3xl font-black text-[#0052cc] tracking-tighter italic">Re</span>
          <div className="w-8 h-8 bg-[#89d82d] rounded-full flex items-center justify-center mx-0.5">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <span className="text-3xl font-black text-[#89d82d] tracking-tighter italic">turn</span>
        </div>

        <nav className="hidden lg:flex items-center gap-10">
          <NavLink label="Home" active />
          <NavLink label="Missing" />
          <NavLink label="Found" />
          <NavLink label="Devices" />
          <NavLink label="Profile" />
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-800 tracking-tight">Alaa.Ahmed</p>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100" 
            className="w-12 h-12 rounded-full border-2 border-slate-100" 
            alt="User"
          />
        </div>
      </header>

      {/* المحتوى الرئيسي - الخلفية المتدرجة */}
      <main className="flex-1 relative bg-gradient-to-br from-[#89d82d] via-[#1a6edb] to-[#0052cc]">
        
        {currentScreen === 'start' ? (
          /* --- الشاشة الأولى: صفحة بدء القراءة --- */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            <h1 className="absolute top-10 left-10 text-white text-3xl font-black drop-shadow-lg">
              Tap <span className="text-[#0052cc]">NFC</span> Tag
            </h1>

            {/* الرسم التوضيحي (استبدال بمجلد الصور المحلي) */}
            <div className="relative w-full max-w-lg h-64 flex items-center justify-center mb-10">
              <img src="/photos/Nfc%20image.png" alt="NFC illustration" className="object-contain w-full h-full max-h-64" />
            </div>

            <div className="max-w-md">
              <p className="text-white text-2xl font-black mb-10 leading-snug drop-shadow-md">
                Hold your phone near the <span className="text-[#89d82d]">NFC</span> tag to read the identification profile
              </p>
              
              <button 
                onClick={handleStartReading}
                className="bg-[#89d82d] hover:bg-[#78bc27] text-white px-14 py-4 rounded-2xl text-2xl font-black shadow-[0_10px_0_0_#4a8a1a] active:shadow-none active:translate-y-2 transition-all"
              >
                Start Reading
              </button>
            </div>
          </div>
        ) : (
          /* --- الشاشة الثانية: صفحة البحث مع الدائرة الدوارة --- */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
            <h1 className="absolute top-10 left-10 text-white text-3xl font-black drop-shadow-lg">
              Tap <span className="text-[#0052cc]">NFC</span> Tag
            </h1>

            {/* الأنيميشن الدائري المطلوب */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 mb-16">
              {/* الدائرة الأساسية الرمادية الباهتة */}
              <div className="absolute inset-0 border-[22px] border-white/20 rounded-full"></div>
              
              {/* الجزء الأخضر الدوار */}
              <div className="absolute inset-0 border-[22px] border-transparent border-t-[#89d82d] rounded-full animate-spin-custom"></div>
              
              {/* أيقونة بحث في المنتصف (اختياري للجمالية) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Search size={48} className="text-white/30 animate-pulse" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-white text-4xl font-black tracking-tight drop-shadow-lg">
                Reading <span className="text-[#89d82d]">NFC</span> Tag...
              </h2>
              <button 
                onClick={() => setCurrentScreen('start')}
                className="mt-6 text-white/50 hover:text-white font-bold underline transition-colors"
              >
                Cancel Process
              </button>
            </div>
          </div>
        )}

      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-custom {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin-custom 1.5s linear infinite;
        }
      `}} />
    </div>
  );
}

// مكون فرعي لروابط القائمة
function NavLink({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="relative group cursor-pointer">
      <span className={`text-sm font-black transition-colors ${active ? 'text-[#89d82d]' : 'text-slate-400 group-hover:text-slate-600'}`}>
        {label}
      </span>
      {active && <div className="absolute -bottom-8 left-0 w-full h-1 bg-[#89d82d] rounded-full shadow-[0_2px_10px_rgba(137,216,45,0.4)]"></div>}
    </div>
  );
}
