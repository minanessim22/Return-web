/**
 * offlineQueue.ts
 * ─────────────────────────────────────────────────────────────────
 * Client-side offline queue with automatic sync.
 *
 * When the browser/device loses connectivity (navigator.onLine = false)
 * or the SSE stream disconnects, any location observations meant to be
 * sent to the server are queued in localStorage instead.
 *
 * When connectivity is restored, the queue is automatically flushed
 * to `/api/tracker/batch` using **Exponential Backoff with Jitter**
 * so the server isn't overwhelmed by a burst of reconnecting clients.
 *
 * Features:
 *  • Zero-dependency — uses only Web APIs (localStorage, navigator.onLine)
 *  • Persistent — survives page reloads and browser restarts
 *  • Deduplication — skips identical (device_id, timestamp) entries
 *  • Batch flush — sends up to MAX_BATCH points per request
 *  • Retry with backoff — 2s → 4s → 8s → 16s → 30s cap, ±20% jitter
 *  • Auto-flush on reconnect (online event) and on manual trigger
 *
 * Usage:
 *   import { enqueue, flushQueue, getQueueSize, clearQueue } from '@/lib/offlineQueue';
 *
 *   // When you want to report a point but might be offline:
 *   enqueue({ device_id: 'A9G-01', lat: 30.01, lon: 31.02, battery: 85 });
 *
 *   // The queue auto-flushes when online. Manual flush:
 *   await flushQueue();
 * ─────────────────────────────────────────────────────────────────
 */

'use client';

// ── Types ─────────────────────────────────────────────────────────

export interface QueuedPoint {
  device_id: string;
  lat: number;
  lon: number;
  battery?: number;
  altitude?: number;
  speed?: number;
  accuracy?: number;
  bearing?: number;
  /** ISO timestamp from the device */
  timestamp: string;
  /** When this point was queued (ISO) — used for staleness checks */
  queuedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────

const STORAGE_KEY = 'return_offline_queue';
const MAX_QUEUE_SIZE = 2000;  // Hard cap to prevent localStorage overflow
const MAX_BATCH = 100;        // Points per flush request
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — older points are pruned

// Backoff
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_JITTER = 0.2;

// ── Internal state ────────────────────────────────────────────────

let flushInProgress = false;
let flushAttempt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

// ── localStorage helpers ──────────────────────────────────────────

function readQueue(): QueuedPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedPoint[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — drop oldest entries and retry
    const trimmed = queue.slice(Math.floor(queue.length / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Give up — we can't persist
      console.warn('[OfflineQueue] localStorage full, dropping queue');
    }
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Add a point to the offline queue.
 * If the browser is online, immediately attempts a flush.
 */
export function enqueue(point: Omit<QueuedPoint, 'queuedAt'>): void {
  const queue = readQueue();

  // Deduplicate: skip if exact (device_id, timestamp) already queued
  const isDuplicate = queue.some(
    (p) => p.device_id === point.device_id && p.timestamp === point.timestamp
  );
  if (isDuplicate) return;

  const entry: QueuedPoint = {
    ...point,
    queuedAt: new Date().toISOString(),
  };

  queue.push(entry);

  // Enforce max size — drop oldest first
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }

  writeQueue(queue);

  // Attempt immediate flush if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleFlush(0);
  }
}

/**
 * Get the current queue size.
 */
export function getQueueSize(): number {
  return readQueue().length;
}

/**
 * Get the full queue (for debugging / UI display).
 */
export function peekQueue(): QueuedPoint[] {
  return readQueue();
}

/**
 * Clear the entire queue (admin/debug action).
 */
export function clearQueue(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Manually trigger a flush.
 * Returns the number of points successfully sent.
 */
export async function flushQueue(): Promise<number> {
  return doFlush();
}

// ── Flush logic ───────────────────────────────────────────────────

function calcDelay(attempt: number): number {
  const exp = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
  const jitter = exp * BACKOFF_JITTER * (Math.random() * 2 - 1);
  return Math.round(exp + jitter);
}

function scheduleFlush(delayMs: number): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    doFlush();
  }, delayMs);
}

async function doFlush(): Promise<number> {
  if (flushInProgress) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  let queue = readQueue();

  // Prune stale points (older than MAX_AGE_MS)
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();
  queue = queue.filter((p) => p.queuedAt > cutoff);
  writeQueue(queue);

  if (queue.length === 0) {
    flushAttempt = 0;
    return 0;
  }

  flushInProgress = true;
  let totalSent = 0;

  try {
    // Group by device_id for batching
    const grouped = new Map<string, QueuedPoint[]>();
    for (const p of queue) {
      const list = grouped.get(p.device_id) || [];
      list.push(p);
      grouped.set(p.device_id, list);
    }

    for (const [deviceId, points] of grouped) {
      // Send in chunks of MAX_BATCH
      for (let i = 0; i < points.length; i += MAX_BATCH) {
        const chunk = points.slice(i, i + MAX_BATCH);

        const payload = {
          device_id: deviceId,
          locations: chunk.map((p) => ({
            lat: p.lat,
            lon: p.lon,
            batt: p.battery,
            alt: p.altitude,
            vel: p.speed,
            acc: p.accuracy,
            bear: p.bearing,
            tst: Math.floor(new Date(p.timestamp).getTime() / 1000),
          })),
        };

        try {
          const res = await fetch('/api/tracker/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json();
            const saved = data.saved ?? 0;
            totalSent += saved;

            // Remove successfully sent points from queue
            const sentTimestamps = new Set(chunk.map((p) => `${p.device_id}:${p.timestamp}`));
            queue = queue.filter((p) => !sentTimestamps.has(`${p.device_id}:${p.timestamp}`));
            writeQueue(queue);

            // Reset backoff on success
            flushAttempt = 0;

            console.debug(
              `[OfflineQueue] Flushed ${saved} points for ${deviceId}`
            );
          } else if (res.status === 401) {
            // Device not registered — remove all points for this device
            // (no point retrying if the device is rejected)
            queue = queue.filter((p) => p.device_id !== deviceId);
            writeQueue(queue);
            console.warn(
              `[OfflineQueue] Device ${deviceId} not registered — dropped ${points.length} points`
            );
            break; // Skip remaining chunks for this device
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn(`[OfflineQueue] Flush failed for ${deviceId}:`, err);
          // Schedule retry with backoff
          const delay = calcDelay(flushAttempt);
          flushAttempt++;
          scheduleFlush(delay);
          console.debug(
            `[OfflineQueue] Retry #${flushAttempt} in ${(delay / 1000).toFixed(1)}s`
          );
          flushInProgress = false;
          return totalSent;
        }
      }
    }

    // All done successfully
    flushAttempt = 0;
  } finally {
    flushInProgress = false;
  }

  return totalSent;
}

// ── Auto-flush on reconnect ───────────────────────────────────────

/**
 * Call once to bind the `online` event listener.
 * Safe to call multiple times — idempotent.
 */
export function bindAutoFlush(): void {
  if (typeof window === 'undefined') return;
  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener('online', () => {
    console.debug('[OfflineQueue] Browser came online — flushing queue');
    scheduleFlush(500); // small delay to let network stabilize
  });

  // Also attempt a flush on page load if there are queued points
  if (navigator.onLine && readQueue().length > 0) {
    scheduleFlush(2000); // 2s delay on page load
  }
}
