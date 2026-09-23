import 'server-only';
import { tool, type CoreTool } from 'ai';
import { z } from 'zod';
import type { AgentEvent } from '@/agent/protocol';
import type { AgentSession } from './session';
import { webSearch } from './search';
import {
  runBash,
  runPython,
  readSandboxFile,
  writeSandboxFile,
  listSandbox,
} from './sandbox';
import { GUIDES, listGuides } from './prompts';

type Emit = (event: AgentEvent) => void;

/**
 * Wrap a server-side tool so every run emits tool_call / tool_result events for
 * the UI timeline, using the model's real toolCallId as the correlation id.
 */
function serverTool<TArgs>(
  name: string,
  description: string,
  parameters: z.ZodType<TArgs>,
  run: (args: TArgs) => Promise<{ result: unknown; summary: string }>,
  emit: Emit,
): CoreTool {
  return tool({
    description,
    parameters: parameters as z.ZodType<TArgs>,
    execute: async (args: TArgs, { toolCallId }) => {
      emit({ type: 'tool_call', id: toolCallId, name, side: 'server', args });
      try {
        const { result, summary } = await run(args);
        emit({ type: 'tool_result', id: toolCallId, name, ok: true, summary });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({
          type: 'tool_result',
          id: toolCallId,
          name,
          ok: false,
          summary: message,
        });
        return { error: message };
      }
    },
  });
}

export function buildServerTools(
  session: AgentSession,
  emit: Emit,
): Record<string, CoreTool> {
  return {
    web_search: serverTool(
      'web_search',
      'Search the web (Tavily/Exa) for facts or data. Returns ranked results with title, url and snippet, plus an optional synthesized answer. Use this instead of guessing at external data, then write findings into the sheet.',
      z.object({
        query: z.string().describe('The search query.'),
        maxResults: z.number().int().min(1).max(10).optional(),
      }),
      async ({ query, maxResults }) => {
        const res = await webSearch(query, maxResults ?? 5);
        return {
          result: res,
          summary: `${res.provider}: ${res.results.length} results for "${query}"`,
        };
      },
      emit,
    ),

    bash: serverTool(
      'bash',
      'Run a bash command in the session sandbox (jailed scratch dir, time/output limited). Use for lightweight file wrangling and tooling. Not for anything requiring network unless the deployment allows it.',
      z.object({
        command: z.string(),
        timeoutMs: z.number().int().optional(),
      }),
      async ({ command, timeoutMs }) => {
        const r = await runBash(session.id, command, timeoutMs);
        return {
          result: r,
          summary: r.timedOut
            ? `bash timed out`
            : `bash exit ${r.exitCode}`,
        };
      },
      emit,
    ),

    python: serverTool(
      'python',
      'Run a Python 3 script in the session sandbox (pandas if installed). Best for data transforms: read an exported CSV, transform, and print/write results you then set back into the sheet.',
      z.object({
        code: z.string(),
        timeoutMs: z.number().int().optional(),
      }),
      async ({ code, timeoutMs }) => {
        const r = await runPython(session.id, code, timeoutMs);
        return {
          result: r,
          summary: r.timedOut ? `python timed out` : `python exit ${r.exitCode}`,
        };
      },
      emit,
    ),

    write_file: serverTool(
      'write_file',
      'Write a UTF-8 text file into the session sandbox scratch directory (relative path).',
      z.object({ path: z.string(), content: z.string() }),
      async ({ path, content }) => {
        await writeSandboxFile(session.id, path, content);
        return { result: { ok: true, path }, summary: `wrote ${path}` };
      },
      emit,
    ),

    read_file: serverTool(
      'read_file',
      'Read a UTF-8 text file from the session sandbox scratch directory (relative path).',
      z.object({ path: z.string() }),
      async ({ path }) => {
        const content = await readSandboxFile(session.id, path);
        return { result: { content }, summary: `read ${path}` };
      },
      emit,
    ),

    list_dir: serverTool(
      'list_dir',
      'List files in the session sandbox scratch directory.',
      z.object({ path: z.string().optional() }),
      async ({ path }) => {
        const entries = await listSandbox(session.id, path ?? '.');
        return { result: { entries }, summary: `${entries.length} entries` };
      },
      emit,
    ),

    load_guide: serverTool(
      'load_guide',
      `Load a detailed conventions guide before advanced work. One of: ${listGuides()}.`,
      z.object({ name: z.string() }),
      async ({ name }) => {
        const guide = GUIDES[name];
        if (!guide) {
          return {
            result: { error: `Unknown guide "${name}". Available: ${listGuides()}` },
            summary: `no guide ${name}`,
          };
        }
        return { result: { guide }, summary: `loaded ${name} guide` };
      },
      emit,
    ),
  };
}

// ---------------------------------------------------------------------------
// Client tool schemas (NO execute) — the AI SDK forwards these as tool calls;
// the browser executes them against the SpreadsheetAdapter and returns results
// via the tool-result round-trip. Descriptions/params must be good enough for
// the model to call them correctly.
// ---------------------------------------------------------------------------

const cellsRecord = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .describe('Map of A1 cell address -> value/formula, e.g. {"A1":"Name","B2":"=A2*2"}');

export function buildClientToolSchemas(): Record<string, CoreTool> {
  const t = (description: string, parameters: z.ZodTypeAny): CoreTool =>
    tool({ description, parameters });

  return {
    // ---- read-only ----
    get_sheets: t(
      'List all sheets in the workbook with their index, name and used range.',
      z.object({}),
    ),
    get_selection: t(
      'Get the currently selected range and active sheet.',
      z.object({}),
    ),
    describe_workbook: t(
      'Get a compact overview: sheets, dimensions, and headers of each used range. Call this first to orient yourself.',
      z.object({}),
    ),
    read_range: t(
      'Read the values (and formulas) of a range. Prefer reading only the columns/rows you need.',
      z.object({
        range: z.string().describe('A1 range, e.g. "A1:D20" or "Orders!A1:D20".'),
      }),
    ),
    get_sheet_csv: t(
      'Export a whole sheet as CSV text (for feeding into python/pandas).',
      z.object({ sheet: z.string().optional() }),
    ),

    // ---- mutations ----
    set_values: t(
      'Write values/formulas. Provide EITHER cells (address->value map) OR a 2D block via range+values. Always use formulas for derived values.',
      z.object({
        sheet: z.string().optional(),
        cells: cellsRecord.optional(),
        range: z.string().optional().describe('Top-left anchored range for a 2D block.'),
        values: z
          .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
          .optional()
          .describe('2D array of values aligned to `range`.'),
      }),
    ),
    clear_range: t('Clear the contents of a range.', z.object({ range: z.string() })),
    set_format: t(
      'Apply cell formatting to a range (bold, colors, alignment, borders, font).',
      z.object({
        range: z.string(),
        style: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .describe(
            'Syncfusion cellFormat keys. fontSize MUST include units as a string ("14pt" or "12px"), never a bare number. Other keys: fontWeight ("bold"), fontStyle ("italic"), color, backgroundColor, textAlign, verticalAlign, border ("1px solid #E5E7EB").',
          ),
      }),
    ),
    set_number_format: t(
      'Apply an Excel-style number format to a range, e.g. "#,##0.00", "0.0%", "$#,##0.00".',
      z.object({ range: z.string(), format: z.string() }),
    ),
    merge_cells: t('Merge the cells in a range.', z.object({ range: z.string() })),
    unmerge_cells: t('Unmerge the cells in a range.', z.object({ range: z.string() })),
    autofit: t(
      'Auto-fit column widths (and row heights) for a range so content is not clipped.',
      z.object({ range: z.string() }),
    ),
    set_col_width: t(
      'Set the width (px) of a column range by index.',
      z.object({
        startIndex: z.number().int(),
        endIndex: z.number().int(),
        width: z.number(),
      }),
    ),
    set_row_height: t(
      'Set the height (px) of a row range by index.',
      z.object({
        startIndex: z.number().int(),
        endIndex: z.number().int(),
        height: z.number(),
      }),
    ),
    freeze_panes: t(
      'Freeze the top N rows and/or left N columns of the active sheet.',
      z.object({ rows: z.number().int().min(0), cols: z.number().int().min(0) }),
    ),
    insert_rows: t(
      'Insert blank rows. Structural op — run before content edits.',
      z.object({ index: z.number().int(), count: z.number().int().min(1) }),
    ),
    insert_cols: t(
      'Insert blank columns. Structural op — run before content edits.',
      z.object({ index: z.number().int(), count: z.number().int().min(1) }),
    ),
    delete_rows: t(
      'Delete rows. Structural op — run before content edits.',
      z.object({ index: z.number().int(), count: z.number().int().min(1) }),
    ),
    delete_cols: t(
      'Delete columns. Structural op — run before content edits.',
      z.object({ index: z.number().int(), count: z.number().int().min(1) }),
    ),
    add_sheet: t('Add a new sheet.', z.object({ name: z.string() })),
    rename_sheet: t(
      'Rename a sheet by its current name.',
      z.object({ oldName: z.string(), newName: z.string() }),
    ),
    insert_chart: t(
      'Insert a chart. Write the data first (separate batch), then chart it.',
      z.object({
        type: z.string().describe('Column, Bar, Line, Area, Pie, Doughnut, Scatter, StackedColumn, StackedBar'),
        range: z.string().describe('Data range including headers/categories.'),
        sheet: z.string().optional(),
      }),
    ),
    add_conditional_format: t(
      'Add a conditional formatting rule to a range.',
      z.object({
        range: z.string(),
        type: z
          .string()
          .describe('e.g. GreaterThan, LessThan, Between, ColorScale, DataBar, Top10'),
        value: z.union([z.string(), z.number()]).optional(),
        format: z
          .record(z.string(), z.string())
          .optional()
          .describe('backgroundColor/color for the highlight.'),
      }),
    ),
    add_data_validation: t(
      'Add data validation to a range (e.g. a dropdown list or numeric bound).',
      z.object({
        range: z.string(),
        rule: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .describe('Syncfusion validation: type ("List","WholeNumber",...), operator, value1, value2.'),
      }),
    ),
    sort_range: t(
      'Sort a range by its first column (or a given column) ascending/descending.',
      z.object({
        range: z.string(),
        order: z.enum(['Ascending', 'Descending']).optional(),
      }),
    ),
    apply_filter: t('Enable filter on a range.', z.object({ range: z.string() })),
    add_named_range: t(
      'Define a named range.',
      z.object({ name: z.string(), range: z.string() }),
    ),

    // ---- vision + interaction ----
    capture_screenshot: t(
      'Capture a PNG screenshot of the current spreadsheet viewport and return it as an image for you to inspect (formatting QA). Optionally scroll to a range first.',
      z.object({ range: z.string().optional() }),
    ),
    present_plan: t(
      'Present an ordered plan to the user and wait for them to proceed or revise before doing large batches of edits.',
      z.object({
        title: z.string().optional(),
        steps: z.array(z.object({ title: z.string(), detail: z.string().optional() })),
      }),
    ),
    ask_user: t(
      'Ask the user a single focused question with at most 3 options when a decision materially changes the outcome and you are unsure.',
      z.object({
        question: z.string(),
        options: z.array(z.object({ id: z.string(), label: z.string() })).max(3),
      }),
    ),
  };
}
