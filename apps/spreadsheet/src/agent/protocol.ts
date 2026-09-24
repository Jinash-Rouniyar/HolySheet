/**
 * Shared types for the two-brain loop: server streams AgentEvents over SSE;
 * the browser runs document tools and POSTs results back.
 */

export const CLIENT_READ_TOOLS = [
  'read_range',
  'get_sheets',
  'get_selection',
  'describe_workbook',
  'get_sheet_csv',
  'activate_sheet',
] as const;

/** Gated by the client approval flow. */
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

export const SERVER_TOOLS = [
  'web_search',
  'sec_lookup',
  'sec_filings',
  'sec_financials',
  'sec_concept',
  'sec_comps',
  'sec_filing_text',
  'sec_insiders',
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

export interface StartRunRequest {
  sessionId: string;
  message: string;
  context?: string;
  autoApprove?: boolean;
}

export interface ClientToolResult {
  sessionId: string;
  toolCallId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  image?: string;
}

export const SSE_EVENT_PREFIX = 'data: ';

export function encodeSSE(event: AgentEvent): string {
  return `${SSE_EVENT_PREFIX}${JSON.stringify(event)}\n\n`;
}
