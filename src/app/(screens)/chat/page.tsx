'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Mail, MessageCircle, RefreshCw, Send, UserCircle, Wifi, WifiOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import type { ConversationDetail, ConversationMessageItem, ConversationSummary } from '@/lib/shared-types';

const POLL_INTERVAL_MS = 2000;

type PendingMessage = ConversationMessageItem & { failed?: boolean };

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get('conversationId');
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(conversationIdParam);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingBody, setPendingBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const syncConversationState = useCallback((detail: ConversationDetail | null) => {
    setSelectedConversation(detail);
    if (!detail) return;
    setConversations((current) => {
      const summary: ConversationSummary = {
        id: detail.id,
        title: detail.title,
        relatedCaseId: detail.relatedCaseId,
        relatedMatchId: detail.relatedMatchId,
        caseIds: detail.caseIds,
        participants: detail.participants,
        lastMessage: detail.messages[detail.messages.length - 1],
        unreadCount: detail.unreadCount,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt
      };
      const exists = current.some((item) => item.id === detail.id);
      const next = exists ? current.map((item) => (item.id === detail.id ? { ...item, ...summary } : item)) : [summary, ...current];
      return next.sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
    });
  }, []);

  const loadConversationDetail = useCallback(async (conversationId: string, silent = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (silent) setSyncing(true);
    try {
      const detail = await api.getConversation(conversationId);
      syncConversationState(detail.item);
      setError('');
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to open this chat.');
      }
    } finally {
      syncingRef.current = false;
      if (silent) setSyncing(false);
    }
  }, [syncConversationState]);

  const loadConversations = useCallback(async (preferredId?: string | null, options?: { silent?: boolean }) => {
    if (options?.silent) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await api.conversations();
      setConversations(response.items);
      const targetId = preferredId || response.items[0]?.id || null;
      setSelectedId(targetId);
      if (targetId) {
        await loadConversationDetail(targetId, Boolean(options?.silent));
      } else {
        setSelectedConversation(null);
      }
      if (!options?.silent) {
        setError('');
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load chats.';
      if (!options?.silent || conversations.length === 0) {
        setError(message);
      }
    } finally {
      if (options?.silent) {
        setSyncing(false);
      } else {
        setLoading(false);
      }
    }
  }, [conversations.length, loadConversationDetail]);

  useEffect(() => {
    void loadConversations(conversationIdParam);
  }, [conversationIdParam, loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = window.setInterval(() => {
      void loadConversationDetail(selectedId, true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadConversationDetail, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selectedConversation?.messages.length, selectedId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const selectConversation = async (conversationId: string) => {
    setSelectedId(conversationId);
    setError('');
    router.replace(`/chat?conversationId=${conversationId}`);
    await loadConversationDetail(conversationId, false);
  };

  const injectMessageIntoConversation = useCallback((message: PendingMessage) => {
    setSelectedConversation((current) => {
      if (!current) return current;
      const withoutTemp = current.messages.filter((entry) => !entry.id.startsWith('temp_'));
      return {
        ...current,
        updatedAt: message.createdAt,
        messages: [...withoutTemp, message],
        lastMessage: message
      };
    });
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === message.conversationId
          ? { ...conversation, updatedAt: message.createdAt, lastMessage: message }
          : conversation
      )
    );
  }, []);

  const sendMessage = async (bodyOverride?: string) => {
    if (!selectedId || sending) return;
    const body = (bodyOverride ?? input).trim();
    if (!body) return;

    const optimisticMessage: PendingMessage = {
      id: `temp_${Date.now()}`,
      conversationId: selectedId,
      senderUserId: user?.id || 'me',
      body,
      type: 'TEXT',
      createdAt: new Date().toISOString(),
      sender: user || undefined,
      isMine: true
    };

    setSending(true);
    setError('');
    setInput('');
    setPendingBody('');
    injectMessageIntoConversation(optimisticMessage);

    try {
      let response;
      try {
        response = await api.sendConversationMessage(selectedId, { body });
      } catch (firstError) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        response = await api.sendConversationMessage(selectedId, { body });
      }
      injectMessageIntoConversation(response.item);
      await loadConversationDetail(selectedId, true);
    } catch (sendError) {
      setInput(body);
      setPendingBody(body);
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
      injectMessageIntoConversation({ ...optimisticMessage, failed: true });
    } finally {
      setSending(false);
    }
  };

  const selectedPartnerName = useMemo(() => {
    const other = selectedConversation?.participants.find((participant) => participant.id !== user?.id);
    return other?.name || 'Match partner';
  }, [selectedConversation?.participants, user?.id]);

  return (
    <div className="w-full h-screen bg-white flex flex-col font-sans overflow-hidden">
      <header className="h-[80px] w-full border-b border-gray-200 flex items-center justify-between px-8 bg-white z-50">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => router.push('/')}>
          <span className="text-[#1e40af] font-black text-3xl">Re</span>
          <div className="w-8 h-8 bg-[#84cc16] rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
          </div>
          <span className="text-[#84cc16] font-black text-3xl">t</span>
          <span className="text-[#1e40af] font-black text-3xl">urn</span>
        </div>

        <nav className="hidden md:flex items-center gap-10">
          {[
            { label: 'Home', href: '/lost-dashboard' },
            { label: 'Missing', href: '/missing' },
            { label: 'Found', href: '/found-dashboard' },
            { label: 'Devices', href: '/devices' },
            { label: 'Profile', href: '/profile' }
          ].map((item) => (
            <Link key={item.label} href={item.href} className="text-sm font-bold text-[#1e40af] hover:text-[#84cc16] transition-colors">{item.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isOnline ? <Wifi className="w-5 h-5 text-emerald-600" /> : <WifiOff className="w-5 h-5 text-red-500" />}
          <UserCircle className="w-10 h-10 text-[#1e40af]" />
          <span className="font-bold text-[#1e40af] text-sm">{user?.name || 'Return user'}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-gradient-to-br from-[#77bc43] via-[#45a46e] to-[#136eb1]">
        <aside className="w-[340px] bg-gradient-to-b from-[#84cc16] via-[#45a46e] to-[#136eb1] text-white flex flex-col border-r border-white/10">
          <div className="flex justify-between items-center px-6 py-6 border-b border-white/5">
            <Mail className="text-white/80" size={20} />
            <Bell className="text-white/80" size={20} />
            <MessageCircle className="text-white" size={20} />
          </div>

          <div className="px-5 py-4 border-b border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Active chats</h2>
                <p className="text-xs text-white/70 mt-1">Open any confirmed or potential match to contact the other person directly.</p>
              </div>
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin text-white/80" /> : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 rounded-3xl bg-white/10 animate-pulse" />
              ))
            ) : conversations.length > 0 ? (
              conversations.map((conversation) => {
                const partner = conversation.participants.find((participant) => participant.id !== user?.id) || conversation.participants[0];
                const isActive = selectedId === conversation.id;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => void selectConversation(conversation.id)}
                    className={`w-full text-left rounded-3xl border px-4 py-4 transition ${isActive ? 'bg-white/20 border-white/30 shadow-xl' : 'bg-white/10 border-white/10 hover:bg-white/15'}`}
                  >
                    <div className="flex items-start gap-3">
                      <UserCircle className="w-10 h-10 text-white/90 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-sm truncate">{partner?.name || conversation.title}</p>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 mt-1 truncate">{conversation.title}</p>
                        <p className="text-sm text-white/80 mt-2 truncate">{conversation.lastMessage?.body || 'No messages yet'}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-white/60">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle size={32} />
                </div>
                <p className="font-bold text-lg text-white mb-2">No active chats</p>
                <p className="text-xs">When a match is created, start a conversation from the case details page.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 bg-gray-100 flex flex-col overflow-hidden">
          <div className="h-[72px] bg-white/10 flex items-center justify-between px-8 border-b border-white/10">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold italic">R</div>
              <div>
                <p className="font-bold text-sm">{selectedPartnerName}</p>
                <p className="text-[10px] opacity-60">Private match conversation</p>
              </div>
            </div>
            {selectedConversation ? (
              <button
                onClick={() => void loadConversationDetail(selectedConversation.id, true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mx-8 mt-4 rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center justify-between gap-3">
              <span>{error}</span>
              {pendingBody ? (
                <button onClick={() => void sendMessage(pendingBody)} className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-700">
                  Retry send
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
            {selectedConversation ? (
              <>
                {selectedConversation.messages.map((message) => {
                  const failed = String(message.id).startsWith('temp_');
                  return (
                    <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-3xl px-5 py-4 shadow ${message.isMine ? 'bg-[#014CB3] text-white' : 'bg-white text-gray-800'}`}>
                        <p className="text-[11px] uppercase tracking-[0.2em] opacity-60 mb-2">{message.sender?.name || 'System'}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <p className="text-[10px] opacity-60">{new Date(message.createdAt).toLocaleString()}</p>
                          {failed ? <span className="text-[10px] font-bold text-amber-200">Sending…</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                <MessageCircle size={80} className="text-white mb-4" />
                <p className="text-white text-xs tracking-widest uppercase font-bold text-center">Select a conversation to start chatting</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/10 bg-white/10">
            <div className="rounded-3xl bg-white shadow-xl flex items-center gap-3 px-4 py-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={selectedConversation ? 'Write a message…' : 'Open a conversation first'}
                disabled={!selectedConversation || sending}
                className="flex-1 outline-none text-sm text-gray-700 placeholder:text-gray-400 disabled:bg-transparent"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!selectedConversation || sending || !input.trim()}
                className="w-11 h-11 rounded-full bg-[#60C10F] text-[#014CB3] flex items-center justify-center shadow disabled:opacity-50"
              >
                {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-white flex items-center justify-center font-bold text-sm text-gray-600">
          Loading chat...
        </div>
      )}
    >
      <ChatPageContent />
    </Suspense>
  );
}
