import type { SpreadsheetAdapter } from './SpreadsheetAdapter';
import { parseJsonIfString } from './coerce';

export interface AdapterToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Execute a read/mutate document tool against the adapter. Plan/ask/screenshot
 * and the approval + snapshot lifecycle are handled by the agent hook (they need
 * React state), not here. Every adapter call is wrapped so thrown Syncfusion
 * errors become structured tool errors the model can react to.
 */
export async function executeAdapterTool(
  adapter: SpreadsheetAdapter,
  name: string,
  rawArgs: unknown,
): Promise<AdapterToolResult> {
  const args = (rawArgs ?? {}) as Record<string, any>;
  try {
    switch (name) {
      // ---- reads ----
      case 'read_range':
        return ok(await adapter.readRange(args.range));
      case 'get_sheets':
        return ok(adapter.getSheets());
      case 'get_selection':
        return ok(adapter.getSelection());
      case 'describe_workbook':
        return ok(await adapter.describeWorkbook());
      case 'get_sheet_csv':
        return ok({ csv: await adapter.getSheetCsv(args.sheet) });
      case 'activate_sheet':
        adapter.activateSheet(args.name);
        return ok({ active: args.name });

      // ---- mutations ----
      case 'set_values': {
        const cells = parseJsonIfString(args.cells);
        const values = parseJsonIfString(args.values);
        if (cells && typeof cells === 'object' && !Array.isArray(cells)) {
          const n = adapter.setValuesMap(cells as Record<string, unknown>, args.sheet);
          return ok({ cellsWritten: n });
        }
        if (args.range && Array.isArray(values)) {
          const n = adapter.setValuesBlock(args.range, values as unknown[][], args.sheet);
          return ok({ cellsWritten: n });
        }
        return fail('Provide either `cells` or `range`+`values` (values must be a 2D array).');
      }
      case 'clear_range':
        adapter.clearRange(args.range);
        return ok({ cleared: args.range });
      case 'set_format':
        adapter.setFormat(args.range, args.style ?? {});
        return ok({ formatted: args.range });
      case 'set_number_format':
        adapter.setNumberFormat(args.range, args.format);
        return ok({ range: args.range, format: args.format });
      case 'merge_cells':
        adapter.merge(args.range);
        return ok({ merged: args.range });
      case 'unmerge_cells':
        adapter.unmerge(args.range);
        return ok({ unmerged: args.range });
      case 'autofit':
        adapter.autofit(args.range);
        return ok({ autofit: args.range });
      case 'set_col_width':
        adapter.setColWidth(args.startIndex, args.endIndex, args.width);
        return ok({ ok: true });
      case 'set_row_height':
        adapter.setRowHeight(args.startIndex, args.endIndex, args.height);
        return ok({ ok: true });
      case 'freeze_panes':
        adapter.freezePanes(args.rows ?? 0, args.cols ?? 0);
        return ok({ rows: args.rows, cols: args.cols });
      case 'insert_rows':
        adapter.insertRows(args.index, args.count);
        return ok({ inserted: args.count });
      case 'insert_cols':
        adapter.insertCols(args.index, args.count);
        return ok({ inserted: args.count });
      case 'delete_rows':
        adapter.deleteRows(args.index, args.count);
        return ok({ deleted: args.count });
      case 'delete_cols':
        adapter.deleteCols(args.index, args.count);
        return ok({ deleted: args.count });
      case 'add_sheet':
        adapter.addSheet(args.name);
        return ok({ added: args.name });
      case 'rename_sheet':
        adapter.renameSheet(args.oldName, args.newName);
        return ok({ renamed: args.newName });
      case 'insert_chart': {
        const chart = await adapter.insertChart(args.type, args.range, args.sheet);
        return ok({ chart: args.type, range: args.range, boundRange: chart.range, packed: chart.packed });
      }
      case 'add_conditional_format':
        adapter.addConditionalFormat(args.range, args.type, args.value, args.format);
        return ok({ range: args.range, type: args.type });
      case 'add_data_validation':
        adapter.addDataValidation(args.range, args.rule ?? {});
        return ok({ range: args.range });
      case 'sort_range':
        await adapter.sortRange(args.range, args.order);
        return ok({ sorted: args.range });
      case 'apply_filter':
        adapter.applyFilter(args.range);
        return ok({ filtered: args.range });
      case 'add_named_range':
        adapter.addNamedRange(args.name, args.range);
        return ok({ name: args.name, range: args.range });

      default:
        return fail(`Unknown document tool: ${name}`);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

function ok(result: unknown): AdapterToolResult {
  return { ok: true, result };
}
function fail(error: string): AdapterToolResult {
  return { ok: false, error };
}
