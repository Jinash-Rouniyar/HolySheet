import 'server-only';
import type { CoreMessage } from 'ai';
import type { AgentEvent, ClientToolResult } from '@/agent/protocol';

/**
 * In-memory per-session agent state. Valid because the app is deployed as a
 * single long-running Node server (`next start`, not serverless). The SSE run
 * handler and the tool-result handler share this registry within one process,
 * which is what lets a running loop `await` an out-of-band browser tool result.
 */
export interface PendingClientTool {
  name: string;
  resolve: (result: ClientToolResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface AgentSession {
  id: string;
  messages: CoreMessage[];
  pending: Map<string, PendingClientTool>;
  emit: ((event: AgentEvent) => void) | null;
  abort: AbortController | null;
  createdAt: number;
}

type SessionRegistry = Map<string, AgentSession>;

// Survive dev HMR by stashing the registry on globalThis.
const globalForSessions = globalThis as unknown as {
  __celinaSessions?: SessionRegistry;
};

const sessions: SessionRegistry =
  globalForSessions.__celinaSessions ?? new Map<string, AgentSession>();
globalForSessions.__celinaSessions = sessions;

export function getOrCreateSession(id: string): AgentSession {
  let session = sessions.get(id);
  if (!session) {
    session = {
      id,
      messages: [],
      pending: new Map(),
      emit: null,
      abort: null,
      createdAt: Date.now(),
    };
    sessions.set(id, session);
  }
  return session;
}

export function getSession(id: string): AgentSession | undefined {
  return sessions.get(id);
}

/** Called by the tool-result route to unblock a waiting client tool. */
export function resolveClientTool(payload: ClientToolResult): boolean {
  const session = sessions.get(payload.sessionId);
  if (!session) return false;
  const pending = session.pending.get(payload.toolCallId);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  session.pending.delete(payload.toolCallId);
  pending.resolve(payload);
  return true;
}

/** Reject every outstanding client tool (used on cancel / disconnect). */
export function rejectAllPending(session: AgentSession, reason: string): void {
  for (const [, pending] of session.pending) {
    clearTimeout(pending.timeout);
    pending.reject(new Error(reason));
  }
  session.pending.clear();
}
