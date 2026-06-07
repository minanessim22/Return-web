'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, MessageCircle, Shield, Users } from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminSummaryResponse } from '@/lib/shared-types';

export default function AdminPage() {
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await api.adminSummary();
        if (!cancelled) setSummary(response);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load admin dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = summary ? [
    { label: 'Current users', value: summary.stats.currentUsers, icon: <Users className="w-5 h-5" /> },
    { label: 'Deleted accounts', value: summary.stats.deletedUsers, icon: <Users className="w-5 h-5" /> },
    { label: 'Active users', value: summary.stats.activeUsers, icon: <Users className="w-5 h-5" /> },
    { label: 'Open matches', value: summary.stats.openMatches, icon: <Shield className="w-5 h-5" /> },
    { label: 'Confirmed matches', value: summary.stats.confirmedMatches, icon: <Activity className="w-5 h-5" /> },
    { label: 'Messages', value: summary.stats.messages, icon: <MessageCircle className="w-5 h-5" /> }
  ] : [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#014CB3] to-[#60C10F] p-6 md:p-10 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="uppercase tracking-[0.25em] text-white/70 text-xs font-black">Admin</p>
            <h1 className="text-3xl md:text-5xl font-black mt-2">System control panel</h1>
            <p className="text-white/75 mt-3 max-w-2xl">Review system scale, open matches, and recent reports from one place.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/admin/audit" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#014CB3] px-5 py-3 font-bold hover:bg-[#013f98] transition">
              <Shield className="w-4 h-4" /> Audit Logs
            </Link>
            <Link href="/admin/db" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 font-bold hover:bg-white/20 transition">
              <Activity className="w-4 h-4" /> Open database
            </Link>
            <Link href="/lost-dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 font-bold hover:bg-white/20 transition">
              <ArrowLeft className="w-4 h-4" /> Back to dashboard
            </Link>
          </div>
        </div>

        {error ? <div className="rounded-3xl bg-red-50 px-5 py-4 text-red-700 font-semibold">{error}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
          {loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-3xl bg-white/10 animate-pulse" />) : cards.map((card) => (
            <div key={card.label} className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl">
              <div className="flex items-center justify-between text-white/80">{card.icon}<span className="text-sm">{card.label}</span></div>
              <p className="text-4xl font-black mt-6">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-2xl font-black">Recent reports</h2>
              <p className="text-white/70 text-sm mt-2">Fresh reports and their current status.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(summary?.recentCases || []).map((item) => (
              <Link key={item.id} href={`/case-details?caseId=${item.id}`} className="rounded-3xl border border-white/15 bg-white/10 p-5 hover:bg-white/15 transition">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">{item.referenceCode}</p>
                    <h3 className="text-xl font-black mt-2">{item.displayName}</h3>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">{item.status}</span>
                </div>
                <p className="text-sm text-white/80 mt-4 line-clamp-2">{item.description || item.locationText || 'Open to review the full case details.'}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
