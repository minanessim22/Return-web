export type AdminDbRow = Record<string, unknown>;

const EXCLUDED_COLUMNS = new Set(['payload', 'payloadPreview']);
const PRIORITY_COLUMNS = [
  'id',
  'reference_code',
  'email',
  'username',
  'name',
  'status',
  'type',
  'category',
  'updated_at',
  'created_at'
];

export function prettyAdminDbValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function compactAdminDbValue(value: unknown, maxLength = 120) {
  const normalized = prettyAdminDbValue(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return '—';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function getAdminDbDisplayColumns(rows: AdminDbRow[]) {
  const columns = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!EXCLUDED_COLUMNS.has(key)) {
        columns.add(key);
      }
    });
  });

  return Array.from(columns).sort((left, right) => {
    const leftIndex = PRIORITY_COLUMNS.indexOf(left);
    const rightIndex = PRIORITY_COLUMNS.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  });
}

export function getAdminDbRowKey(row: AdminDbRow, fallbackIndex: number) {
  const preferred = row.id ?? row.reference_code ?? row.referenceCode ?? row.email ?? row.created_at ?? row.createdAt;
  if (typeof preferred === 'string' || typeof preferred === 'number') {
    return String(preferred);
  }
  return `row-${fallbackIndex}`;
}
