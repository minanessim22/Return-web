'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Camera, Phone, Mail, Settings, Bell, Search, LogOut, Edit, MapPin, Calendar } from 'lucide-react';

export default function ProfileDashboard() {
  // 1. State لإدارة التابات (عشان لما تدوس على Lost Items يغير المحتوى)
  const [activeTab, setActiveTab] = useState<'profile' | 'lost'>('profile');
  const [reports, setReports] = useState<any[]>([]);

  // 2. جلب البيانات اللي سجلناها من الفورم
  useEffect(() => {
    const savedReports = JSON.parse(localStorage.getItem('myReportsList') || '[]');
    setReports(savedReports);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* ── SIDEBAR (Left) ── */}
      <div className="w-80 bg-white shadow-lg flex flex-col z-10">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 flex justify-center">
          <Image src="/photos/8.png" alt="Logo" width={120} height={40} className="object-contain" />
        </div>

        {/* User Info Quick View */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
              <Image src="/photos/1.png" alt="Avatar" width={40} height={40} className="object-cover" />
            </div>
            <span className="font-bold text-gray-800">@asmaa_ibrahim</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2">
          <div 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${activeTab === 'profile' ? 'bg-green-50 text-green-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <UserCircleIcon /> <span>Profile</span>
          </div>
          
          <div className="flex items-center space-x-3 px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl cursor-pointer transition-all">
            <Bell className="w-5 h-5" /> <span>Notification</span>
          </div>

          <div 
            onClick={() => setActiveTab('lost')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${activeTab === 'lost' ? 'bg-green-50 text-green-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <SearchIcon /> <span>Lost Items ({reports.length})</span>
          </div>

          <div className="flex items-center space-x-3 px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl cursor-pointer">
            <Settings className="w-5 h-5" /> <span>Settings</span>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-100">
          <Link href="/guest-homepage" className="flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl cursor-pointer font-bold">
            <LogOut className="w-5 h-5" /> <span>Log out</span>
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto">
        
        {activeTab === 'profile' ? (
          /* --- VIEW: PROFILE --- */
          <>
            <div className="bg-white shadow-sm pb-8">
              {/* Cover Photo */}
              <div className="h-56 bg-gradient-to-r from-green-400 to-blue-500 relative">
                <Image src="/photos/12.png" alt="Cover" fill className="object-cover" />
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
                      <Image src="/photos/1.png" alt="Avatar" width={128} height={128} className="object-cover" />
                    </div>
                    <div className="absolute bottom-1 right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center cursor-pointer shadow-md text-white">
                      <Edit className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="pt-20 text-center space-y-2">
                <h1 className="text-2xl font-black text-gray-900">Asmaa Ibrahim</h1>
                <p className="text-gray-400 font-medium">@asmaa_ibrahim</p>
                <div className="flex items-center justify-center space-x-2 py-2">
                  <span className="text-green-600 font-bold bg-green-50 px-4 py-1 rounded-full text-sm">Active Member</span>
                </div>
                {/* Contact */}
                <div className="flex justify-center space-x-4 pt-4">
                   <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-600"><Phone className="w-3 h-3" /> <span>01032421312</span></div>
                   <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-600"><Mail className="w-3 h-3" /> <span>asmaa@email.com</span></div>
                </div>
              </div>
            </div>

            {/* Found Items Section (Just placeholder for profile view) */}
            <div className="p-8">
              <h2 className="text-xl font-black text-gray-800 mb-6">Recently Shared Found Items</h2>
              <div className="grid grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center opacity-40">
                    <Camera className="w-10 h-10 text-gray-300 mb-2" />
                    <span className="text-sm font-bold text-gray-400">Empty Slot</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* --- VIEW: LOST ITEMS (Real Data from Form) --- */
          <div className="p-8 animate-in fade-in duration-300">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-gray-800">My Lost Reports ({reports.length})</h2>
                <Link href="/report-missing" className="bg-[#60C10F] text-white px-6 py-2 rounded-full font-bold text-sm shadow-md hover:bg-green-600 transition-all">+ Add New</Link>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {reports.map((report) => (
                 <div key={report.id} className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100 flex flex-col">
                    <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-gray-100 mb-4">
                      {report.photo ? (
                        <img src={report.photo} alt="Report" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><ImageIconIcon /></div>
                      )}
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Missing</div>
                    </div>
                    
                    <div className="px-2 space-y-2">
                       <h3 className="text-xl font-black text-[#014CB3] uppercase">{report.name}</h3>
                       <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
                          <MapPin className="w-4 h-4 text-green-500" /> {report.location}
                       </div>
                       <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
                          <Calendar className="w-4 h-4 text-green-500" /> {report.dateTime}
                       </div>
                    </div>

                    <Link 
                      href="/case-details" 
                      onClick={() => localStorage.setItem('lastReportData', JSON.stringify(report))}
                      className="mt-6 w-full py-3 bg-gray-50 hover:bg-gray-100 text-[#014CB3] font-black text-center rounded-2xl transition-all border border-gray-100"
                    >
                      VIEW CASE DETAILS
                    </Link>
                 </div>
               ))}

               {reports.length === 0 && (
                 <div className="col-span-2 py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold text-lg">You haven't reported any lost items yet.</p>
                 </div>
               )}
             </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helpers ──
function UserCircleIcon() { return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>; }
function SearchIcon() { return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/></svg>; }
function ImageIconIcon() { return <div className="flex flex-col items-center opacity-20"><Camera className="w-10 h-10 mb-2" /><span className="text-xs font-bold">NO IMAGE</span></div>; }