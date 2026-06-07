'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ImagePlus, Mail, MapPin, MessageCircle, Phone, ShieldCheck, UserCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import type { CaseItem } from '@/lib/shared-types';

const DynamicMap = dynamic(() => import('@/components/Map'), { ssr: false });

type DraftData = {
  name: string;
  category: string;
  age: string;
  gender: string;
  location: string;
  latitude: string;
  longitude: string;
  dateTime: string;
  description: string;
  clothesColor: string;
  conditionNotes: string;
  contactPhone: string;
  status: string;
  photo: string | null;
};

function isoToInputValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDraftFromCase(item: CaseItem): DraftData {
  return {
    name: item.displayName || '',
    category: item.category || '',
    age: item.age !== undefined ? String(item.age) : '',
    gender: item.gender || '',
    location: item.locationText || '',
    latitude: item.latitude !== undefined ? String(item.latitude) : '',
    longitude: item.longitude !== undefined ? String(item.longitude) : '',
    dateTime: isoToInputValue(item.eventTime || item.lastSeenAt || item.foundAt || item.createdAt),
    description: item.description || '',
    clothesColor: item.clothesColor || '',
    conditionNotes: item.conditionNotes || '',
    contactPhone: item.contactPhone || item.owner?.phone || '',
    status: item.status || 'ACTIVE',
    photo: item.primaryImage || null
  };
}

function validateRequiredDraftFields(draft: DraftData) {
  if (!draft.age.trim()) return 'Age is required for every report.';
  if (!draft.location.trim()) return 'Address / location is required for every report.';
  if (!draft.dateTime.trim()) return 'Date / time is required for every report.';
  if (!draft.description.trim()) return 'Description is required for every report.';
  if (!draft.clothesColor.trim()) return 'Clothes / visual notes are required for every report.';
  return null;
}

function saveCaseSnapshot(report: CaseItem) {
  const snapshot = {
    id: report.id,
    caseId: report.id,
    name: report.displayName,
    description: report.description || report.conditionNotes || '',
    location: report.locationText || '',
    photo: report.primaryImage || null,
    dateTime: report.eventTime || report.lastSeenAt || report.foundAt || report.createdAt,
    status: report.status,
    referenceCode: report.referenceCode,
    type: report.type,
    category: report.category,
    age: report.age,
    clothesColor: report.clothesColor
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem('currentReport', JSON.stringify(snapshot));
    localStorage.setItem('lastReportData', JSON.stringify(snapshot));
    localStorage.setItem('lastCreatedCaseId', report.id);
  }
}

function CaseDetailsContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [data, setData] = useState<CaseItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const matchesRef = useRef<HTMLDivElement | null>(null);

  const caseId = searchParams.get('caseId') || (typeof window !== 'undefined' ? localStorage.getItem('lastCreatedCaseId') : null);
  const focusView = searchParams.get('view');

  const loadCase = async (targetCaseId: string) => {
    const response = await api.getCase(targetCaseId);
    setData(response.item);
    saveCaseSnapshot(response.item);
  };

  useEffect(() => {
    let mounted = true;
    if (!caseId) return;
    void api.getCase(caseId)
      .then((response) => {
        if (!mounted) return;
        setData(response.item);
        saveCaseSnapshot(response.item);
      })
      .catch(() => {
        if (mounted) {
          setError('Unable to load this case right now.');
        }
      });
    return () => {
      mounted = false;
    };
  }, [caseId]);

  useEffect(() => {
    if (focusView === 'matches' && matchesRef.current) {
      matchesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusView, data?.id]);

  const currentView = useMemo(() => {
    if (!data) return null;
    return {
      name: data.displayName,
      description: data.description || 'No additional description provided for this case.',
      location: data.locationText || 'Unknown location',
      dateTime: data.eventTime || data.lastSeenAt || data.foundAt || data.createdAt,
      photo: data.primaryImage || null
    };
  }, [data]);

  const canManageCase = Boolean(user && data && user.id === data.ownerUserId);
  const canRequestFinalDecision = Boolean(canManageCase && data?.type === 'FOUND');
  const canReviewFinalDecision = Boolean(canManageCase && data?.type === 'MISSING');
  const startEdit = () => {
    if (!data) return;
    setDraft(buildDraftFromCase(data));
    setIsEditing(true);
    setMessage('');
    setError('');
  };

  const updateDraft = (key: keyof DraftData, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!draft || !data) return;

    const validationError = validateRequiredDraftFields(draft);
    if (validationError) {
      setMessage('');
      setError(validationError);
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.updateCase(data.id, {
        name: draft.name,
        category: draft.category,
        age: draft.age ? Number(draft.age) : undefined,
        gender: draft.gender,
        location: draft.location,
        latitude: draft.latitude ? Number(draft.latitude) : undefined,
        longitude: draft.longitude ? Number(draft.longitude) : undefined,
        dateTime: draft.dateTime,
        description: draft.description,
        clothesColor: draft.clothesColor,
        conditionNotes: draft.conditionNotes,
        contactPhone: draft.contactPhone,
        status: draft.status,
        photo: draft.photo || undefined
      });
      setData(response.item);
      saveCaseSnapshot(response.item);
      setIsEditing(false);
      setDraft(null);
      setMessage('Report updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this case.');
    } finally {
      setSaving(false);
    }
  };

  const openChat = async (matchId: string, conversationId?: string) => {
    try {
      if (conversationId) {
        router.push(`/chat?conversationId=${conversationId}`);
        return;
      }
      const response = await api.startConversationForMatch({ matchId });
      router.push(`/chat?conversationId=${response.item.id}`);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Unable to open chat right now.');
    }
  };

  const confirmFinalMatch = async (matchId: string) => {
    if (!data) return;
    setBusyMatchId(matchId);
    setMessage('');
    setError('');
    try {
      await api.confirmMatch(matchId);
      await loadCase(data.id);
      setMessage('Final match confirmed. The missing report was closed and the linked found report remains saved.');
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Unable to confirm this match.');
    } finally {
      setBusyMatchId(null);
    }
  };

  const requestFinalConfirmation = async (matchId: string) => {
    if (!data) return;
    setBusyMatchId(matchId);
    setMessage('');
    setError('');
    try {
      await api.requestMatchConfirmation(matchId);
      await loadCase(data.id);
      setMessage('Final confirmation request sent. Only the missing report owner can approve or reject this match.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send the final confirmation request.');
    } finally {
      setBusyMatchId(null);
    }
  };

  const rejectPotentialMatch = async (matchId: string) => {
    if (!data) return;
    setBusyMatchId(matchId);
    setMessage('');
    setError('');
    try {
      await api.rejectMatch(matchId);
      await loadCase(data.id);
      setMessage('The missing report owner declined this final confirmation request.');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Unable to reject this match.');
    } finally {
      setBusyMatchId(null);
    }
  };

  const dashboardBase = typeof window !== 'undefined' && localStorage.getItem('return:lastDashboard') === 'found' ? '/found-dashboard' : '/lost-dashboard';
  const matchedLocationMarkers = useMemo(() => {
    if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return [] as Array<{ position: [number, number]; label: string }>;
    }
    return [
      {
        position: [data.latitude, data.longitude] as [number, number],
        label: `${data.displayName} (${data.type})`
      }
    ];
  }, [data]);

  if (!currentView || !data) {
    return (
      <div className="min-h-screen bg-[#014CB3] text-white flex items-center justify-center font-bold text-xl">
        Loading case data...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-white select-none">
      <nav className="h-16 bg-white flex items-center justify-between px-6 shadow-sm border-b relative z-50">
        <Image src="/photos/8.png" alt="LOGO" width={110} height={36} />
        <div className="flex items-center gap-2">
          <UserCircle className="w-8 h-8 text-gray-300" />
          <span className="text-xs font-black uppercase text-gray-800">{user?.name || data.owner?.name || 'RETURN USER'}</span>
        </div>
      </nav>

      <main className="flex-1 bg-gradient-to-br from-[#014CB3] to-[#60C10F] p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {message ? <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">{message}</div> : null}
          {error ? <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Case Details</h1>
              <p className="text-white/75 text-sm mt-2">{data.type} • {data.referenceCode} • {data.status}</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 md:gap-12 text-sm md:text-lg font-bold text-white">
              <p>Status: <span className="text-gray-900 ml-1">{data.status}</span></p>
              <p>Case ID: <span className="text-gray-900 ml-1">#{data.referenceCode}</span></p>
              <p>Date: <span className="text-gray-900 ml-1">{new Date(currentView.dateTime).toLocaleDateString('en-GB')}</span></p>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-8 shadow-2xl border border-white/20">
            <div className="bg-white rounded-[2rem] h-72 lg:h-full flex items-center justify-center overflow-hidden shadow-inner border-4 border-white/50">
              {currentView.photo ? (
                <img src={currentView.photo} className="w-full h-full object-cover" alt="Case" />
              ) : (
                <div className="flex flex-col items-center text-gray-800">
                  <ImagePlus className="w-16 h-16 mb-2" strokeWidth={1.5} />
                  <span className="text-2xl font-bold">photo</span>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-black text-white mb-4">Case Info</h2>
                {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-bold text-white text-base md:text-lg tracking-wide">
                    <p>Name: <span className="text-[#014CB3] ml-2">{currentView.name || 'Unknown'}</span></p>
                    <p>Category: <span className="text-[#014CB3] ml-2">{data.category || data.type}</span></p>
                    <p>Age: <span className="text-red-500 ml-2">{data.age ? `${data.age} years old` : 'Unknown'}</span></p>
                    <p>Gender: <span className="text-[#014CB3] ml-2">{data.gender || 'Unknown'}</span></p>
                    <p>Location: <span className="text-[#014CB3] ml-2">{currentView.location || 'Unknown'}</span></p>
                    <p>Date Reported: <span className="text-red-500 ml-2">{new Date(currentView.dateTime).toLocaleString()}</span></p>
                    <p>Contact phone: <span className="text-[#014CB3] ml-2">{data.contactPhone || data.owner?.phone || 'Not added'}</span></p>
                    <p>Clothes / notes: <span className="text-[#014CB3] ml-2">{data.clothesColor || data.conditionNotes || '—'}</span></p>
                  </div>
                ) : draft ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white text-base md:text-lg tracking-wide">
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Name / model</label>
                      <input value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Category</label>
                      <input value={draft.category} onChange={(e) => updateDraft('category', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Age *</label>
                      <input value={draft.age} onChange={(e) => updateDraft('age', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Gender</label>
                      <input value={draft.gender} onChange={(e) => updateDraft('gender', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-white/80 text-xs mb-1">Location *</label>
                      <input value={draft.location} onChange={(e) => updateDraft('location', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Latitude</label>
                      <input value={draft.latitude} onChange={(e) => updateDraft('latitude', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Longitude</label>
                      <input value={draft.longitude} onChange={(e) => updateDraft('longitude', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Date / time *</label>
                      <input type="datetime-local" value={draft.dateTime} onChange={(e) => updateDraft('dateTime', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Status</label>
                      <select value={draft.status} onChange={(e) => updateDraft('status', e.target.value)} className="w-full rounded-lg p-2 text-black">
                        {['ACTIVE', 'UNDER_REVIEW', 'MATCHED', 'RESOLVED', 'CLOSED'].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Contact phone</label>
                      <input value={draft.contactPhone} onChange={(e) => updateDraft('contactPhone', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Clothes / visual notes *</label>
                      <input value={draft.clothesColor} onChange={(e) => updateDraft('clothesColor', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs mb-1">Condition notes</label>
                      <input value={draft.conditionNotes} onChange={(e) => updateDraft('conditionNotes', e.target.value)} className="w-full rounded-lg p-2 text-black" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-white/80 text-xs mb-1">Description *</label>
                      <textarea value={draft.description} onChange={(e) => updateDraft('description', e.target.value)} className="w-full rounded-lg p-2 text-black min-h-28" />
                    </div>
                  </div>
                ) : null}
              </div>

              {canManageCase ? (
                <div className="flex gap-3 flex-wrap">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} disabled={saving} className="bg-[#60C10F] hover:bg-[#4da00b] text-gray-900 text-xs md:text-sm font-black px-6 py-2.5 rounded-full shadow-lg transition-transform hover:scale-105 disabled:opacity-70">
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                      <button onClick={cancelEdit} className="bg-red-500 hover:bg-red-600 text-white text-xs md:text-sm font-black px-6 py-2.5 rounded-full shadow-lg">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={startEdit} className="bg-[#60C10F] hover:bg-[#4da00b] text-gray-900 text-xs md:text-sm font-black px-6 py-2.5 rounded-full shadow-lg transition-transform hover:scale-105">
                      Edit full report
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 shadow-2xl border border-white/20">
              <h3 className="text-xl font-black text-white mb-4">Description</h3>
              <p className="text-white font-semibold text-lg leading-relaxed">
                {currentView.description || 'No additional description provided for this case.'}
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 shadow-2xl border border-white/20">
              <h3 className="text-xl font-black text-white mb-4">Reported by</h3>
              <div className="space-y-3 text-white/95">
                <div className="flex items-center gap-3">
                  <UserCircle className="w-10 h-10 text-white/80" />
                  <div>
                    <p className="font-bold text-lg">{data.owner?.name || 'Unknown owner'}</p>
                    <p className="text-sm text-white/70">{data.owner?.username ? `@${data.owner.username}` : 'Registered account'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                    <p className="text-white/65 uppercase text-[11px] tracking-[0.2em] mb-1">Email</p>
                    <p>{data.owner?.email || 'Not available'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                    <p className="text-white/65 uppercase text-[11px] tracking-[0.2em] mb-1">Phone</p>
                    <p>{data.owner?.phone || data.contactPhone || 'Not available'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl border border-white/20">
            <div className="w-full md:w-80 h-56 rounded-2xl overflow-hidden shadow-inner bg-white/50 z-0">
              <DynamicMap
                center={[data.latitude || 30.0444, data.longitude || 31.2357]}
                marker={[data.latitude || 30.0444, data.longitude || 31.2357]}
                markers={matchedLocationMarkers}
              />
            </div>

            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-black text-white mb-2">Case location</h3>
              <p className="text-[#014CB3] text-3xl md:text-4xl font-black tracking-tighter">
                {currentView.location || 'Unknown location'}
              </p>
              {data.latitude !== undefined && data.longitude !== undefined ? (
                <a
                  href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2 font-bold text-white hover:bg-white/25 transition"
                >
                  <MapPin className="w-4 h-4" /> Open in Maps
                </a>
              ) : null}
            </div>
          </div>

          {data.aiAnalysis ? (
            <div className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 shadow-2xl border border-white/20">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#60C10F]/20 border border-[#c9f0a2] text-sm font-black uppercase tracking-[0.2em] text-white">
                  <ShieldCheck className="w-4 h-4" /> AI visual profile ready
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-[0.2em] text-white">
                  Generated {new Date(data.aiAnalysis.generatedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-white text-lg md:text-xl font-black leading-relaxed">{data.aiAnalysis.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Center structure</p>
                  <p className="text-3xl font-black text-white">{Math.round((data.aiAnalysis.features.centerEdgeDensity ?? data.aiAnalysis.features.edgeDensity) * 100)}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Structural detail</p>
                  <p className="text-3xl font-black text-white">{Math.round(data.aiAnalysis.features.edgeDensity * 100)}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Aspect ratio</p>
                  <p className="text-3xl font-black text-white">{data.aiAnalysis.features.aspectRatio.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={matchesRef} className="bg-white/15 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 shadow-2xl border border-white/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <div>
                <h3 className="text-2xl font-black text-white">Matches</h3>
                <p className="text-white/75 text-sm mt-1">Click any match to view the linked case, contact the other person, or open a direct chat.</p>
              </div>
              <div className="rounded-full bg-[#60C10F]/20 border border-[#c9f0a2] px-4 py-2 text-sm font-black text-white">
                {data.matches.length} match{data.matches.length === 1 ? '' : 'es'}
              </div>
            </div>

            {data.matches.length === 0 ? (
              <div className="rounded-3xl border border-white/15 bg-white/10 px-6 py-10 text-center text-white/80">
                No matches yet. When the system finds a likely owner or finder, the full match card will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                {data.matches.map((match) => (
                  <div key={match.id} className="rounded-3xl border border-white/15 bg-white/10 p-5">
                    <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
                      <div className="w-full lg:w-48 h-40 rounded-2xl overflow-hidden bg-white/70 flex items-center justify-center">
                        {match.otherCasePrimaryImage ? (
                          <img src={match.otherCasePrimaryImage} alt={match.otherCaseDisplayName} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="w-12 h-12 text-[#014CB3]/60" />
                        )}
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-black tracking-[0.2em] uppercase text-white">
                            {match.otherCaseType}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-black tracking-[0.2em] uppercase text-white">
                            {match.status}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-[#60C10F]/35 border border-[#b6ef86] text-xs font-black tracking-[0.2em] uppercase text-white">
                            {Math.round(match.score * 100)}% confidence
                          </span>
                          {match.aiPriorityApplied ? (
                            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-black tracking-[0.2em] uppercase text-white">
                              AI image-first
                            </span>
                          ) : null}
                          {match.imageScore !== undefined ? (
                            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-black tracking-[0.2em] uppercase text-white">
                              Image {Math.round(match.imageScore * 100)}%
                            </span>
                          ) : null}
                          {match.status === 'CONFIRMED' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-200 text-xs font-black tracking-[0.2em] uppercase text-white">
                              <CheckCircle2 className="w-3 h-3" /> Final match
                            </span>
                          ) : null}
                          {match.status === 'PENDING' && match.confirmationRequestedAt ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#014CB3]/30 border border-white/30 text-xs font-black tracking-[0.2em] uppercase text-white">
                              <ShieldCheck className="w-3 h-3" /> Final request sent
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h4 className="text-2xl font-black text-white">{match.otherCaseDisplayName}</h4>
                          <p className="text-sm text-white/70 mt-1">{match.otherCaseReferenceCode} • {match.otherCaseStatus}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Why this match was created</p>
                          <p className="text-white/95 text-sm leading-relaxed">{match.reason}</p>
                        </div>

                        {match.scoreBreakdown ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(match.scoreBreakdown).map(([key, value]) => (
                              value !== undefined ? (
                                <div key={key} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">{key}</p>
                                  <p className="text-2xl font-black text-white">{Math.round(value * 100)}%</p>
                                </div>
                              ) : null
                            ))}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Other person</p>
                            <p className="text-white font-bold">{match.otherCaseOwner?.name || 'Unknown'}</p>
                            <p className="text-white/70 text-sm mt-1">{match.otherCaseOwner?.username ? `@${match.otherCaseOwner.username}` : 'Matched account'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Email</p>
                            <p className="text-white text-sm break-all">{match.otherCaseOwner?.email || 'Not available'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Phone</p>
                            <p className="text-white text-sm">{match.otherCaseOwner?.phone || match.otherCaseContactPhone || 'Not available'}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button onClick={() => router.push(`/case-details?caseId=${match.otherCaseId}`)} className="rounded-full border border-white/30 bg-white/15 px-5 py-2 font-bold text-white hover:bg-white/25 transition">
                            View matched report
                          </button>
                          <button onClick={() => openChat(match.id, match.conversationId)} className="rounded-full border border-[#c9f0a2] bg-[#60C10F]/20 px-5 py-2 font-bold text-white hover:bg-[#60C10F]/35 transition inline-flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" /> Open chat
                          </button>
                          {match.otherCaseOwner?.email ? (
                            <a href={`mailto:${match.otherCaseOwner.email}`} className="rounded-full border border-white/30 bg-white/15 px-5 py-2 font-bold text-white hover:bg-white/25 transition inline-flex items-center gap-2">
                              <Mail className="w-4 h-4" /> Email
                            </a>
                          ) : null}
                          {(match.otherCaseOwner?.phone || match.otherCaseContactPhone) ? (
                            <a href={`tel:${match.otherCaseOwner?.phone || match.otherCaseContactPhone}`} className="rounded-full border border-white/30 bg-white/15 px-5 py-2 font-bold text-white hover:bg-white/25 transition inline-flex items-center gap-2">
                              <Phone className="w-4 h-4" /> Call
                            </a>
                          ) : null}
                          {canRequestFinalDecision && match.status === 'PENDING' && !match.confirmationRequestedAt ? (
                            <button
                              disabled={busyMatchId === match.id}
                              onClick={() => requestFinalConfirmation(match.id)}
                              className="rounded-full border border-[#c9f0a2] bg-[#60C10F]/20 px-5 py-2 font-bold text-white hover:bg-[#60C10F]/35 transition inline-flex items-center gap-2 disabled:opacity-60"
                            >
                              <ShieldCheck className="w-4 h-4" /> Send final confirmation request
                            </button>
                          ) : null}
                          {canRequestFinalDecision && match.status === 'PENDING' && match.confirmationRequestedAt ? (
                            <span className="rounded-full border border-white/30 bg-white/10 px-5 py-2 font-bold text-white/80 inline-flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4" /> Waiting for missing owner approval
                            </span>
                          ) : null}
                          {canReviewFinalDecision && match.status === 'PENDING' && !match.confirmationRequestedAt ? (
                            <span className="rounded-full border border-white/30 bg-white/10 px-5 py-2 font-bold text-white/80">
                              Waiting for the finder to send a final confirmation request
                            </span>
                          ) : null}
                          {canReviewFinalDecision && match.status === 'PENDING' && match.confirmationRequestedAt ? (
                            <>
                              <button
                                disabled={busyMatchId === match.id}
                                onClick={() => confirmFinalMatch(match.id)}
                                className="rounded-full border border-emerald-200 bg-emerald-500/20 px-5 py-2 font-bold text-white hover:bg-emerald-500/35 transition inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                <ShieldCheck className="w-4 h-4" /> Confirm final match
                              </button>
                              <button
                                disabled={busyMatchId === match.id}
                                onClick={() => rejectPotentialMatch(match.id)}
                                className="rounded-full border border-red-200 bg-red-500/20 px-5 py-2 font-bold text-white hover:bg-red-500/35 transition inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                <XCircle className="w-4 h-4" /> Wrong match
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={() => router.push(`${dashboardBase}?tab=myReports`)} className="bg-white/20 hover:bg-white/30 text-white px-8 py-3 rounded-full font-bold border border-white/40">
              Back to reports
            </button>
            <button onClick={() => router.push(`${dashboardBase}?tab=matches`)} className="bg-white text-[#014CB3] px-8 py-3 rounded-full font-bold border border-white/40">
              Open Matches tab
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CaseDetailsContent() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-[#014CB3] text-white flex items-center justify-center font-bold text-xl">
          Loading case data...
        </div>
      )}
    >
      <CaseDetailsContentInner />
    </Suspense>
  );
}
