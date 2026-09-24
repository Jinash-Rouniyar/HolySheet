import 'server-only';
import { tool, type CoreTool } from 'ai';
import { z } from 'zod';
import type { AgentEvent } from '@/agent/protocol';
import type { AgentSession } from './session';
import { webSearch } from './search';
import {
  secLookup,
  secFilings,
  secFinancials,
  secConcept,
  secComps,
  secFilingText,
  secInsiders,
} from './edgar';
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
 * GPT-5.x rejects optional keys, open records, and mixed unions.
 * Rewrite to nullable-required fields before the request goes out.
 */
function openaiParameters(schema: z.ZodTypeAny): z.ZodTypeAny {
  return assertOpenAiShape('tool', rewriteForOpenAi(schema));
}

function rewriteForOpenAi(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional) {
    const inner = rewriteForOpenAi(schema.unwrap());
    const nullable = inner instanceof z.ZodNullable ? inner : inner.nullable();
    const desc = schema.description ?? inner.description;
    return desc ? nullable.describe(desc) : nullable;
  }
  if (schema instanceof z.ZodNullable) {
    const inner = rewriteForOpenAi(schema.unwrap());
    return inner instanceof z.ZodNullable ? inner : inner.nullable();
  }
  if (schema instanceof z.ZodEffects) {
    return rewriteForOpenAi(schema.innerType());
  }
  if (schema instanceof z.ZodRecord) {
    const desc = schema.description;
    const s = z
      .string()
      .describe(
        `${desc ? `${desc} ` : ''}Pass a JSON object encoded as a string.`,
      );
    return s;
  }
  if (schema instanceof z.ZodUnion) {
    const options = schema.options as z.ZodTypeAny[];
    const rewritten = options.map((option) => rewriteForOpenAi(option));
    const primitive = rewritten.every(
      (option) =>
        option instanceof z.ZodString ||
        option instanceof z.ZodNumber ||
        option instanceof z.ZodBoolean ||
        option instanceof z.ZodNull ||
        option instanceof z.ZodEnum ||
        option instanceof z.ZodLiteral,
    );
    if (primitive) {
      return z
        .string()
        .describe(schema.description ?? 'Value as a string (numbers/booleans allowed as text).');
    }
    return z.union(rewritten as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const next: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(shape)) {
      next[key] = rewriteForOpenAi(value);
    }
    return z.object(next);
  }
  if (schema instanceof z.ZodArray) {
    return z.array(rewriteForOpenAi(schema.element));
  }
  return schema;
}

function assertOpenAiShape(path: string, schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional) {
    throw new Error(`OpenAI schema ${path}: leftover .optional()`);
  }
  if (schema instanceof z.ZodRecord) {
    throw new Error(`OpenAI schema ${path}: leftover z.record()`);
  }
  if (schema instanceof z.ZodEffects) {
    throw new Error(`OpenAI schema ${path}: leftover preprocess/transform`);
  }
  if (schema instanceof z.ZodUnion) {
    throw new Error(`OpenAI schema ${path}: leftover union (use a single type)`);
  }
  if (schema instanceof z.ZodNullable) {
    assertOpenAiShape(path, schema.unwrap());
    return schema;
  }
  if (schema instanceof z.ZodObject) {
    for (const [key, value] of Object.entries(schema.shape)) {
      assertOpenAiShape(`${path}.${key}`, value as z.ZodTypeAny);
    }
    return schema;
  }
  if (schema instanceof z.ZodArray) {
    assertOpenAiShape(`${path}[]`, schema.element);
    return schema;
  }
  return schema;
}

/** Emit timeline events keyed by the model's toolCallId. */
function serverTool<TArgs>(
  name: string,
  description: string,
  parameters: z.ZodType<TArgs>,
  run: (args: TArgs) => Promise<{ result: unknown; summary: string }>,
  emit: Emit,
): CoreTool {
  return tool({
    description,
    parameters: openaiParameters(parameters) as z.ZodType<TArgs>,
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

    sec_lookup: serverTool(
      'sec_lookup',
      'Resolve a US-listed issuer on SEC EDGAR. Pass a ticker, CIK, or company name. Use this before other sec_* tools. Not for prices or private/non-US companies.',
      z.object({
        query: z.string().describe('Ticker (AAPL), CIK, or company name.'),
      }),
      async ({ query }) => {
        const res = await secLookup(query);
        return {
          result: res,
          summary: `${res.match.ticker || res.match.cik}: ${res.match.name}`,
        };
      },
      emit,
    ),

    sec_filings: serverTool(
      'sec_filings',
      'List recent SEC filings for an issuer (10-K, 10-Q, 8-K, 4, 20-F, …). Returns form, filed date, period, accession, 8-K items, and document URL. Use exact form codes (10-K not 10-K/A unless you want amendments).',
      z.object({
        ticker: z.string().describe('Ticker or CIK.'),
        forms: z.array(z.string()).optional().describe('e.g. ["10-K","8-K"]. Exact form codes.'),
        limit: z.number().int().min(1).max(100).optional(),
        since: z.string().optional().describe('Inclusive YYYY-MM-DD.'),
        until: z.string().optional().describe('Inclusive YYYY-MM-DD.'),
      }),
      async ({ ticker, forms, limit, since, until }) => {
        const res = await secFilings({ tickerOrCik: ticker, forms, limit, since, until });
        return {
          result: res,
          summary: `${res.entity.ticker || res.entity.cik}: ${res.filings.length} filings`,
        };
      },
      emit,
    ),

    sec_financials: serverTool(
      'sec_financials',
      'Pull a compact income / balance / cashflow / metrics table from SEC XBRL companyfacts. Annual uses latest non-amendment 10-K (20-F fallback); quarterly uses 10-Q. Banks/insurers/REITs may omit mapped lines — use unmappedHints + sec_concept. Write numbers as values; forecasts as formulas. Not for live prices.',
      z.object({
        ticker: z.string().describe('Ticker or CIK.'),
        statement: z.enum(['income', 'balance', 'cashflow', 'metrics']),
        period: z.enum(['annual', 'quarterly']),
        years: z.number().int().min(1).max(15).optional().describe('How many periods (default 5).'),
      }),
      async ({ ticker, statement, period, years }) => {
        const res = await secFinancials({ tickerOrCik: ticker, statement, period, years });
        return {
          result: res,
          summary: `${res.entity.ticker || res.entity.cik} ${statement} ${period}: ${res.rows.length} lines × ${res.columns.length}y`,
        };
      },
      emit,
    ),

    sec_concept: serverTool(
      'sec_concept',
      'Fetch one us-gaap/ifrs/dei tag time series for an issuer, or search that issuer\'s reported fact keys. Use when sec_financials missed a line (banks, insurers, REITs).',
      z.object({
        ticker: z.string().describe('Ticker or CIK.'),
        tag: z.string().optional().describe('e.g. InterestIncome or us-gaap:Revenues'),
        search: z.string().optional().describe('Substring over tag names/labels if you do not know the tag.'),
      }),
      async ({ ticker, tag, search }) => {
        const res = await secConcept({ tickerOrCik: ticker, tag, search });
        if ('matches' in res) {
          return { result: res, summary: `${res.entity.ticker}: ${res.matches.length} tag matches` };
        }
        return {
          result: res,
          summary: `${res.entity.ticker} ${res.tag}: ${res.points.length} pts`,
        };
      },
      emit,
    ),

    sec_comps: serverTool(
      'sec_comps',
      'One XBRL tag × one period × up to 15 tickers (SEC frames, companyfacts fallback). Period like FY2023 or 2023Q2. For peer tables, not a full screener.',
      z.object({
        tag: z.string().describe('us-gaap tag, e.g. Revenues or OperatingIncomeLoss'),
        period: z.string().describe('FY2023, 2023Q2, or CY2023Q4I'),
        tickers: z.array(z.string()).min(1).max(15),
      }),
      async ({ tag, period, tickers }) => {
        const res = await secComps({ tag, period, tickers });
        return {
          result: res,
          summary: `${tag} ${period}: ${res.rows.length} peers`,
        };
      },
      emit,
    ),

    sec_filing_text: serverTool(
      'sec_filing_text',
      'Search EDGAR full text (efts) and/or pull a capped excerpt (~12k chars) of a filing. Pass ticker+query for hits, or accession (+ ticker) to open a specific document. Use for MD&A, 8-K body, EX-99 — not whole 10-K ingest.',
      z.object({
        ticker: z.string().optional().describe('Ticker or CIK (required with accession, recommended with query).'),
        query: z.string().optional().describe('Full-text search, e.g. "goodwill impairment".'),
        accession: z.string().optional().describe('Accession number like 0000320193-24-000123.'),
        forms: z.array(z.string()).optional(),
      }),
      async ({ ticker, query, accession, forms }) => {
        const res = await secFilingText({ tickerOrCik: ticker, query, accession, forms });
        const n = res.excerpt?.length ?? 0;
        return {
          result: res,
          summary: res.excerpt
            ? `excerpt ${n} chars${res.hits.length ? `, ${res.hits.length} hits` : ''}`
            : `${res.hits.length} filing hits`,
        };
      },
      emit,
    ),

    sec_insiders: serverTool(
      'sec_insiders',
      'Recent Form 4 insider transactions for an issuer: date, insider, role, code, shares, price, remaining stake. Not a full ownership graph.',
      z.object({
        ticker: z.string().describe('Ticker or CIK.'),
        limit: z.number().int().min(1).max(25).optional(),
      }),
      async ({ ticker, limit }) => {
        const res = await secInsiders({ tickerOrCik: ticker, limit });
        return {
          result: res,
          summary: `${res.entity.ticker || res.entity.cik}: ${res.rows.length} Form 4 rows`,
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

// Schemas only — execute lives in the browser.

const cellWrite = z.object({
  address: z.string().describe('A1 address, e.g. "B12" or "Budget!B12".'),
  value: z.string().describe('Literal or formula. Formulas MUST start with =.'),
});

const cellStyle = z.object({
  fontWeight: z.string().nullable(),
  fontStyle: z.string().nullable(),
  fontSize: z.string().nullable(),
  color: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  textAlign: z.string().nullable(),
  verticalAlign: z.string().nullable(),
  border: z.string().nullable(),
});

const highlightFormat = z.object({
  backgroundColor: z.string().nullable(),
  color: z.string().nullable(),
});

const validationRule = z.object({
  type: z.string().describe('List, WholeNumber, Decimal, Date, TextLength, …'),
  operator: z.string().nullable(),
  value1: z.string().nullable(),
  value2: z.string().nullable(),
});

export function buildClientToolSchemas(): Record<string, CoreTool> {
  const t = (description: string, parameters: z.ZodTypeAny): CoreTool =>
    tool({ description, parameters: openaiParameters(parameters) });

  return {
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
    activate_sheet: t(
      'Switch the visible tab to this sheet. Call after add_sheet before formatting/merging that sheet.',
      z.object({ name: z.string() }),
    ),

    set_values: t(
      'Write values/formulas. Prefer range + values as a real 2D array of strings (numbers as "5000", formulas as "=B2-B3"). Do NOT stringify the whole grid. Sparse writes: cells [{address,value}]. Totals must sit outside the range they SUM.',
      z.object({
        sheet: z.string().optional().describe('Sheet name if range is not qualified.'),
        range: z
          .string()
          .optional()
          .describe('Top-left of the 2D block, e.g. "A1" or "Budget!A1". Required with values.'),
        values: z
          .array(z.array(z.string()))
          .optional()
          .describe('2D grid of strings aligned to range. Not a JSON string.'),
        cells: z
          .array(cellWrite)
          .optional()
          .describe('Sparse A1 writes. Prefer range+values for tables.'),
      }),
    ),
    clear_range: t('Clear the contents of a range.', z.object({ range: z.string() })),
    set_format: t(
      'Apply cell formatting to a range (bold, colors, alignment, borders, font).',
      z.object({
        range: z.string(),
        style: cellStyle.describe(
          'Cell format. fontSize MUST be a string with units ("14pt"), never a bare number. Unused keys: pass null.',
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
    add_sheet: t(
      'Add a new sheet and switch to it. Follow with writes using SheetName!A1 ranges.',
      z.object({ name: z.string() }),
    ),
    rename_sheet: t(
      'Rename a sheet by its current name.',
      z.object({ oldName: z.string(), newName: z.string() }),
    ),
    insert_chart: t(
      'Insert a chart. Write the data first (separate batch), then chart it.',
      z.object({
        type: z.string().describe('Column, Bar, Line, Area, Pie, Doughnut, Scatter, StackedColumn, StackedBar'),
        range: z.string().describe('Contiguous A1 range including headers, e.g. "A1:B13". Disjoint "A7:A19,H7:H19" is also accepted and packed.'),
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
        value: z.string().optional().describe('Threshold as a string, e.g. "100" or "0.2".'),
        format: highlightFormat.optional(),
      }),
    ),
    add_data_validation: t(
      'Add data validation to a range (e.g. a dropdown list or numeric bound).',
      z.object({
        range: z.string(),
        rule: validationRule,
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
      'REQUIRED whenever you would otherwise list 2–3 choices in chat (budget type, layout, sheet vs new tab, etc.). Renders clickable chips. Do not put the options in your message text. One question, 2 or 3 options, then stop and wait.',
      z.object({
        question: z.string().describe('A single focused question.'),
        options: z
          .array(
            z.object({
              id: z.string().describe('Short stable id, e.g. personal, household, business.'),
              label: z.string().describe('Button text the user taps.'),
            }),
          )
          .min(2)
          .max(3),
      }),
    ),
  };
}
