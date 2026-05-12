"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import {
  getPendingAiImage,
  loadPendingAiSummary,
  savePendingAiSummary,
  waitForPendingAiMatches,
  type PendingAiSummary
} from '@/lib/client-ai-session';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDisplayUser } from '@/lib/user-display';
import { api } from '@/lib/api';

type PreviewMatch = {
  score: number;
  reason: string;
  imageScore?: number;
  similarity?: number;
  confidence?: number;
  aiPriorityApplied?: boolean;
  usedAiPhotoPriority?: boolean;
  usedOnlineAi?: boolean;
  decision?: 'Accepted Match' | 'Manual Review' | 'No Match';
  manualReview?: boolean;
  matchedCaseId?: string;
  matchedReportId?: string;
  scoreBreakdown?: Record<string, number | undefined>;
  otherCase: {
    id: string;
    displayName: string;
    age?: number;
    gender?: string;
    category?: string;
    status?: string;
    description?: string;
    clothesColor?: string;
    conditionNotes?: string;
    locationText?: string;
    primaryImage?: string | null;
    referenceCode: string;
    type: string;
    contactPhone?: string;
    owner?: {
      name?: string;
      email?: string;
      phone?: string;
      username?: string;
    };
  };
};

type MaterializedPreviewState = {
  caseId?: string;
  matchId?: string;
  conversationId?: string;
  referenceCode?: string;
  confirmationRequested?: boolean;
};

export default function AIMatchFoundPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestId = searchParams.get('rid') || undefined;
  const [matches, setMatches] = useState<PreviewMatch[]>([]);
  const [materialized, setMaterialized] = useState<MaterializedPreviewState>({});
  const [actionBusy, setActionBusy] = useState<'chat' | 'request' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const { user: authUser } = useAuth();
  const user = getDisplayUser(authUser);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const nextMatches = await waitForPendingAiMatches<PreviewMatch>(requestId, 4500);
      if (!cancelled) {
        setMatches(nextMatches.filter((item) => item.decision !== 'No Match'));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    const summary = loadPendingAiSummary(requestId);
    if (!summary) return;
    setMaterialized({
      caseId: summary.materializedCaseId,
      matchId: summary.materializedMatchId,
      conversationId: summary.materializedConversationId,
      referenceCode: summary.materializedReferenceCode,
      confirmationRequested: Boolean(summary.confirmationRequested)
    });
  }, [requestId]);

  const topMatch = useMemo(() => matches[0], [matches]);
  const secondaryMatch = useMemo(() => matches[1], [matches]);
  const hasMatch = Boolean(topMatch);
  const isManualReview = Boolean(topMatch && (topMatch.manualReview || topMatch.decision === 'Manual Review'));
  const preferredPhone = topMatch?.otherCase.contactPhone || topMatch?.otherCase.owner?.phone || '';
  const preferredEmail = topMatch?.otherCase.owner?.email || '';
  const preferredEmailHref = preferredEmail
    ? `mailto:${preferredEmail}?subject=${encodeURIComponent(`Possible match for ${topMatch?.otherCase.referenceCode || 'report'}`)}&body=${encodeURIComponent(`Hello ${topMatch?.otherCase.owner?.name || ''}, I found a possible match related to ${topMatch?.otherCase.referenceCode || 'your report'}. Please review it in RETURN.`)}`
    : '';

  const persistSummary = (updates: Partial<PendingAiSummary>) => {
    const nextSummary: PendingAiSummary = {
      ...(loadPendingAiSummary(requestId) || {}),
      ...updates
    };
    savePendingAiSummary(nextSummary, requestId);
    setMaterialized({
      caseId: nextSummary.materializedCaseId,
      matchId: nextSummary.materializedMatchId,
      conversationId: nextSummary.materializedConversationId,
      referenceCode: nextSummary.materializedReferenceCode,
      confirmationRequested: Boolean(nextSummary.confirmationRequested)
    });
  };

  const ensureMaterializedMatch = async () => {
    if (!topMatch) {
      throw new Error('No match is available right now.');
    }

    if (materialized.caseId && materialized.matchId) {
      return {
        caseId: materialized.caseId,
        matchId: materialized.matchId,
        referenceCode: materialized.referenceCode
      };
    }

    if (materialized.caseId && !materialized.matchId) {
      const existingCase = await api.getCase(materialized.caseId);
      const existingMatch = existingCase.item.matches.find((item) => item.otherCaseId === topMatch.otherCase.id);
      if (existingMatch) {
        persistSummary({
          materializedCaseId: existingCase.item.id,
          materializedMatchId: existingMatch.id,
          materializedReferenceCode: existingCase.item.referenceCode,
          confirmationRequested: Boolean(existingMatch.confirmationRequestedAt)
        });
        return {
          caseId: existingCase.item.id,
          matchId: existingMatch.id,
          referenceCode: existingCase.item.referenceCode
        };
      }
    }

    const sourceImage = getPendingAiImage(requestId);
    if (!sourceImage) {
      throw new Error('The analyzed photo is no longer available. Please run AI recognition again.');
    }

    const summary = loadPendingAiSummary(requestId);
    const autoClothes = topMatch.otherCase.clothesColor || topMatch.otherCase.conditionNotes || '';
    if (topMatch.otherCase.age === undefined || !topMatch.otherCase.locationText || !autoClothes) {
      throw new Error('This match cannot be saved automatically because reports now require age, address, and clothes / visual notes. Please create the found report manually from the report form.');
    }

    const response = await api.createFound({
      name: topMatch.otherCase.displayName || 'Unknown person or item',
      category: topMatch.otherCase.category,
      type: topMatch.otherCase.category || 'child',
      age: topMatch.otherCase.age,
      gender: topMatch.otherCase.gender,
      location: topMatch.otherCase.locationText,
      locationText: topMatch.otherCase.locationText,
      dateTime: new Date().toISOString(),
      clothesColor: autoClothes,
      description: topMatch.otherCase.description || `AI quick recognition linked this found report to ${topMatch.otherCase.referenceCode}.`,
      photo: sourceImage,
      aiAnalysis: summary?.aiAnalysis,
      seedMatch: {
        otherCaseId: topMatch.otherCase.id,
        score: topMatch.score,
        reason: topMatch.reason,
        imageScore: topMatch.imageScore,
        similarity: topMatch.similarity,
        confidence: topMatch.confidence,
        aiPriorityApplied: topMatch.aiPriorityApplied,
        usedAiPhotoPriority: topMatch.usedAiPhotoPriority,
        usedOnlineAi: topMatch.usedOnlineAi,
        decision: topMatch.decision,
        manualReview: topMatch.manualReview,
        scoreBreakdown: topMatch.scoreBreakdown
      }
    });

    const createdMatch = response.item.matches.find((item) => item.otherCaseId === topMatch.otherCase.id);
    persistSummary({
      materializedCaseId: response.item.id,
      materializedReferenceCode: response.item.referenceCode,
      materializedMatchId: createdMatch?.id,
      confirmationRequested: Boolean(createdMatch?.confirmationRequestedAt)
    });

    if (!createdMatch) {
      throw new Error('The report was saved, but the linked match could not be materialized automatically. Please try the action again.');
    }

    return {
      caseId: response.item.id,
      matchId: createdMatch.id,
      referenceCode: response.item.referenceCode
    };
  };

  const openChat = async () => {
    setActionBusy('chat');
    setActionMessage('');
    setActionError('');

    try {
      if (materialized.conversationId) {
        router.push(`/chat?conversationId=${materialized.conversationId}`);
        return;
      }

      const { matchId } = await ensureMaterializedMatch();
      const response = await api.startConversationForMatch({ matchId });
      persistSummary({ materializedConversationId: response.item.id });
      router.push(`/chat?conversationId=${response.item.id}`);
    } catch (chatError) {
      setActionError(chatError instanceof Error ? chatError.message : 'Unable to open chat right now.');
    } finally {
      setActionBusy(null);
    }
  };

  const sendFinalConfirmationRequest = async () => {
    setActionBusy('request');
    setActionMessage('');
    setActionError('');

    try {
      const { caseId, matchId, referenceCode } = await ensureMaterializedMatch();
      await api.requestMatchConfirmation(matchId);
      persistSummary({
        materializedCaseId: caseId,
        materializedMatchId: matchId,
        materializedReferenceCode: referenceCode,
        confirmationRequested: true
      });
      setActionMessage('Final confirmation request sent. Only the missing report owner can approve or reject the final match.');
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Unable to send the final confirmation request.');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans select-none overflow-hidden bg-gradient-to-r from-[#53a63e] via-[#2467b1] to-[#0459a7]">
      <header className="bg-white h-[80px] flex items-center px-6 md:px-10 border-b border-gray-100 shadow-sm z-50">
        <div className="w-full max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <Logo width={40} height={12} className="h-10 md:h-12" />
          </div>
          <nav className="hidden lg:flex items-center space-x-10">
            <Link href="/" className="text-[#84cc16] font-bold border-b-2 border-[#84cc16] pb-1">Home</Link>
            <Link href="/missing" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Missing</Link>
            <Link href="/found-dashboard" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Found</Link>
            <Link href="/devices" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Devices</Link>
            <Link href="/profile" className="text-[#1e40af] font-bold hover:text-[#84cc16]">Profile</Link>
          </nav>
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border shadow-sm" alt="User" />
            <span className="font-bold text-[14px] text-[#1e1e1e]">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 relative">
        <div className="absolute top-8 left-10 hidden md:block">
          <h1 className="text-white text-3xl font-black uppercase tracking-widest drop-shadow-md opacity-80">AI Recognition</h1>
        </div>

        {hasMatch && topMatch ? (
          <>
            <h2 className="text-white text-3xl md:text-5xl font-black mb-8 drop-shadow-lg text-center">
              {isManualReview ? (
                <>Manual <span className="text-[#fde68a]">Review</span></>
              ) : (
                <>Possible Match <span className="text-[#84cc16]">Found</span></>
              )}
            </h2>

            <div className="w-full max-w-[780px] bg-white/20 backdrop-blur-md rounded-[40px] p-8 md:p-12 border border-white/30 shadow-2xl flex flex-col items-center">
              <div className="w-full aspect-[16/9] bg-white rounded-[20px] mb-8 flex items-center justify-center overflow-hidden shadow-inner relative">
                {topMatch.otherCase.primaryImage ? (
                  <img src={topMatch.otherCase.primaryImage} className="w-full h-full object-cover" alt="Matched Result" />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">No photo available</span>
                )}
              </div>

              <div className="w-full flex flex-wrap items-center gap-3 mb-6">
                <span className="rounded-full border border-[#d7f7b5] bg-[#84cc16]/25 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white">
                  {Math.round(topMatch.score * 100)}% final score
                </span>
                <span className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white border ${isManualReview ? 'border-[#fde68a]/70 bg-[#f59e0b]/20' : 'border-[#d7f7b5] bg-[#84cc16]/25'}`}>
                  {topMatch.decision || 'Accepted Match'}
                </span>
                {topMatch.usedOnlineAi ? (
                  <span className="rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white">
                    Local face AI
                  </span>
                ) : null}
                {topMatch.usedAiPhotoPriority ? (
                  <span className="rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white">
                    AI image assist
                  </span>
                ) : null}
                {topMatch.scoreBreakdown?.metadata !== undefined ? (
                  <span className="rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white">
                    Data {Math.round(topMatch.scoreBreakdown.metadata * 100)}%
                  </span>
                ) : null}
                {topMatch.imageScore !== undefined ? (
                  <span className="rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white">
                    Image {Math.round(topMatch.imageScore * 100)}%
                  </span>
                ) : null}
                {materialized.confirmationRequested ? (
                  <span className="rounded-full border border-white/30 bg-[#014CB3]/30 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-white">
                    Final request sent
                  </span>
                ) : null}
              </div>

              {actionMessage ? (
                <div className="mb-5 w-full rounded-[24px] border border-[#c9f0a2]/40 bg-[#60C10F]/15 px-5 py-4 text-sm font-bold text-white">
                  {actionMessage}
                </div>
              ) : null}

              {actionError ? (
                <div className="mb-5 w-full rounded-[24px] border border-red-200/40 bg-red-500/15 px-5 py-4 text-sm font-bold text-white">
                  {actionError}
                </div>
              ) : null}

              <div className="w-full space-y-5">
                <div className="grid gap-4">
                  {[
                    ['Name', topMatch.otherCase.displayName],
                    ['Age', topMatch.otherCase.age !== undefined ? `${topMatch.otherCase.age} years` : 'Unknown'],
                    ['Last Seen', topMatch.otherCase.locationText || 'Unknown location']
                  ].map(([label, value]) => (
                    <div key={String(label)} className="grid gap-3 md:grid-cols-[160px,1fr] md:items-center">
                      <span className="text-white text-xl md:text-2xl font-extrabold tracking-tight">{label}</span>
                      <div className="bg-white/30 min-h-12 rounded-2xl border border-white/40 flex items-center px-6 text-white font-bold text-base md:text-lg py-3 break-words">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/20 bg-white/15 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/70 mb-2">Matched report owner</p>
                    <p className="text-white text-base md:text-lg font-black leading-tight break-words">{topMatch.otherCase.owner?.name || 'Not available'}</p>
                    <p className="mt-2 text-sm text-white/80 break-all">{topMatch.otherCase.owner?.username ? `@${topMatch.otherCase.owner.username}` : 'Matched account'}</p>
                    <div className="mt-4 space-y-2 text-sm text-white/85">
                      <p className="break-words"><span className="font-black text-white">Phone:</span> {preferredPhone || 'Not available'}</p>
                      <p className="break-all"><span className="font-black text-white">Email:</span> {preferredEmail || 'Not available'}</p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/20 bg-white/15 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/70 mb-2">Matched report</p>
                    <p className="text-white text-base md:text-lg font-black leading-tight break-words">{topMatch.otherCase.referenceCode}</p>
                    <p className="mt-2 text-sm text-white/80">{topMatch.otherCase.status || 'Active report'}</p>
                    <div className="mt-4 space-y-2 text-sm text-white/85">
                      <p><span className="font-black text-white">Type:</span> {topMatch.otherCase.type}</p>
                      <p className="break-words"><span className="font-black text-white">Category:</span> {topMatch.otherCase.category || 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/20 bg-white/15 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/70 mb-2">Why the system selected this report</p>
                  <p className="text-white text-sm md:text-base leading-relaxed">{topMatch.reason}</p>
                </div>

                {secondaryMatch ? (
                  <div className="rounded-[24px] border border-white/20 bg-white/15 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-white/70 mb-2">Second best match</p>
                        <p className="text-white text-base md:text-lg font-black break-words">{secondaryMatch.otherCase.displayName}</p>
                        <p className="mt-1 text-sm text-white/80 break-words">{secondaryMatch.otherCase.referenceCode} • {Math.round(secondaryMatch.score * 100)}% confidence</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/20"
                        onClick={() => router.push(`/case-details?caseId=${secondaryMatch.otherCase.id}`)}
                      >
                        Open second match
                      </button>
                    </div>
                    <p className="mt-4 text-sm md:text-base leading-relaxed text-white/90">{secondaryMatch.reason}</p>
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-white/20 bg-white/15 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/70 mb-2">Final decision flow</p>
                  <p className="text-white text-sm md:text-base leading-relaxed">
                    You can open chat right away, but the final yes or no decision belongs only to the missing report owner. The report data leads the decision, and the photo stays as a helper score. When you send the final confirmation request, this result is saved as a real found report and the missing owner receives the final decision request.
                  </p>
                </div>

                {isManualReview ? (
                  <div className="rounded-[24px] border border-[#fde68a]/40 bg-[#f59e0b]/15 p-5 text-white">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/70 mb-2">Review note</p>
                    <p className="text-sm md:text-base leading-relaxed">
                      This result is close to the acceptance line, so it stays available for manual review, chat, and a final confirmation request to the missing owner.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                disabled={actionBusy !== null}
                className="bg-[#66bc1b] hover:bg-[#58a316] disabled:opacity-60 text-white px-10 py-4 rounded-[15px] text-xl font-black shadow-[0_8px_0_rgb(34,70,12)] active:translate-y-1 active:shadow-none transition-all duration-100"
                onClick={() => void openChat()}
              >
                {actionBusy === 'chat' ? 'Opening chat...' : 'Open chat'}
              </button>

              <button
                disabled={actionBusy !== null || materialized.confirmationRequested}
                className="bg-white text-[#0459a7] hover:bg-[#eef7ff] disabled:opacity-60 px-10 py-4 rounded-[15px] text-xl font-black border border-white/30 transition-all duration-100"
                onClick={() => void sendFinalConfirmationRequest()}
              >
                {materialized.confirmationRequested
                  ? 'Final request sent'
                  : actionBusy === 'request'
                    ? 'Sending request...'
                    : 'Send final confirmation request'}
              </button>

              {preferredPhone ? (
                <a
                  href={`tel:${preferredPhone}`}
                  className="bg-white/20 hover:bg-white/30 text-white px-10 py-4 rounded-[15px] text-xl font-black border border-white/30 transition-all duration-100"
                >
                  Call owner
                </a>
              ) : null}

              {preferredEmail ? (
                <a
                  href={preferredEmailHref}
                  className="bg-white/20 hover:bg-white/30 text-white px-10 py-4 rounded-[15px] text-xl font-black border border-white/30 transition-all duration-100"
                >
                  Email owner
                </a>
              ) : null}

              <button
                className="bg-white/15 hover:bg-white/25 text-white px-10 py-4 rounded-[15px] text-xl font-black border border-white/30 transition-all duration-100"
                onClick={() => router.push(`/case-details?caseId=${topMatch.otherCase.id}`)}
              >
                Open matched report
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-white max-w-2xl">
            <h2 className="text-4xl font-black mb-6">No Match Found</h2>
            <p className="text-lg leading-relaxed">No saved report crossed the face-matching threshold for this photo. Try another image or create a found report so the system can keep tracking future matches.</p>
            <button
              className="mt-8 bg-white text-[#0459a7] px-10 py-4 rounded-[15px] text-xl font-black"
              onClick={() => router.push('/found-dashboard')}
            >
              Back to dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
