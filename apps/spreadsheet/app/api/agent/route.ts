import { encodeSSE, type AgentEvent, type StartRunRequest } from '@/agent/protocol';
import { getOrCreateSession, rejectAllPending } from '@/server/agent/session';
import { runAgent } from '@/server/agent/loop';

// child_process + long-lived SSE require the Node runtime, not Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  let body: StartRunRequest;
  try {
    body = (await req.json()) as StartRunRequest;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!body?.sessionId || typeof body.message !== 'string') {
    return new Response('sessionId and message are required', { status: 400 });
  }

  const session = getOrCreateSession(body.sessionId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const emit = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          closed = true;
          return;
        }
        if (event.type === 'run_finished') {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };

      session.emit = emit;
      runAgent(session, body.message, body.context, emit).catch((err) => {
        emit({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
        emit({ type: 'run_finished', runId: 'run_error', reason: 'error', text: '' });
      });
    },
    cancel() {
      session.abort?.abort();
      rejectAllPending(session, 'client disconnected');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
