import 'server-only';
import { streamText, type CoreMessage } from 'ai';
import {
  isClientTool,
  isMutatingTool,
  type AgentEvent,
  type ClientToolName,
  type ClientToolResult,
} from '@/agent/protocol';
import type { AgentSession } from './session';
import { getModel, thinkingOptions } from './model';
import { buildServerTools, buildClientToolSchemas } from './tools';
import { BASE_PROMPT } from './prompts';

const MAX_CLIENT_ROUNDS = 40;
const MAX_STEPS_PER_CALL = 24;
const CLIENT_TOOL_TIMEOUT_MS = 5 * 60_000;

type Emit = (event: AgentEvent) => void;

interface ToolCallPart {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

function messageParts(content: unknown): any[] {
  return Array.isArray(content) ? content : [];
}

function partText(part: any): string {
  return String(part?.textDelta ?? part?.text ?? part?.reasoning ?? part?.delta ?? '');
}

function extractReasoningText(messages: CoreMessage[]): string {
  let text = '';
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of messageParts(msg.content)) {
      if (part?.type === 'reasoning' && part.text) text += part.text;
    }
  }
  return text;
}

function extractAssistantText(messages: CoreMessage[]): string {
  let text = '';
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    if (typeof msg.content === 'string') {
      text += msg.content;
      continue;
    }
    for (const part of messageParts(msg.content)) {
      if (part?.type === 'text' && part.text) text += part.text;
    }
  }
  return text;
}

function extractToolCalls(messages: CoreMessage[]): ToolCallPart[] {
  const calls: ToolCallPart[] = [];
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of messageParts(msg.content)) {
      if (part && part.type === 'tool-call') {
        calls.push({
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.args,
        });
      }
    }
  }
  return calls;
}

function extractResolvedIds(messages: CoreMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== 'tool') continue;
    for (const part of messageParts(msg.content)) {
      if (part && part.type === 'tool-result') ids.add(part.toolCallId);
    }
  }
  return ids;
}

/** Blocks until the browser POSTs the matching tool-result. */
function requestClientTool(
  session: AgentSession,
  emit: Emit,
  call: ToolCallPart,
): Promise<ClientToolResult> {
  return new Promise<ClientToolResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.pending.delete(call.toolCallId);
      reject(new Error('Client tool timed out'));
    }, CLIENT_TOOL_TIMEOUT_MS);

    session.pending.set(call.toolCallId, {
      name: call.toolName,
      resolve,
      reject,
      timeout,
    });

    emit({
      type: 'request_client_tool',
      id: call.toolCallId,
      name: call.toolName as ClientToolName,
      args: call.args,
    });
  });
}

function toolResultMessages(
  call: ToolCallPart,
  res: ClientToolResult,
): CoreMessage[] {
  const messages: CoreMessage[] = [];
  const resultValue = res.ok
    ? (res.result ?? { ok: true })
    : { error: res.error ?? 'client tool failed' };

  messages.push({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        result: resultValue,
      },
    ],
  } as CoreMessage);

  // Tool results are JSON-only; vision needs a user image part.
  if (call.toolName === 'capture_screenshot' && res.image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Screenshot of the current spreadsheet viewport:' },
        { type: 'image', image: res.image },
      ],
    } as CoreMessage);
  }
  return messages;
}

const CLAIM_RE =
  /\bI(?:'ve| have)?\s+(?:updated|added|inserted|formatted|created|changed|set|applied|filled|built|wrote|written|removed|deleted|merged|sorted)\b/i;

export async function runAgent(
  session: AgentSession,
  userMessage: string,
  context: string | undefined,
  emit: Emit,
): Promise<void> {
  const runId = `run_${Date.now()}`;
  emit({ type: 'run_started', runId });

  const userText = context
    ? `${userMessage}\n\n<workbook_context>\n${context}\n</workbook_context>`
    : userMessage;
  session.messages.push({ role: 'user', content: userText });

  const tools = {
    ...buildServerTools(session, emit),
    ...buildClientToolSchemas(),
  };

  const abort = new AbortController();
  session.abort = abort;

  let finalText = '';
  let mutatedOk = false;
  let correctedOnce = false;

  try {
    for (let round = 0; round < MAX_CLIENT_ROUNDS; round++) {
      const result = streamText({
        model: getModel(),
        system: BASE_PROMPT,
        messages: session.messages,
        tools,
        maxSteps: MAX_STEPS_PER_CALL,
        abortSignal: abort.signal,
        ...(thinkingOptions()
          ? { providerOptions: thinkingOptions() as any }
          : {}),
      });

      let turnText = '';
      let turnThinking = '';
      for await (const part of result.fullStream as AsyncIterable<any>) {
        if (part.type === 'text-delta' || part.type === 'text') {
          const text = partText(part);
          if (text) {
            turnText += text;
            emit({ type: 'text_delta', text });
          }
        } else if (
          part.type === 'reasoning' ||
          part.type === 'reasoning-delta'
        ) {
          const text = partText(part);
          if (text) {
            turnThinking += text;
            emit({ type: 'thinking_delta', text });
          }
        } else if (part.type === 'error') {
          const message =
            part.error instanceof Error ? part.error.message : String(part.error);
          emit({ type: 'error', message });
        }
      }

      const response = await result.response;
      session.messages.push(...(response.messages as CoreMessage[]));

      if (!turnThinking) {
        const leftoverReasoning = extractReasoningText(response.messages as CoreMessage[]);
        if (leftoverReasoning) {
          turnThinking = leftoverReasoning;
          emit({ type: 'thinking_delta', text: leftoverReasoning });
        }
      }

      // Extended thinking often ships the closer as reasoning only.
      if (!turnText) {
        const leftover =
          extractAssistantText(response.messages as CoreMessage[]) ||
          (await result.text.catch(() => ''));
        if (leftover) {
          turnText = leftover;
          emit({ type: 'text_delta', text: leftover });
        }
      }
      if (turnText) finalText = turnText;

      const calls = extractToolCalls(response.messages as CoreMessage[]);
      const resolved = extractResolvedIds(response.messages as CoreMessage[]);
      const pending = calls.filter(
        (c) => isClientTool(c.toolName) && !resolved.has(c.toolCallId),
      );

      if (pending.length === 0) {
        // Model claimed an edit but no mutating tool succeeded.
        if (!correctedOnce && !mutatedOk && CLAIM_RE.test(finalText)) {
          correctedOnce = true;
          session.messages.push({
            role: 'user',
            content:
              'You described making an edit, but no workbook-mutating tool call succeeded in this run. Either actually perform the edit using the appropriate tool now, or correct your summary to reflect that nothing changed.',
          });
          continue;
        }
        // Claude + thinking can finish a successful run with no text block.
        if (!finalText) {
          finalText = 'Done. The workbook is up to date.';
          emit({ type: 'text_delta', text: finalText });
        }
        break;
      }

      for (const call of pending) {
        try {
          const res = await requestClientTool(session, emit, call);
          if (res.ok && isMutatingTool(call.toolName)) mutatedOk = true;
          session.messages.push(...toolResultMessages(call, res));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          session.messages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: call.toolCallId,
                toolName: call.toolName,
                result: { error: message },
              },
            ],
          } as CoreMessage);
        }
      }
    }

    emit({ type: 'run_finished', runId, reason: 'complete', text: finalText });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', message });
    emit({ type: 'run_finished', runId, reason: 'error', text: finalText });
  } finally {
    session.abort = null;
  }
}
