import { getSession, rejectAllPending } from '@/server/agent/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let sessionId: string | undefined;
  try {
    ({ sessionId } = (await req.json()) as { sessionId?: string });
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!sessionId) return new Response('sessionId required', { status: 400 });

  const session = getSession(sessionId);
  if (session) {
    session.abort?.abort();
    rejectAllPending(session, 'cancelled by user');
  }
  return Response.json({ ok: true });
}
