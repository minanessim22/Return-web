'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Clipboard, Search, AlertCircle } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  eventType: string;
  severity: 'info' | 'warn' | 'critical';
  target: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Expandable metadata state
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const shadowHandler = setTimeout(() => {
      setDebouncedSearch(eventTypeFilter);
      setPage(1);
    }, 300);
    return () => clearTimeout(shadowHandler);
  }, [eventTypeFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/admin/audit?page=${page}&eventType=${encodeURIComponent(debouncedSearch)}&severity=${severityFilter}`;
      const response = await fetch(url, { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to retrieve audit logs');
      }

      setLogs(payload.logs || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [page, debouncedSearch, severityFilter]);

  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSeverityFilter(e.target.value);
    setPage(1);
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'warn':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link href="/admin/db" className="text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Admin Database
              </Link>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <Clipboard className="w-8 h-8 text-indigo-400" /> System Audit Trail
            </h1>
            <p className="text-sm text-slate-400">
              Enterprise-wide immutable logging of system and security events.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-right">
            <span className="text-xs text-slate-500 block">Total Audited Events</span>
            <span className="text-2xl font-bold text-slate-200">{total}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Event Type (e.g. LOGIN_SUCCESS)..."
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <select
              value={severityFilter}
              onChange={handleSeverityChange}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="ALL">All Severities</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex items-center justify-end text-xs text-slate-500">
            {loading ? 'Refreshing logs...' : 'System events verified'}
          </div>
        </div>

        {/* Errors */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Logging Error</h4>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Table / Results */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 tracking-wider">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Event Type</th>
                  <th className="py-4 px-6">Severity</th>
                  <th className="py-4 px-6">Target</th>
                  <th className="py-4 px-6">Client IP</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Loading secure audit entries...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No matching audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-4 px-6 font-mono text-xs text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 font-semibold text-indigo-300">
                          {log.eventType}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium uppercase ${getSeverityBadgeClass(log.severity)}`}>
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-400 font-mono text-xs">
                          {log.target || '-'}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-400">
                          {log.ip || '-'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-semibold focus:outline-none"
                          >
                            {expandedLogId === log.id ? 'Hide Details' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                      {expandedLogId === log.id && (
                        <tr>
                          <td colSpan={6} className="bg-slate-950/50 py-4 px-8 border-t border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="space-y-2">
                                <p><span className="text-slate-500">Log ID:</span> {log.id}</p>
                                <p><span className="text-slate-500">User ID:</span> {log.userId || 'Guest / Non-Authenticated'}</p>
                                <p><span className="text-slate-500">User Agent:</span> {log.userAgent || 'Not Provided'}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-slate-500">Metadata Payload:</p>
                                <pre className="bg-slate-900 border border-slate-800 rounded p-3 overflow-x-auto text-slate-300 max-h-48 max-w-full">
                                  {log.metadata ? JSON.stringify(log.metadata, null, 2) : 'No Metadata Provided'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800 py-4 px-6 bg-slate-900/30 text-sm">
              <span className="text-slate-500">
                Page <strong className="text-slate-300">{page}</strong> of <strong className="text-slate-300">{totalPages}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-slate-800 rounded-lg hover:bg-slate-900/50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-slate-800 rounded-lg hover:bg-slate-900/50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
