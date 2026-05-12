'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Filter, Search, ImagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import type { CaseItem } from '@/lib/shared-types';

export default function MissingPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<CaseItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      try {
        const response = await api.cases({ type: 'MISSING', limit: 50 });
        if (!cancelled) {
          setReports(response.items);
        }
      } catch (error) {
        console.warn('Unable to load missing reports', error);
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => Array.from(new Set(reports.map((report) => report.category).filter(Boolean) as string[])).sort(), [reports]);
  const statuses = useMemo(() => Array.from(new Set(reports.map((report) => report.status).filter((value) => value !== 'RESOLVED' && value !== 'CLOSED'))).sort(), [reports]);

  const filteredReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (report.status === 'RESOLVED' || report.status === 'CLOSED') return false;
      if (category !== 'ALL' && report.category !== category) return false;
      if (status !== 'ALL' && report.status !== status) return false;
      if (!needle) return true;
      const haystack = [
        report.displayName,
        report.description,
        report.locationText,
        report.referenceCode,
        report.category,
        report.clothesColor,
        report.matches.map((item) => item.otherCaseDisplayName).join(' ')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [reports, search, category, status]);

  const cardsToRender = !loading && filteredReports.length === 0 ? [] : filteredReports;

  return (
    <div className="flex flex-col min-h-screen font-sans bg-white select-none">
      <nav className="h-[72px] bg-white flex items-center justify-between px-6 shadow-sm z-50">
        <Image src="/photos/8.png" alt="RETURN" width={110} height={36} />

        <div className="hidden md:flex gap-8 text-xs font-black uppercase text-[#014CB3] h-full items-center">
          <Link href="/lost-dashboard" className="cursor-pointer hover:text-[#60C10F] transition-colors">Home</Link>
          <Link href="/missing" className="text-[#60C10F] border-b-[3px] border-[#60C10F] h-full flex items-center pt-1 cursor-pointer">Missing</Link>
          <Link href="/found-dashboard" className="cursor-pointer hover:text-[#60C10F] transition-colors">Found</Link>
          <Link href="/devices" className="cursor-pointer hover:text-[#60C10F] transition-colors">Devices</Link>
          <Link href="/chat" className="cursor-pointer hover:text-[#60C10F] transition-colors">Chat</Link>
          <Link href="/profile" className="cursor-pointer hover:text-[#60C10F] transition-colors">Profile</Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden border border-gray-300 flex items-center justify-center">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <Image src="/photos/1.png" alt="User" width={36} height={36} className="object-cover" />
            )}
          </div>
          <span className="text-xs font-black text-gray-900">{user?.name || 'RETURN USER'}</span>
        </div>
      </nav>

      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto" style={{ background: 'linear-gradient(116.99deg, #014CB3 3.07%, #60C10F 69.76%)' }}>
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-wide">Missing</h1>
              <p className="text-white/80 mt-2 text-sm font-medium">Browse active missing reports, filter them by category, and open case details to review matches and contact data.</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
              <div className="flex items-center px-4 py-2.5 rounded-full w-full md:w-80 shadow-lg border border-white/20" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.31) 100%)' }}>
                <Search className="w-5 h-5 text-gray-800 mr-2" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, location, reference, or match" className="bg-transparent outline-none text-gray-900 placeholder-gray-600 font-bold w-full text-sm" />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/20 px-4 py-2 text-white">
                <Filter className="w-4 h-4" />
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-transparent outline-none text-sm">
                  <option value="ALL" className="text-black">All categories</option>
                  {categories.map((value) => <option key={value} value={value} className="text-black">{value}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/20 px-4 py-2 text-white">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-transparent outline-none text-sm">
                  <option value="ALL" className="text-black">All statuses</option>
                  {statuses.map((value) => <option key={value} value={value} className="text-black">{value}</option>)}
                </select>
              </div>
              <Link href="/report-missing" className="px-4 py-2 rounded-full bg-white/20 text-white font-black hover:bg-white/30 transition-all border border-white/20 whitespace-nowrap">
                + Add report
              </Link>
            </div>
          </div>

          <Link href="/chat" className="fixed bottom-6 right-6 z-50 bg-[#60C10F] hover:bg-[#4DA00D] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl transition-transform hover:scale-105">
            Chat
          </Link>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white/20 backdrop-blur-md rounded-[2rem] p-6 shadow-2xl border border-white/20 flex flex-col animate-pulse">
                  <div className="bg-white rounded-[1.5rem] h-40 mb-6" />
                  <div className="space-y-4 mb-8">
                    <div className="h-8 rounded-full bg-white/25" />
                    <div className="h-8 rounded-full bg-white/25" />
                    <div className="h-8 rounded-full bg-white/25" />
                  </div>
                  <div className="h-10 rounded-full bg-white/25 mt-auto" />
                </div>
              ))}
            </div>
          ) : cardsToRender.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {cardsToRender.map((report, idx) => {
                const displayName = report.displayName || 'Unnamed case';
                const ageText = report.age ? `${report.age} years` : report.category || 'No age details';
                const locationText = report.locationText || 'Unknown location';
                const image = report.primaryImage || null;

                return (
                  <div key={report.id || idx} className="bg-white/20 backdrop-blur-md rounded-[2rem] p-6 shadow-2xl border border-white/20 flex flex-col">
                    <div className="bg-white rounded-[1.5rem] h-40 flex flex-col items-center justify-center mb-6 overflow-hidden shadow-inner border-2 border-white/50">
                      {image ? <img src={image} className="w-full h-full object-cover" alt={displayName} /> : <><ImagePlus className="w-12 h-12 text-gray-800 mb-1" strokeWidth={1.5} /><span className="text-gray-900 font-bold text-xl tracking-wide">photo</span></>}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 rounded-full bg-white/20 border border-white/20 text-[11px] font-black tracking-[0.2em] uppercase text-white">{report.status}</span>
                      {report.matches.length > 0 ? (
                        <Link href={`/case-details?caseId=${report.id}&view=matches`} className="px-3 py-1 rounded-full bg-[#60C10F]/30 border border-[#c6f59b] text-[11px] font-black tracking-[0.2em] uppercase text-white">
                          {report.matches.length} match{report.matches.length > 1 ? 'es' : ''}
                        </Link>
                      ) : null}
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-black w-20 text-sm drop-shadow-sm">Name</span>
                        <div className="bg-white/30 rounded-full h-8 flex-1 px-4 flex items-center border border-white/20 shadow-inner overflow-hidden">
                          <span className="text-white font-bold text-sm truncate">{displayName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-black w-20 text-sm drop-shadow-sm">Category</span>
                        <div className="bg-white/30 rounded-full h-8 flex-1 px-4 flex items-center border border-white/20 shadow-inner overflow-hidden">
                          <span className="text-white font-bold text-sm truncate">{ageText}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-black w-20 text-sm drop-shadow-sm">Last Seen</span>
                        <div className="bg-white/30 rounded-full h-8 flex-1 px-4 flex items-center border border-white/20 shadow-inner overflow-hidden">
                          <span className="text-white font-bold text-sm truncate">{locationText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex justify-center">
                      <Link href={`/case-details?caseId=${report.id}`} className="px-10 py-1.5 rounded-full font-black text-gray-900 shadow-xl hover:scale-105 transition-transform" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #999999 100%)' }}>
                        view
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-white/90 py-20 rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-md">
              <h2 className="text-2xl font-black mb-3">No missing reports found</h2>
              <p className="text-sm mb-6">Try a different filter, or create a new missing report.</p>
              <Link href="/report-missing" className="inline-flex px-6 py-3 rounded-full bg-white text-[#014CB3] font-black shadow-lg hover:scale-105 transition-transform">
                Create first report
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
