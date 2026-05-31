/**
 * SSE endpoint: /api/tracker/stream
 * ─────────────────────────────────────────────────────────────────
 * Pushes live GPS location events from the MQTT bridge to the
 * browser using Server-Sent Events (no Socket.io dependency).
 *
 * Supports optional batching/coalescing to prevent SSE flooding:
 *   GET /api/tracker/stream?batchMs=2000
 *
 * Implements backpressure protection by dropping non-critical updates
 * if the subscriber's read buffer is full (desiredSize <= 0).
 * Implements absolute cleanup guarantees on client socket abort.
 * ─────────────────────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Boot the MQTT connection (idempotent)
  ensureMqttBridge();

  const url = new URL(request.url);
  // Parse batch coalescing interval
  const batchMs = Math.max(0, Number(url.searchParams.get('batchMs')) || 0);

  const emitter = getMqttEmitter();
  const encoder = new TextEncoder();
  
  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial "connected" event so the client knows the stream is alive
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true, time: new Date().toISOString() })}\n\n`)
      );

      // Keep-alive every 25 seconds so proxies don't drop the connection
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 25_000);

      let batchBuffer: TrackerLocationEvent[] = [];
      let batchTimeout: NodeJS.Timeout | null = null;

      const flushBatch = () => {
        if (batchBuffer.length === 0) return;
        try {
          controller.enqueue(
            encoder.encode(`event: location_batch\ndata: ${JSON.stringify(batchBuffer)}\n\n`)
          );
          batchBuffer = [];
        } catch {
          cleanup();
        }
      };

      // Forward MQTT location event
      const onLocation = (event: TrackerLocationEvent) => {
        // Backpressure check: if the client consumer is slow, drop regular updates
        // to prevent stream buffer bloating and memory retention.
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          if (event.alertType !== 'fall' && event.alertType !== 'sos') {
            return; // Drop non-critical GPS telemetry under backpressure
          }
        }

        if (batchMs > 0) {
          batchBuffer.push(event);
          if (!batchTimeout) {
            batchTimeout = setTimeout(() => {
              batchTimeout = null;
              flushBatch();
            }, batchMs);
          }
        } else {
          try {
            controller.enqueue(
              encoder.encode(`event: location\ndata: ${JSON.stringify(event)}\n\n`)
            );
          } catch {
            cleanup();
          }
        }
      };

      const onFallAlert = (event: TrackerLocationEvent) => {
        // Critical alerts always bypass backpressure dropping
        try {
          controller.enqueue(
            encoder.encode(`event: fall_alert\ndata: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        clearInterval(heartbeat);
        if (batchTimeout) {
          clearTimeout(batchTimeout);
          batchTimeout = null;
        }
        emitter.removeListener('location', onLocation);
        emitter.removeListener('fall_alert', onFallAlert);
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      };

      cleanupFn = cleanup;

      emitter.on('location', onLocation);
      emitter.on('fall_alert', onFallAlert);
    },

    cancel() {
      if (cleanupFn) {
        cleanupFn();
      }
    },
  });

  // Client abort listener cleanup guarantee (handles browser tab closes instantly)
  request.signal.addEventListener('abort', () => {
    if (cleanupFn) {
      cleanupFn();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering on Nginx reverse proxy
    },
  });
}
