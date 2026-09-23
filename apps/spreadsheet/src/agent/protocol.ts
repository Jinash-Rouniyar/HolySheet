/**
 * Shared agent protocol types — framework-free so both the browser client and
 * the Next route handlers can import it. No React, no Node, no AI-SDK imports.
 *
 * Transport model (see the plan's "two-brain" design):
 *  - The agent loop runs server-side and streams `AgentEvent`s over SSE.
 *  - Document tools (spreadsheet ops, screenshot, plan, ask_user) live in the
 *    browser where Syncfusion is. The server emits `request_client_tool`; the
 *    browser executes it against the SpreadsheetAdapter and POSTs a
 *    `ClientToolResult` back to /api/agent/tool-result, which unblocks the loop.
 */

// ---------------------------------------------------------------------------
// Tool names
// ---------------------------------------------------------------------------

/** Tools executed in the browser against Syncfusion (read-only document tools). */
export const CLIENT_READ_TOOLS = [
  'read_range',
  'get_sheets',
  'get_selection',
  'describe_workbook',
  'get_sheet_csv',
] as const;

/** Tools executed in the browser that mutate the workbook (gated by approval). */
export const CLIENT_MUTATE_TOOLS = [
  'set_values',
  'clear_range',
  'set_format',
  'set_number_format',
  'merge_cells',
  'unmerge_cells',
  'autofit',
  'set_col_width',
  'set_row_height',
  'freeze_panes',
  'insert_rows',
  'insert_cols',
  'delete_rows',
  'delete_cols',
  'add_sheet',
  'rename_sheet',
  'insert_chart',
  'add_conditional_format',
  'add_data_validation',
  'sort_range',
  'apply_filter',
  'add_named_range',
] as const;

/** Vision + interaction tools also handled client-side via the round-trip. */
export const CLIENT_SPECIAL_TOOLS = [
  'capture_screenshot',
  'present_plan',
  'ask_user',
] as const;

export const CLIENT_TOOLS = [
  ...CLIENT_READ_TOOLS,
  ...CLIENT_MUTATE_TOOLS,
  ...CLIENT_SPECIAL_TOOLS,
] as const;

/** Tools executed on the server (sandbox / network). */
export const SERVER_TOOLS = [
  'web_search',
  'bash',
  'python',
  'read_file',
  'write_file',
  'list_dir',
  'load_guide',
] as const;

export type ClientToolName = (typeof CLIENT_TOOLS)[number];
export type ServerToolName = (typeof SERVER_TOOLS)[number];
export type ToolName = ClientToolName | ServerToolName;

const MUTATE_SET = new Set<string>(CLIENT_MUTATE_TOOLS);
const CLIENT_SET = new Set<string>(CLIENT_TOOLS);

export function isClientTool(name: string): name is ClientToolName {
  return CLIENT_SET.has(name);
}

export function isMutatingTool(name: string): boolean {
  return MUTATE_SET.has(name);
}

// ---------------------------------------------------------------------------
// Server -> client events (SSE)
// ---------------------------------------------------------------------------

export type ToolSide = 'server' | 'client';

export interface PlanStep {
  title: string;
  detail?: string;
}

export interface AskOption {
  id: string;
  label: string;
}

export type AgentEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; id: string; name: string; side: ToolSide; args: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      ok: boolean;
      summary: string;
    }
  | { type: 'request_client_tool'; id: string; name: ClientToolName; args: unknown }
  | { type: 'run_finished'; runId: string; reason: string; text: string }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Client -> server payloads
// ---------------------------------------------------------------------------

export interface StartRunRequest {
  sessionId: string;
  message: string;
  /** Optional lightweight workbook context captured at send time. */
  context?: string;
  /** When true, mutating tools skip the per-edit approval gate client-side. */
  autoApprove?: boolean;
}

export interface ClientToolResult {
  sessionId: string;
  toolCallId: string;
  /** Arbitrary JSON-serializable result, or an error. */
  ok: boolean;
  result?: unknown;
  error?: string;
  /** Optional image (base64 data URL) for capture_screenshot. */
  image?: string;
}

/** SSE framing helpers (shared so client parser and server encoder agree). */
export const SSE_EVENT_PREFIX = 'data: ';

export function encodeSSE(event: AgentEvent): string {
  return `${SSE_EVENT_PREFIX}${JSON.stringify(event)}\n\n`;
}
