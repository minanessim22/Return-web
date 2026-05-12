'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, CalendarDays, Filter, ImageIcon, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import type { CaseItem, CaseStatus, CaseType } from '@/lib/shared-types';

type Labels = {
  explore: string;
  view: string;
  name: string;
  age: string;
  lastSeen: string;
  approxInfo: string;
  foundAt: string;
  type: string;
  status: string;
  reference: string;
  description: string;
};

type CaseCollectionSectionProps = {
  title: string;
  description?: string;
  scope: 'my' | 'global';
  caseType?: CaseType;
  presetStatus?: CaseStatus;
  isRTL?: boolean;
  labels: Labels;
  emptyTitle: string;
  emptyBody: string;
  addReportHref?: string;
  addReportLabel?: string;
  excludeResolved?: boolean;
  allowedStatuses?: CaseStatus[];
  excludeStatuses?: CaseStatus[];
};

type SortValue = 'latest' | 'oldest' | 'best_match' | 'recent_update';

const STATUS_STYLES: Record<CaseStatus, string> = {
  DRAFT: 'bg-white/15 border-white/25 text-white',
  ACTIVE: 'bg-sky-500/20 border-sky-200/50 text-white',
  UNDER_REVIEW: 'bg-amber-500/20 border-amber-200/50 text-white',
  MATCHED: 'bg-emerald-500/20 border-emerald-200/60 text-white',
  RESOLVED: 'bg-fuchsia-500/20 border-fuchsia-200/50 text-white',
  CLOSED: 'bg-slate-500/20 border-slate-200/50 text-white'
};

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
    gender: report.gender,
    clothesColor: report.clothesColor,
    matches: report.matches
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem('currentReport', JSON.stringify(snapshot));
    localStorage.setItem('lastReportData', JSON.stringify(snapshot));
    localStorage.setItem('lastCreatedCaseId', report.id);
  }
}

function formatWhen(report: CaseItem) {
  const raw = report.eventTime || report.lastSeenAt || report.foundAt || report.createdAt;
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleString();
}

function renderAgeInfo(report: CaseItem) {
  if (report.age !== undefined) return `${report.age} years`;
  if (report.category) return report.category;
  if (report.gender) return report.gender;
  return '—';
}

function renderApproxInfo(report: CaseItem) {
  const pieces = [report.displayName, report.age !== undefined ? `${report.age} years` : undefined, report.gender, report.clothesColor]
    .filter(Boolean)
    .join(' • ');
  return pieces || report.description || 'No approximate information available.';
}

function navigateToCase(report: CaseItem, view?: string) {
  saveCaseSnapshot(report);
  const query = view ? `?caseId=${report.id}&view=${view}` : `?caseId=${report.id}`;
  window.location.href = `/case-details${query}`;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge className={`px-3 py-1 uppercase tracking-[0.18em] text-[11px] font-black ${STATUS_STYLES[status]}`}>
      {status === 'MATCHED' ? 'MATCHED ✓' : status}
    </Badge>
  );
}

function CaseCard({
  report,
  kind,
  labels,
  showTypeBadge,
  allowDelete = false,
  deleting = false,
  onDelete
}: {
  report: CaseItem;
  kind: 'missing' | 'found' | 'mixed';
  labels: Labels;
  showTypeBadge?: boolean;
  allowDelete?: boolean;
  deleting?: boolean;
  onDelete?: (report: CaseItem) => void;
}) {
  const image = report.primaryImage || null;
  const location = report.locationText || 'Location not specified';
  const displayName = report.displayName || 'Unknown case';
  const isFoundCard = kind === 'found' || (kind === 'mixed' && report.type === 'FOUND');
  const bestMatch = report.matches[0];

  return (
    <div className="bg-gradient-to-br from-[#1388e2]/33 to-[#2ecc71]/33 rounded-3xl border border-white/20 shadow-2xl overflow-hidden min-h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full">
        <div className="h-72 lg:h-full bg-white/70">
          {image ? (
            <img src={image} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-[#014CB3]/70">
              <ImageIcon className="w-16 h-16" />
              <span className="mt-2 text-sm font-semibold">No Photo</span>
            </div>
          )}
        </div>

        <div className="p-6 text-white flex flex-col">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {showTypeBadge ? (
              <Badge className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-black tracking-[0.2em] uppercase text-white">
                {report.type}
              </Badge>
            ) : null}
            <StatusBadge status={report.status} />
            {report.matches.length > 0 ? (
              <button
                onClick={() => navigateToCase(report, 'matches')}
                className="px-3 py-1 rounded-full bg-[#60C10F]/35 border border-[#b6ef86] text-xs font-black tracking-[0.2em] uppercase hover:bg-[#60C10F]/50 transition"
              >
                {report.matches.length} match{report.matches.length > 1 ? 'es' : ''}
              </button>
            ) : null}
          </div>

          <h3 className="text-2xl font-black tracking-tight mb-3">{displayName}</h3>
          {bestMatch ? (
            <div className="mb-4 rounded-2xl border border-[#c9f0a2] bg-[#60C10F]/15 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#dff7c3] mb-1">Best match</p>
              <p className="font-bold text-white">{bestMatch.otherCaseDisplayName}</p>
              <p className="text-xs text-white/80 mt-1">{Math.round(bestMatch.score * 100)}% confidence • tap the badge to view all matches</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
            <div>
              <p className="text-white/70 text-xs uppercase">{isFoundCard ? labels.approxInfo : labels.age}</p>
              <p className="font-bold text-base line-clamp-2">{isFoundCard ? renderApproxInfo(report) : renderAgeInfo(report)}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase">{labels.type}</p>
              <p className="font-bold text-base">{report.category || report.type}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase">{isFoundCard ? labels.foundAt : labels.lastSeen}</p>
              <p className="font-bold text-base truncate">{location}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase">{labels.status}</p>
              <p className="font-bold text-base">{report.status}</p>
            </div>
          </div>

          <div className="bg-white/15 rounded-xl border border-white/20 p-3 mb-4">
            <h4 className="text-xs text-white/80 uppercase tracking-wider mb-1">{labels.description}</h4>
            <p className="text-sm text-white/90 min-h-[44px]">{report.description || report.conditionNotes || 'No description provided.'}</p>
          </div>

          <div className="bg-white/15 rounded-xl border border-white/20 p-3 mb-2">
            <h4 className="text-xs text-white/80 uppercase tracking-wider mb-1">{labels.reference}</h4>
            <p className="text-sm text-white/90 truncate">{report.referenceCode || 'Not available'}</p>
            <p className="mt-2 text-[11px] text-white/60">Database ID: {report.id}</p>
          </div>
          <p className="text-[11px] text-white/70 mb-5">Updated: {formatWhen(report)}</p>

          <div className="mt-auto flex flex-wrap gap-3">
            <button
              onClick={() => navigateToCase(report)}
              className="flex-1 min-w-[180px] py-3 bg-white/20 hover:bg-white/35 text-white font-bold rounded-full border border-white/40 transition-all"
            >
              {labels.view}
            </button>
            {allowDelete ? (
              <button
                onClick={() => onDelete?.(report)}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200/50 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-100 hover:bg-red-500/20 transition disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete report'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CaseCollectionSection({
  title,
  description,
  scope,
  caseType,
  presetStatus,
  isRTL = false,
  labels,
  emptyTitle,
  emptyBody,
  addReportHref,
  addReportLabel,
  excludeResolved = true,
  allowedStatuses,
  excludeStatuses = []
}: CaseCollectionSectionProps) {
  const [items, setItems] = useState<CaseItem[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('latest');
  const initialStatusFilter = presetStatus || (allowedStatuses && allowedStatuses.length === 1 ? allowedStatuses[0] : 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'HAS_MATCHES' | 'NO_MATCHES'>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadItems = async () => {
      try {
        const effectiveStatus = allowedStatuses && allowedStatuses.length === 1 ? allowedStatuses[0] : presetStatus;
        const params = {
          type: caseType,
          status: effectiveStatus,
          limit: 50,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sort: sortBy
        };
        const response = scope === 'my' ? await api.myReports(params) : await api.cases(params);
        if (!cancelled) {
          setItems(response.items);
        }
      } catch (error) {
        console.warn('Unable to load case collection', { scope, caseType, error });
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadItems();
    return () => {
      cancelled = true;
    };
  }, [allowedStatuses, caseType, presetStatus, scope, categoryFilter, dateFrom, dateTo, sortBy]);

  useEffect(() => {
    setStatusFilter(presetStatus || (allowedStatuses && allowedStatuses.length === 1 ? allowedStatuses[0] : 'ALL'));
  }, [allowedStatuses, presetStatus]);

  const categoryOptions = useMemo<string[]>(() => {
    const values = Array.from(new Set(items.map((item) => (item.category || '').trim()).filter(Boolean) as string[]));
    return values.sort((left, right) => left.localeCompare(right));
  }, [items]);

  const statusOptions = useMemo<CaseStatus[]>(() => {
    const values = Array.from(new Set(items.map((item) => item.status).filter(Boolean) as CaseStatus[]));
    return values.sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    return items.filter((report) => {
      if (allowedStatuses && allowedStatuses.length > 0 && !allowedStatuses.includes(report.status)) {
        return false;
      }
      if (excludeStatuses.length > 0 && excludeStatuses.includes(report.status)) {
        return false;
      }
      if (excludeResolved && !presetStatus && (!allowedStatuses || allowedStatuses.length === 0) && (report.status === 'RESOLVED' || report.status === 'CLOSED')) {
        return false;
      }
      if (statusFilter !== 'ALL' && report.status !== statusFilter) {
        return false;
      }
      if (matchFilter === 'HAS_MATCHES' && report.matches.length === 0) {
        return false;
      }
      if (matchFilter === 'NO_MATCHES' && report.matches.length > 0) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        report.displayName,
        report.description,
        report.locationText,
        report.referenceCode,
        report.category,
        report.clothesColor,
        report.conditionNotes,
        report.owner?.name,
        report.matches.map((item) => item.otherCaseDisplayName).join(' ')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [allowedStatuses, excludeStatuses, items, searchValue, statusFilter, matchFilter, presetStatus, excludeResolved]);


  const handleDeleteReport = async (report: CaseItem) => {
    const confirmed = typeof window === 'undefined' ? true : window.confirm(isRTL ? `هل تريد حذف البلاغ ${report.referenceCode}؟` : `Delete report ${report.referenceCode}?`);
    if (!confirmed) return;

    setDeletingId(report.id);
    try {
      await api.deleteCase(report.id);
      setItems((current) => current.filter((item) => item.id !== report.id));
    } catch (error) {
      console.warn('Unable to delete report', error);
      if (typeof window !== 'undefined') {
        window.alert(error instanceof Error ? error.message : 'Unable to delete this report.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const kind: 'missing' | 'found' | 'mixed' = caseType === 'MISSING' ? 'missing' : caseType === 'FOUND' ? 'found' : 'mixed';

  return (
    <>
      <div className="flex justify-between items-start px-2 py-4 border-b border-white/20 mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">{title}</h2>
          {description ? <p className="text-white/75 text-sm mt-2 max-w-2xl">{description}</p> : null}
        </div>

        <div className={`flex items-center gap-3 flex-wrap ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className="flex items-center bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-4 py-1.5 gap-2">
            <Search className="w-4 h-4 text-white/70" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={labels.explore}
              className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-40"
            />
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-white/90">
            <Filter className="w-4 h-4" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="bg-transparent text-sm outline-none">
              <option value="ALL" className="text-black">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value} className="text-black">{value}</option>
              ))}
            </select>
          </div>

          <div className="rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-white/90">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent text-sm outline-none">
              <option value="ALL" className="text-black">All statuses</option>
              {statusOptions.map((value) => (
                <option key={value} value={value} className="text-black">{value}</option>
              ))}
            </select>
          </div>

          <div className="rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-white/90">
            <select value={matchFilter} onChange={(event) => setMatchFilter(event.target.value as typeof matchFilter)} className="bg-transparent text-sm outline-none">
              <option value="ALL" className="text-black">All reports</option>
              <option value="HAS_MATCHES" className="text-black">Matched only</option>
              <option value="NO_MATCHES" className="text-black">Without matches</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-white/90">
            <CalendarDays className="w-4 h-4" />
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="bg-transparent text-sm outline-none" />
            <span className="text-white/50">→</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="bg-transparent text-sm outline-none" />
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-white/90">
            <ArrowUpDown className="w-4 h-4" />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortValue)} className="bg-transparent text-sm outline-none">
              <option value="latest" className="text-black">Latest</option>
              <option value="oldest" className="text-black">Oldest</option>
              <option value="best_match" className="text-black">Best match</option>
              <option value="recent_update" className="text-black">Recent update</option>
            </select>
          </div>

          {addReportHref && addReportLabel ? (
            <Link href={addReportHref} className="px-4 py-2 rounded-full bg-white/20 text-white font-black hover:bg-white/30 transition-all border border-white/20 whitespace-nowrap">
              {addReportLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white/10 rounded-3xl border border-white/15 h-[380px] animate-pulse" />
          ))
        ) : filteredItems.length > 0 ? (
          filteredItems.map((report) => (
            <CaseCard
              key={report.id}
              report={report}
              kind={kind}
              labels={labels}
              showTypeBadge={kind === 'mixed'}
              allowDelete={scope === 'my'}
              deleting={deletingId === report.id}
              onDelete={handleDeleteReport}
            />
          ))
        ) : (
          <div className="col-span-full text-center text-white/80 py-20 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md">
            <h3 className="text-2xl font-black mb-3">{emptyTitle}</h3>
            <p className="text-sm max-w-xl mx-auto">{emptyBody}</p>
          </div>
        )}
      </div>
    </>
  );
}
