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
import { isMutatingTool } from '@/agent/protocol';
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
        {agent.items.map((item) => (
          <ItemView
            key={item.id}
            item={item}
            onProceed={agent.proceedPlan}
            onAnswer={agent.answerAsk}
            onApprove={agent.respondApproval}
            onUndoTo={agent.undoTo}
          />
        ))}
      </div>

      <div className="celina-composer">
        <textarea
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

// ---------------------------------------------------------------------------

function ItemView({
  item,
  onProceed,
  onAnswer,
  onApprove,
  onUndoTo,
}: {
  item: TimelineItem;
  onProceed: (id: string, proceed: boolean, note?: string) => void;
  onAnswer: (id: string, answer: string) => void;
  onApprove: (id: string, approved: boolean) => void;
  onUndoTo: (index: number) => void;
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
    case 'tool':
      return <ToolRow item={item} onApprove={onApprove} onUndoTo={onUndoTo} />;
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

function ToolRow({
  item,
  onApprove,
  onUndoTo,
}: {
  item: Extract<TimelineItem, { kind: 'tool' }>;
  onApprove: (id: string, approved: boolean) => void;
  onUndoTo: (index: number) => void;
}) {
  const mutating = isMutatingTool(item.name);
  const Icon =
    item.side === 'server' ? Terminal : mutating ? Wrench : Wrench;
  const awaiting = item.status === 'awaiting_approval';
  return (
    <div className={`celina-tool ${item.status}`}>
      <div className="celina-tool-line">
        <span className="celina-tool-icon">
          {item.status === 'running' ? <Loader2 size={13} className="spin" /> : <Icon size={13} />}
        </span>
        <span className="celina-tool-name">{prettyTool(item.name)}</span>
        {item.summary && <span className="celina-tool-summary">{item.summary}</span>}
        {item.status === 'ok' && <Check size={13} className="celina-tool-ok" />}
        {item.status === 'error' && <X size={13} className="celina-tool-err" />}
        {item.status === 'ok' && item.undoIndex !== undefined && (
          <button
            className="celina-undo-inline"
            onClick={() => onUndoTo(item.undoIndex as number)}
            title="Undo this edit"
          >
            <RotateCcw size={12} /> Undo
          </button>
        )}
      </div>
      {awaiting && (
        <div className="celina-approval">
          <ArgsPreview name={item.name} args={item.args} />
          <div className="celina-plan-actions">
            <button className="celina-btn primary" onClick={() => onApprove(item.id, true)}>
              Approve
            </button>
            <button className="celina-btn" onClick={() => onApprove(item.id, false)}>
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
