/**
 * SSE endpoint: /api/tracker/stream
 * ─────────────────────────────────────────────────────────────────
 * Pushes live GPS location events from the MQTT bridge to the
 * browser using Server-Sent Events (no Socket.io dependency).
 *
 * The frontend simply does:
 *   const es = new EventSource('/api/tracker/stream');
 *   es.addEventListener('location', (e) => { ... });
 * ─────────────────────────────────────────────────────────────────
 */

import { ensureMqttBridge, getMqttEmitter } from '@/lib/server/mqtt-bridge';
import type { TrackerLocationEvent } from '@/lib/server/mqtt-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Boot the MQTT connection (idempotent)
  ensureMqttBridge();

  const emitter = getMqttEmitter();
  const encoder = new TextEncoder();

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
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Forward every MQTT location event
      const onLocation = (event: TrackerLocationEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: location\ndata: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup();
        }
      };

      const onFallAlert = (event: TrackerLocationEvent) => {
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
        emitter.removeListener('location', onLocation);
        emitter.removeListener('fall_alert', onFallAlert);
      };

      emitter.on('location', onLocation);
      emitter.on('fall_alert', onFallAlert);

      // If the stream is cancelled (browser closed the tab) clean up
      (controller as any).__cleanup = cleanup;
    },

    cancel() {
      // ReadableStream cancel is called when the client disconnects
      if ((this as any).__cleanup) {
        (this as any).__cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx
    },
  });
}
