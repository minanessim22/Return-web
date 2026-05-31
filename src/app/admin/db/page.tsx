'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Database, Eye, Search } from 'lucide-react';
import { compactAdminDbValue, getAdminDbDisplayColumns, getAdminDbRowKey, prettyAdminDbValue } from '@/lib/admin-db';

type TableSummary = {
  name: string;
  storeKey: string;
  count: number;
  columns: Array<{ name: string; type: string }>;
};

type UserMetrics = {
  users: number;
  currentUsers: number;
  activeUsers: number;
  deletedUsers: number;
  totalRows: number;
};

type TableRow = Record<string, unknown>;

const PREVIEW_STYLE = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 2,
  overflow: 'hidden'
};

export default function AdminDatabasePage() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbFile, setDbFile] = useState('');
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTables = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/db', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load database summary.');

      const nextTables = payload.tables || [];
      setTables(nextTables);
      setDbFile(payload.file || '');
      setUserMetrics(payload.userMetrics || null);
      setSelectedTable((current) => {
        const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('table') : '';
        const preferred = requested && nextTables.some((table: TableSummary) => table.name === requested || table.storeKey === requested)
          ? requested
          : current;
        const resolved = preferred && nextTables.some((table: TableSummary) => table.name === preferred || table.storeKey === preferred)
          ? preferred
          : nextTables[0]?.name || 'cases';
        return resolved;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load database summary.');
    } finally {
      setLoading(false);
    }
  };

  const loadRows = async (table: string, nextPage = page, nextLimit = limit) => {
    if (!table) return;
    setTableLoading(true);
    setError('');
    setCopied(false);

    try {
      const offset = Math.max(0, (nextPage - 1) * nextLimit);
      const response = await fetch(`/api/admin/db/${table}?limit=${nextLimit}&offset=${offset}`, {
        credentials: 'include',
        cache: 'no-store'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load table rows.');

      const nextRows = payload.rows || [];
      setRows(nextRows);
      setSelectedRowKey(nextRows[0] ? getAdminDbRowKey(nextRows[0], 0) : null);
    } catch (loadError) {
      setRows([]);
      setSelectedRowKey(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load table rows.');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('table', selectedTable);
      window.history.replaceState({}, '', url.toString());
    }
    void loadRows(selectedTable, page, limit);
  }, [selectedTable, page, limit]);

  const selectedTableMeta = useMemo(
    () => tables.find((table) => table.name === selectedTable || table.storeKey === selectedTable),
    [selectedTable, tables]
  );

  const totalRows = selectedTableMeta?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / limit));

  const columns = useMemo(() => getAdminDbDisplayColumns(rows), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query));
  }, [rows, search]);

  const selectedRow = useMemo(() => {
    if (filteredRows.length === 0) return null;
    const found = filteredRows.find((row, index) => getAdminDbRowKey(row, index) === selectedRowKey);
    return found || filteredRows[0];
  }, [filteredRows, selectedRowKey]);

  useEffect(() => {
    if (!selectedRow && filteredRows[0]) {
      setSelectedRowKey(getAdminDbRowKey(filteredRows[0], 0));
      return;
    }
    if (selectedRow) {
      const key = getAdminDbRowKey(selectedRow, filteredRows.indexOf(selectedRow));
      if (key !== selectedRowKey) {
        setSelectedRowKey(key);
      }
    }
  }, [filteredRows, selectedRow, selectedRowKey]);

  const detailEntries = useMemo(() => {
    if (!selectedRow) return [];
    return Object.entries(selectedRow).filter(([key]) => key !== 'payload').slice(0, 10);
  }, [selectedRow]);

  const handleCopy = async () => {
    if (!selectedRow || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(prettyAdminDbValue(selectedRow.payload ?? selectedRow));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#014CB3] to-[#60C10F] p-6 text-white md:p-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Admin database</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Database tables viewer</h1>
            <p className="mt-3 max-w-3xl text-white/75">
              Browse live tables in a compact layout, inspect the selected row in a dedicated details panel, and keep large payloads out of the main grid so rows stay readable.
            </p>
            {dbFile ? <p className="mt-2 text-xs text-white/70">Database connection: {dbFile}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 font-bold transition hover:bg-white/20">
              <ArrowLeft className="h-4 w-4" /> Back to admin
            </Link>
          </div>
        </div>

        {error ? <div className="mb-6 rounded-3xl bg-red-50 px-5 py-4 font-semibold text-red-700">{error}</div> : null}

        {userMetrics ? (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/20 bg-white/10 px-5 py-4 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Current users</p>
              <p className="mt-3 text-3xl font-black">{userMetrics.currentUsers}</p>
              <p className="mt-2 text-xs text-white/70">Counts only users who still have active accounts.</p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/10 px-5 py-4 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Deleted accounts</p>
              <p className="mt-3 text-3xl font-black">{userMetrics.deletedUsers}</p>
              <p className="mt-2 text-xs text-white/70">Soft-deleted accounts stay in the DB history but are counted separately.</p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/10 px-5 py-4 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">User rows in table</p>
              <p className="mt-3 text-3xl font-black">{userMetrics.totalRows}</p>
              <p className="mt-2 text-xs text-white/70">Useful when reviewing the raw users table in the database.</p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-[2rem] border border-white/20 bg-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-2 px-2 py-1 text-white/80">
              <Database className="h-4 w-4" /> Tables
            </div>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="h-20 animate-pulse rounded-3xl bg-white/10" />)
              : tables.map((table) => {
                  const active = selectedTable === table.name || selectedTable === table.storeKey;
                  return (
                    <button
                      key={table.name}
                      onClick={() => {
                        setSelectedTable(table.name);
                        setPage(1);
                        setSearch('');
                      }}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${active ? 'border-white/40 bg-white/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.2em]">{table.name}</p>
                          <p className="mt-1 text-xs text-white/70">{table.columns.length} columns</p>
                        </div>
                        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black">{table.count}</span>
                      </div>
                    </button>
                  );
                })}
          </aside>

          <section className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-[0.2em]">{selectedTable || 'Table'}</h2>
                <p className="mt-2 text-sm text-white/70">
                  {totalRows} total rows • {selectedTableMeta?.columns.length || 0} columns • page {page} of {totalPages}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm">
                  <Search className="h-4 w-4 text-white/70" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter rows on this page"
                    className="w-44 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  />
                </label>

                <label className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white/85">
                  <span className="mr-2">Rows</span>
                  <select
                    value={limit}
                    onChange={(event) => {
                      setLimit(Number(event.target.value));
                      setPage(1);
                    }}
                    className="bg-transparent text-sm text-white focus:outline-none"
                  >
                    {[25, 50, 100].map((size) => (
                      <option key={size} value={size} className="text-black">
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-3xl border border-white/10 bg-[#06224f]/50">
                <div className="overflow-auto rounded-3xl">
                  <table className="min-w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 bg-[#0d2f67]">
                      <tr>
                        {columns.map((column) => (
                          <th key={column} className="px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/80">
                            {column}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/80">Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableLoading ? (
                        <tr>
                          <td className="px-4 py-6 text-white/75" colSpan={Math.max(columns.length + 1, 1)}>
                            Loading rows…
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-white/75" colSpan={Math.max(columns.length + 1, 1)}>
                            No rows found on this page.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, rowIndex) => {
                          const rowKey = getAdminDbRowKey(row, rowIndex);
                          const active = rowKey === selectedRowKey;
                          return (
                            <tr key={rowKey} className={`border-t border-white/10 align-top transition ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                              {columns.map((column) => (
                                <td key={column} className="px-4 py-3 text-white/90">
                                  <div className="max-w-[220px] leading-5 break-words" style={PREVIEW_STYLE}>
                                    {compactAdminDbValue(row[column], column === 'title' || column === 'name' ? 80 : 64)}
                                  </div>
                                </td>
                              ))}
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedRowKey(rowKey)}
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${active ? 'border-[#60C10F] bg-[#60C10F] text-[#04265a]' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}`}
                                >
                                  <Eye className="h-4 w-4" />
                                  {active ? 'Selected' : 'Inspect'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 text-sm text-white/80">
                  <p>
                    Showing {filteredRows.length} row{filteredRows.length === 1 ? '' : 's'} on this page.
                    {search ? ' Filter applies to the current page only.' : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    <span className="rounded-full bg-white/10 px-3 py-2 font-bold">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-white/10 bg-[#03193b]/70 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">Row details</p>
                    <h3 className="mt-2 text-xl font-black">{selectedRow ? compactAdminDbValue(selectedRow.id ?? selectedRow.reference_code ?? 'Selected row', 40) : 'Nothing selected'}</h3>
                  </div>
                  <button
                    onClick={handleCopy}
                    disabled={!selectedRow}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>

                {selectedRow ? (
                  <>
                    <div className="grid gap-3">
                      {detailEntries.map(([key, value]) => (
                        <div key={key} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">{key}</p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/90">{compactAdminDbValue(value, 220)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-3xl border border-white/10 bg-[#021126] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">Full payload</p>
                        <span className="text-xs text-white/45">Selected row JSON</span>
                      </div>
                      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/20 p-4 text-xs leading-6 text-white/90">
                        {prettyAdminDbValue(selectedRow.payload ?? selectedRow)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 px-5 py-10 text-center text-sm text-white/70">
                    Pick a row from the table to inspect the full payload here.
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
