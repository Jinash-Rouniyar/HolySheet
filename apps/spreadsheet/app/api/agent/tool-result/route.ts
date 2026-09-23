import type { ClientToolResult } from '@/agent/protocol';
import { resolveClientTool } from '@/server/agent/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body: ClientToolResult;
  try {
    body = (await req.json()) as ClientToolResult;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!body?.sessionId || !body?.toolCallId) {
    return new Response('sessionId and toolCallId are required', { status: 400 });
  }
  const resolved = resolveClientTool(body);
  return Response.json({ ok: resolved });
}
