'use client';

import { useCallback, useRef, useState } from 'react';
import {
  isMutatingTool,
  type AgentEvent,
  type AskOption,
  type ClientToolResult,
  type PlanStep,
} from './protocol';
import { apiUrl } from '@/lib/config';
import type { SpreadsheetAdapter } from './SpreadsheetAdapter';
import { executeAdapterTool } from './client-tools';
import { captureSpreadsheet } from './screenshot';

// ---------------------------------------------------------------------------
// Timeline model
// ---------------------------------------------------------------------------

export type TimelineItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'thinking'; id: string; text: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      side: 'server' | 'client';
      status: 'running' | 'awaiting_approval' | 'ok' | 'error' | 'rejected';
      summary?: string;
      args?: unknown;
      undoIndex?: number;
    }
  | {
      kind: 'plan';
      id: string;
      title?: string;
      steps: PlanStep[];
      status: 'pending' | 'proceeded' | 'revise';
    }
  | {
      kind: 'ask';
      id: string;
      question: string;
      options: AskOption[];
      status: 'pending' | 'answered';
      answer?: string;
    }
  | { kind: 'error'; id: string; text: string };

interface Snapshot {
  label: string;
  json: unknown;
}

let idc = 0;
const nextId = () => `it_${Date.now()}_${idc++}`;

export function useCelinaAgent(adapter: SpreadsheetAdapter) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [running, setRunning] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);

  const sessionId = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `s_${Date.now()}`,
  );
  const curAssistant = useRef<string | null>(null);
  const curThinking = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Resolvers for interactive client tools (plan/ask/approval).
  const resolvers = useRef<Map<string, (v: unknown) => void>>(new Map());
  const autoApproveRef = useRef(autoApprove);
  autoApproveRef.current = autoApprove;

  // ---- timeline helpers ----
  const push = useCallback((item: TimelineItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const patch = useCallback((id: string, fn: (it: TimelineItem) => TimelineItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? fn(it) : it)));
  }, []);

  const appendText = useCallback(
    (ref: React.MutableRefObject<string | null>, kind: 'assistant' | 'thinking', text: string) => {
      setItems((prev) => {
        const id = ref.current;
        if (id) {
          return prev.map((it) =>
            it.id === id && (it.kind === 'assistant' || it.kind === 'thinking')
              ? { ...it, text: it.text + text }
              : it,
          );
        }
        const newId = nextId();
        ref.current = newId;
        return [...prev, { kind, id: newId, text } as TimelineItem];
      });
    },
    [],
  );

  const resetStreams = useCallback(() => {
    curAssistant.current = null;
    curThinking.current = null;
  }, []);

  // ---- server round-trip: post a client tool result ----
  const postToolResult = useCallback(
    async (payload: Omit<ClientToolResult, 'sessionId'>) => {
      await fetch(apiUrl('/api/agent/tool-result'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, sessionId: sessionId.current }),
      });
    },
    [],
  );

  const awaitUser = useCallback(<T,>(id: string): Promise<T> => {
    return new Promise<T>((resolve) => {
      resolvers.current.set(id, resolve as (v: unknown) => void);
    });
  }, []);

  // ---- handle a client tool request from the server ----
  const handleClientTool = useCallback(
    async (id: string, name: string, args: any) => {
      resetStreams();

      // Interactive: plan
      if (name === 'present_plan') {
        push({
          kind: 'plan',
          id,
          title: args?.title,
          steps: args?.steps ?? [],
          status: 'pending',
        });
        const decision = await awaitUser<{ proceed: boolean; note?: string }>(id);
        patch(id, (it) =>
          it.kind === 'plan'
            ? { ...it, status: decision.proceed ? 'proceeded' : 'revise' }
            : it,
        );
        await postToolResult({
          toolCallId: id,
          ok: true,
          result: decision.proceed
            ? { proceeded: true }
            : { proceeded: false, feedback: decision.note ?? 'User wants to revise the plan.' },
        });
        return;
      }

      // Interactive: ask_user
      if (name === 'ask_user') {
        push({
          kind: 'ask',
          id,
          question: args?.question ?? '',
          options: args?.options ?? [],
          status: 'pending',
        });
        const answer = await awaitUser<string>(id);
        patch(id, (it) => (it.kind === 'ask' ? { ...it, status: 'answered', answer } : it));
        await postToolResult({ toolCallId: id, ok: true, result: { answer } });
        return;
      }

      // Vision: screenshot
      if (name === 'capture_screenshot') {
        push({ kind: 'tool', id, name, side: 'client', status: 'running', args });
        try {
          if (args?.range) adapter.scrollTo(args.range);
          const image = await captureSpreadsheet();
          patch(id, (it) =>
            it.kind === 'tool' ? { ...it, status: 'ok', summary: 'captured viewport' } : it,
          );
          await postToolResult({ toolCallId: id, ok: true, image, result: { captured: true } });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          patch(id, (it) => (it.kind === 'tool' ? { ...it, status: 'error', summary: message } : it));
          await postToolResult({ toolCallId: id, ok: false, error: message });
        }
        return;
      }

      // Mutation with approval gate + snapshot
      if (isMutatingTool(name)) {
        const needsApproval = !autoApproveRef.current;
        push({
          kind: 'tool',
          id,
          name,
          side: 'client',
          status: needsApproval ? 'awaiting_approval' : 'running',
          args,
        });
        if (needsApproval) {
          const approved = await awaitUser<boolean>(id);
          if (!approved) {
            patch(id, (it) => (it.kind === 'tool' ? { ...it, status: 'rejected' } : it));
            await postToolResult({
              toolCallId: id,
              ok: false,
              error: 'User rejected this edit.',
            });
            return;
          }
          patch(id, (it) => (it.kind === 'tool' ? { ...it, status: 'running' } : it));
        }
        // snapshot before mutating
        let undoIndex: number | undefined;
        try {
          const json = await adapter.snapshot();
          setUndoStack((prev) => {
            undoIndex = prev.length;
            return [...prev, { label: name, json }];
          });
        } catch {
          /* snapshot best-effort */
        }
        const res = await executeAdapterTool(adapter, name, args);
        patch(id, (it) =>
          it.kind === 'tool'
            ? {
                ...it,
                status: res.ok ? 'ok' : 'error',
                summary: res.ok ? summarize(res.result) : res.error,
                undoIndex: res.ok ? undoIndex : undefined,
              }
            : it,
        );
        await postToolResult({
          toolCallId: id,
          ok: res.ok,
          result: res.result,
          error: res.error,
        });
        return;
      }

      // Read-only document tool
      push({ kind: 'tool', id, name, side: 'client', status: 'running', args });
      const res = await executeAdapterTool(adapter, name, args);
      patch(id, (it) =>
        it.kind === 'tool'
          ? { ...it, status: res.ok ? 'ok' : 'error', summary: res.ok ? 'read' : res.error }
          : it,
      );
      await postToolResult({
        toolCallId: id,
        ok: res.ok,
        result: res.result,
        error: res.error,
      });
    },
    [adapter, awaitUser, patch, postToolResult, push, resetStreams],
  );

  // ---- SSE event dispatch ----
  const handleEvent = useCallback(
    (ev: AgentEvent) => {
      switch (ev.type) {
        case 'run_started':
          setRunning(true);
          break;
        case 'thinking_delta':
          curAssistant.current = null;
          appendText(curThinking, 'thinking', ev.text);
          break;
        case 'text_delta':
          curThinking.current = null;
          appendText(curAssistant, 'assistant', ev.text);
          break;
        case 'tool_call':
          resetStreams();
          push({
            kind: 'tool',
            id: ev.id,
            name: ev.name,
            side: ev.side,
            status: 'running',
            args: ev.args,
          });
          break;
        case 'tool_result':
          patch(ev.id, (it) =>
            it.kind === 'tool'
              ? { ...it, status: ev.ok ? 'ok' : 'error', summary: ev.summary }
              : it,
          );
          break;
        case 'request_client_tool':
          void handleClientTool(ev.id, ev.name, ev.args);
          break;
        case 'run_finished':
          setRunning(false);
          resetStreams();
          // Safety net: last-turn text that never arrived as text_delta.
          if (ev.text) {
            setItems((prev) => {
              const lastUser = [...prev].reverse().find((it) => it.kind === 'user');
              const after = lastUser ? prev.slice(prev.indexOf(lastUser) + 1) : prev;
              if (after.some((it) => it.kind === 'assistant' && it.text.trim())) {
                return prev;
              }
              return [...prev, { kind: 'assistant', id: nextId(), text: ev.text }];
            });
          }
          break;
        case 'error':
          push({ kind: 'error', id: nextId(), text: ev.message });
          break;
      }
    },
    [appendText, handleClientTool, patch, push, resetStreams],
  );

  // ---- start a run (POST + SSE stream over fetch) ----
  const sendMessage = useCallback(
    async (message: string) => {
      if (running) return;
      push({ kind: 'user', id: nextId(), text: message });
      resetStreams();

      let context = '';
      try {
        const sheets = adapter.getSheets();
        const sel = adapter.getSelection();
        context = `Sheets: ${sheets
          .map((s) => `${s.name} (${s.usedRange})`)
          .join(', ')}. Active selection: ${sel.sheet}!${sel.range}.`;
      } catch {
        /* workbook may be empty */
      }

      const abort = new AbortController();
      abortRef.current = abort;
      setRunning(true);
      try {
        const res = await fetch(apiUrl('/api/agent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.current,
            message,
            context,
            autoApprove: autoApproveRef.current,
          }),
          signal: abort.signal,
        });
        if (!res.body) throw new Error('No response stream');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const consume = (chunk: string) => {
          buffer += chunk;
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith('data:')) continue;
            const json = line.slice(line.indexOf('data:') + 5).trim();
            if (!json) continue;
            try {
              handleEvent(JSON.parse(json) as AgentEvent);
            } catch {
              /* ignore malformed frame */
            }
          }
        };
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            consume(decoder.decode());
            if (buffer.trim()) consume('\n\n');
            break;
          }
          consume(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          push({
            kind: 'error',
            id: nextId(),
            text: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [adapter, handleEvent, push, resetStreams, running],
  );

  // ---- user interactions on plan/ask/approval ----
  const proceedPlan = useCallback((id: string, proceed: boolean, note?: string) => {
    resolvers.current.get(id)?.({ proceed, note });
    resolvers.current.delete(id);
  }, []);
  const answerAsk = useCallback((id: string, answer: string) => {
    resolvers.current.get(id)?.(answer);
    resolvers.current.delete(id);
  }, []);
  const respondApproval = useCallback((id: string, approved: boolean) => {
    resolvers.current.get(id)?.(approved);
    resolvers.current.delete(id);
  }, []);

  const cancel = useCallback(async () => {
    abortRef.current?.abort();
    await fetch(apiUrl('/api/agent/cancel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.current }),
    }).catch(() => {});
    setRunning(false);
  }, []);

  const undoLast = useCallback(() => {
    setUndoStack((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        try {
          adapter.restore(last.json);
        } catch {
          /* ignore restore error */
        }
      }
      return prev.slice(0, -1);
    });
  }, [adapter]);

  const undoTo = useCallback(
    (index: number) => {
      setUndoStack((prev) => {
        const target = prev[index];
        if (target) {
          try {
            adapter.restore(target.json);
          } catch {
            /* ignore */
          }
        }
        return prev.slice(0, index);
      });
    },
    [adapter],
  );

  return {
    items,
    running,
    autoApprove,
    setAutoApprove,
    canUndo: undoStack.length > 0,
    sendMessage,
    cancel,
    proceedPlan,
    answerAsk,
    respondApproval,
    undoLast,
    undoTo,
  };
}

function summarize(result: unknown): string {
  if (result && typeof result === 'object') {
    const entries = Object.entries(result as Record<string, unknown>);
    if (entries.length) {
      return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
    }
  }
  return 'done';
}
