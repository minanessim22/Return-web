'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Camera, Phone, Mail, Settings, Bell, Search, LogOut, Edit, MapPin, Calendar, Menu } from 'lucide-react';
import { MobileNavDrawer } from '@/components/dashboard/MobileNavDrawer';

export default function ProfileDashboard() {
  const [activeTab, setActiveTab] = useState<'profile' | 'lost'>('profile');
  const [reports, setReports] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const savedReports = JSON.parse(localStorage.getItem('myReportsList') || '[]');
    setReports(savedReports);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const selectTab = (tab: 'profile' | 'lost') => {
    setActiveTab(tab);
    closeMobileMenu();
  };

  const renderSidebarContent = (mobileLayout = false) => (
    <>
      <div className={`flex justify-center border-b border-gray-100 ${mobileLayout ? 'p-4' : 'p-6'}`}>
        <Image src="/photos/8.png" alt="Logo" width={120} height={40} className="object-contain" />
      </div>

      <div className={`border-b border-gray-100 ${mobileLayout ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200">
            <Image src="/photos/1.png" alt="Avatar" width={40} height={40} className="object-cover" />
          </div>
          <span className="font-bold text-gray-800">@asmaa_ibrahim</span>
        </div>
      </div>

      <nav className={`flex-1 space-y-2 ${mobileLayout ? 'p-3' : 'p-4'}`}>
        <div
          onClick={() => selectTab('profile')}
          className={`flex cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 transition-all ${activeTab === 'profile' ? 'bg-green-50 font-bold text-green-600' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <UserCircleIcon /> <span>Profile</span>
        </div>

        <div className="flex cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 text-gray-500 transition-all hover:bg-gray-50">
          <Bell className="h-5 w-5" /> <span>Notification</span>
        </div>

        <div
          onClick={() => selectTab('lost')}
          className={`flex cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 transition-all ${activeTab === 'lost' ? 'bg-green-50 font-bold text-green-600' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <SearchIcon /> <span>Lost Items ({reports.length})</span>
        </div>

        <div className="flex cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 text-gray-500 transition-all hover:bg-gray-50">
          <Settings className="h-5 w-5" /> <span>Settings</span>
        </div>
      </nav>

      <div className={`border-t border-gray-100 ${mobileLayout ? 'p-3' : 'p-4'}`}>
        <Link
          href="/guest-homepage"
          onClick={closeMobileMenu}
          className="flex cursor-pointer items-center space-x-3 rounded-xl px-4 py-3 font-bold text-red-500 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" /> <span>Log out</span>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 lg:flex-row">
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Image src="/photos/8.png" alt="Logo" width={110} height={36} className="object-contain" />
        <span className="truncate text-sm font-bold text-gray-700">
          {activeTab === 'profile' ? 'Profile' : `Lost Items (${reports.length})`}
        </span>
      </div>

      <div className="z-10 hidden w-80 flex-shrink-0 flex-col bg-white shadow-lg lg:flex">
        {renderSidebarContent()}
      </div>

      <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobileMenu} title="Dashboard" variant="light">
        {renderSidebarContent(true)}
      </MobileNavDrawer>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profile' ? (
          <>
            <div className="bg-white pb-8 shadow-sm">
              <div className="relative h-56 bg-gradient-to-r from-green-400 to-blue-500">
                <Image src="/photos/12.png" alt="Cover" fill className="object-cover" />
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
                  <div className="relative">
                    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
                      <Image src="/photos/1.png" alt="Avatar" width={128} height={128} className="object-cover" />
                    </div>
                    <div className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-green-500 text-white shadow-md">
                      <Edit className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-20 text-center">
                <h1 className="text-2xl font-black text-gray-900">Asmaa Ibrahim</h1>
                <p className="font-medium text-gray-400">@asmaa_ibrahim</p>
                <div className="flex items-center justify-center space-x-2 py-2">
                  <span className="rounded-full bg-green-50 px-4 py-1 text-sm font-bold text-green-600">Active Member</span>
                </div>
                <div className="flex flex-wrap justify-center gap-3 px-4 pt-4">
                  <div className="flex items-center space-x-2 rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600">
                    <Phone className="h-3 w-3" /> <span>01032421312</span>
                  </div>
                  <div className="flex items-center space-x-2 rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600">
                    <Mail className="h-3 w-3" /> <span>asmaa@email.com</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              <h2 className="mb-6 text-xl font-black text-gray-800">Recently Shared Found Items</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 p-10 opacity-40">
                    <Camera className="mb-2 h-10 w-10 text-gray-300" />
                    <span className="text-sm font-bold text-gray-400">Empty Slot</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="animate-in fade-in p-4 duration-300 md:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black text-gray-800 md:text-3xl">My Lost Reports ({reports.length})</h2>
              <Link
                href="/report-missing"
                className="rounded-full bg-[#60C10F] px-6 py-2 text-center text-sm font-bold text-white shadow-md transition-all hover:bg-green-600 sm:w-auto"
              >
                + Add New
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reports.map((report) => (
                <div key={report.id} className="flex flex-col rounded-3xl border border-gray-100 bg-white p-4 shadow-xl">
                  <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl bg-gray-100">
                    {report.photo ? (
                      <img src={report.photo} alt="Report" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIconIcon />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase text-white">
                      Missing
                    </div>
                  </div>

                  <div className="space-y-2 px-2">
                    <h3 className="text-xl font-black uppercase text-[#014CB3]">{report.name}</h3>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                      <MapPin className="h-4 w-4 text-green-500" /> {report.location}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                      <Calendar className="h-4 w-4 text-green-500" /> {report.dateTime}
                    </div>
                  </div>

                  <Link
                    href="/case-details"
                    onClick={() => localStorage.setItem('lastReportData', JSON.stringify(report))}
                    className="mt-6 w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 text-center font-black text-[#014CB3] transition-all hover:bg-gray-100"
                  >
                    VIEW CASE DETAILS
                  </Link>
                </div>
              ))}

              {reports.length === 0 && (
                <div className="col-span-full rounded-3xl border-2 border-dashed border-gray-200 bg-white py-20 text-center md:col-span-2">
                  <p className="text-lg font-bold text-gray-400">You haven&apos;t reported any lost items yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserCircleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
    </svg>
  );
}

function ImageIconIcon() {
  return (
    <div className="flex flex-col items-center opacity-20">
      <Camera className="mb-2 h-10 w-10" />
      <span className="text-xs font-bold">NO IMAGE</span>
    </div>
  );
}
