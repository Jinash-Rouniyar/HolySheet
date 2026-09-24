import 'server-only';
import type { CoreMessage } from 'ai';
import type { AgentEvent, ClientToolResult } from '@/agent/protocol';

/** In-process session store. Requires a long-running Node server, not serverless. */
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

// HMR would otherwise drop in-flight sessions.
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

export function rejectAllPending(session: AgentSession, reason: string): void {
  for (const [, pending] of session.pending) {
    clearTimeout(pending.timeout);
    pending.reject(new Error(reason));
  }
  session.pending.clear();
}
