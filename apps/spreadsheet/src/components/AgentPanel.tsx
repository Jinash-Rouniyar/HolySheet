'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowUp,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Sparkles,
  Square,
  Terminal,
  Wrench,
  X,
} from 'lucide-react';
import type { SpreadsheetAdapter } from '@/agent/SpreadsheetAdapter';
import { useCelinaAgent, type TimelineItem } from '@/agent/useCelinaAgent';
import './AgentPanel.css';

interface Props {
  adapter: SpreadsheetAdapter;
  open: boolean;
  onToggle: () => void;
}

export default function AgentPanel({ adapter, open, onToggle }: Props) {
  const agent = useCelinaAgent(adapter);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [agent.items]);

  const submit = () => {
    const text = input.trim();
    if (!text || agent.running) return;
    setInput('');
    void agent.sendMessage(text);
  };

  if (!open) {
    return (
      <button className="celina-fab" onClick={onToggle} title="Open Celina">
        <PanelRightOpen size={18} />
      </button>
    );
  }

  return (
    <div className="celina-panel">
      <header className="celina-header">
        <div className="celina-brand">
          <Sparkles size={16} className="celina-brand-icon" />
          <span>Celina</span>
        </div>
        <div className="celina-header-actions">
          <label className="celina-toggle" title="Auto-approve edits">
            <input
              type="checkbox"
              checked={agent.autoApprove}
              onChange={(e) => agent.setAutoApprove(e.target.checked)}
            />
            <span>Auto-approve</span>
          </label>
          <button
            className="celina-icon-btn"
            disabled={!agent.canUndo}
            onClick={agent.undoLast}
            title="Undo last edit"
          >
            <RotateCcw size={15} />
          </button>
          <button className="celina-icon-btn" onClick={onToggle} title="Collapse">
            <PanelRightClose size={15} />
          </button>
        </div>
      </header>

      <div className="celina-timeline" ref={scrollRef}>
        {agent.items.length === 0 && (
          <div className="celina-empty">
            <Sparkles size={22} />
            <p>Ask Celina to build, analyze, or format your worksheet.</p>
            <span className="celina-empty-hint">
              She plans first, asks before big decisions, and shows every edit.
            </span>
          </div>
        )}
        {collapseConsecutiveTools(agent.items).map((item) =>
          item.kind === 'tool-group' ? (
            <ToolRow
              key={item.id}
              calls={item.calls}
              onApprove={agent.respondApproval}
              onUndoTo={agent.undoTo}
            />
          ) : (
            <ItemView
              key={item.id}
              item={item}
              onProceed={agent.proceedPlan}
              onAnswer={agent.answerAsk}
            />
          ),
        )}
      </div>

      <div className="celina-composer">
        <textarea
          ref={composerRef}
          value={input}
          placeholder="Message Celina…"
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {agent.running ? (
          <button className="celina-send stop" onClick={agent.cancel} title="Stop">
            <Square size={15} />
          </button>
        ) : (
          <button className="celina-send" onClick={submit} disabled={!input.trim()} title="Send">
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ItemView({
  item,
  onProceed,
  onAnswer,
}: {
  item: Exclude<TimelineItem, { kind: 'tool' }>;
  onProceed: (id: string, proceed: boolean, note?: string) => void;
  onAnswer: (id: string, answer: string) => void;
}) {
  switch (item.kind) {
    case 'user':
      return <div className="celina-user">{item.text}</div>;
    case 'assistant':
      return (
        <div className="celina-assistant">
          <ReactMarkdown>{item.text}</ReactMarkdown>
        </div>
      );
    case 'thinking':
      return <ThinkingBlock text={item.text} />;
    case 'error':
      return <div className="celina-error">{item.text}</div>;
    case 'plan':
      return <PlanCard item={item} onProceed={onProceed} />;
    case 'ask':
      return <AskCard item={item} onAnswer={onAnswer} />;
    default:
      return null;
  }
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="celina-thinking">
      <button className="celina-thinking-head" onClick={() => setOpen((o) => !o)}>
        <Brain size={13} />
        <span>Thinking</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && <div className="celina-thinking-body">{text}</div>}
    </div>
  );
}

function PlanCard({
  item,
  onProceed,
}: {
  item: Extract<TimelineItem, { kind: 'plan' }>;
  onProceed: (id: string, proceed: boolean, note?: string) => void;
}) {
  const [revise, setRevise] = React.useState(false);
  const [note, setNote] = React.useState('');
  const pending = item.status === 'pending';
  return (
    <div className={`celina-plan ${item.status}`}>
      <div className="celina-plan-head">
        <Check size={14} />
        <span>{item.title ?? 'Proposed plan'}</span>
      </div>
      <ol className="celina-plan-steps">
        {item.steps.map((s, i) => (
          <li key={i}>
            <span className="celina-step-title">{s.title}</span>
            {s.detail && <span className="celina-step-detail">{s.detail}</span>}
          </li>
        ))}
      </ol>
      {pending && !revise && (
        <div className="celina-plan-actions">
          <button className="celina-btn primary" onClick={() => onProceed(item.id, true)}>
            Proceed
          </button>
          <button className="celina-btn" onClick={() => setRevise(true)}>
            Request changes
          </button>
        </div>
      )}
      {pending && revise && (
        <div className="celina-revise">
          <textarea
            value={note}
            placeholder="What should change?"
            rows={2}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="celina-plan-actions">
            <button
              className="celina-btn primary"
              onClick={() => onProceed(item.id, false, note.trim())}
            >
              Send feedback
            </button>
            <button className="celina-btn" onClick={() => setRevise(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {!pending && (
        <div className="celina-plan-status">
          {item.status === 'proceeded' ? 'Proceeding…' : 'Revising…'}
        </div>
      )}
    </div>
  );
}

function AskCard({
  item,
  onAnswer,
}: {
  item: Extract<TimelineItem, { kind: 'ask' }>;
  onAnswer: (id: string, answer: string) => void;
}) {
  const [other, setOther] = React.useState('');
  const answered = item.status === 'answered';
  return (
    <div className={`celina-ask ${item.status}`}>
      <div className="celina-ask-q">{item.question}</div>
      {!answered && (
        <>
          <div className="celina-ask-options">
            {item.options.slice(0, 3).map((o) => (
              <button key={o.id} className="celina-chip" onClick={() => onAnswer(item.id, o.label)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="celina-ask-other">
            <input
              value={other}
              placeholder="Or type your own…"
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && other.trim()) onAnswer(item.id, other.trim());
              }}
            />
            <button
              className="celina-btn primary"
              disabled={!other.trim()}
              onClick={() => onAnswer(item.id, other.trim())}
            >
              Send
            </button>
          </div>
        </>
      )}
      {answered && <div className="celina-ask-answer">→ {item.answer}</div>}
    </div>
  );
}

type ToolItem = Extract<TimelineItem, { kind: 'tool' }>;

type DisplayItem =
  | Exclude<TimelineItem, { kind: 'tool' }>
  | { kind: 'tool-group'; id: string; calls: ToolItem[] };

function canJoinToolStreak(prev: ToolItem, next: ToolItem): boolean {
  if (prev.name !== next.name) return false;
  // Approval cards stay individual so Approve/Reject still maps to one id.
  if (prev.status === 'awaiting_approval' || next.status === 'awaiting_approval') {
    return false;
  }
  return true;
}

function collapseConsecutiveTools(items: TimelineItem[]): DisplayItem[] {
  const out: DisplayItem[] = [];
  for (const item of items) {
    if (item.kind !== 'tool') {
      out.push(item);
      continue;
    }
    const last = out[out.length - 1];
    if (last?.kind === 'tool-group' && canJoinToolStreak(last.calls[last.calls.length - 1], item)) {
      last.calls.push(item);
      continue;
    }
    out.push({ kind: 'tool-group', id: item.id, calls: [item] });
  }
  return out;
}

function groupStatus(calls: ToolItem[]): ToolItem['status'] {
  if (calls.some((c) => c.status === 'awaiting_approval')) return 'awaiting_approval';
  if (calls.some((c) => c.status === 'running')) return 'running';
  if (calls.some((c) => c.status === 'error')) return 'error';
  if (calls.every((c) => c.status === 'rejected')) return 'rejected';
  return 'ok';
}

function rollupSummary(calls: ToolItem[]): string | undefined {
  if (calls.length === 1) return calls[0].summary;

  const done = calls.filter((c) => c.summary);
  let key: string | null = null;
  let sum = 0;
  let numericHits = 0;
  for (const c of done) {
    const m = c.summary!.match(/^(\w+):\s*(\d+)$/);
    if (!m) continue;
    if (key === null) key = m[1];
    if (m[1] === key) {
      sum += Number(m[2]);
      numericHits++;
    }
  }

  const parts: string[] = [];
  if (key && numericHits === done.length && done.length > 0) {
    parts.push(`${key}: ${sum}`);
  } else if (done.length) {
    const last = done[done.length - 1];
    if (last.summary) parts.push(last.summary);
  }
  const failed = calls.filter((c) => c.status === 'error').length;
  if (failed) parts.push(`${failed} failed`);
  return parts.join(' · ') || undefined;
}

function ToolRow({
  calls,
  onApprove,
  onUndoTo,
}: {
  calls: ToolItem[];
  onApprove: (id: string, approved: boolean) => void;
  onUndoTo: (index: number) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const item = calls[0];
  const status = groupStatus(calls);
  const summary = rollupSummary(calls);
  const Icon = item.side === 'server' ? Terminal : Wrench;
  const awaiting = status === 'awaiting_approval';
  const grouped = calls.length > 1;
  const undoIndex = calls.find((c) => c.undoIndex !== undefined)?.undoIndex;
  const awaitingItem = calls.find((c) => c.status === 'awaiting_approval');

  return (
    <div className={`celina-tool ${status}`}>
      <div className="celina-tool-line">
        <span className="celina-tool-icon">
          {status === 'running' ? <Loader2 size={13} className="spin" /> : <Icon size={13} />}
        </span>
        <span className="celina-tool-name">{prettyTool(item.name)}</span>
        {grouped && <span className="celina-tool-count">×{calls.length}</span>}
        {summary && <span className="celina-tool-summary">{summary}</span>}
        <span className="celina-tool-actions">
          {status === 'ok' && <Check size={13} className="celina-tool-ok" />}
          {status === 'error' && <X size={13} className="celina-tool-err" />}
          {status === 'ok' && undoIndex !== undefined && (
            <button
              className="celina-undo-inline"
              onClick={() => onUndoTo(undoIndex)}
              title={grouped ? 'Undo this batch' : 'Undo this edit'}
            >
              <RotateCcw size={12} /> Undo
            </button>
          )}
          {grouped && (
            <button
              className="celina-tool-expand"
              onClick={() => setExpanded((o) => !o)}
              title={expanded ? 'Hide calls' : 'Show calls'}
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </span>
      </div>
      {expanded && grouped && (
        <div className="celina-tool-details">
          {calls.map((c) => (
            <div key={c.id} className={`celina-tool-detail ${c.status}`}>
              {c.status === 'running' ? (
                <Loader2 size={11} className="spin" />
              ) : c.status === 'error' ? (
                <X size={11} />
              ) : (
                <Check size={11} />
              )}
              <span>{c.summary ?? (c.status === 'running' ? 'running…' : prettyTool(c.name))}</span>
            </div>
          ))}
        </div>
      )}
      {awaiting && awaitingItem && (
        <div className="celina-approval">
          <ArgsPreview name={awaitingItem.name} args={awaitingItem.args} />
          <div className="celina-plan-actions">
            <button className="celina-btn primary" onClick={() => onApprove(awaitingItem.id, true)}>
              Approve
            </button>
            <button className="celina-btn" onClick={() => onApprove(awaitingItem.id, false)}>
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArgsPreview({ name, args }: { name: string; args: unknown }) {
  const a = (args ?? {}) as Record<string, unknown>;
  const range = a.range as string | undefined;
  return (
    <div className="celina-args">
      <code>{prettyTool(name)}</code>
      {range && <span className="celina-args-range">{range}</span>}
    </div>
  );
}

function prettyTool(name: string): string {
  return name.replace(/_/g, ' ');
}
