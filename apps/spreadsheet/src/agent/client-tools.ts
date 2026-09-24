import type { SpreadsheetAdapter, WriteValuesResult } from './SpreadsheetAdapter';
import { coerceCells, coerceValuesGrid, describeArg, parseJsonIfString } from './coerce';

export interface AdapterToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** Adapter dispatch only. Plan/ask/screenshot need React state in the hook. */
export async function executeAdapterTool(
  adapter: SpreadsheetAdapter,
  name: string,
  rawArgs: unknown,
): Promise<AdapterToolResult> {
  const args = (rawArgs ?? {}) as Record<string, any>;
  try {
    switch (name) {
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

      case 'set_values': {
        const cells = coerceCells(args.cells);
        const values = coerceValuesGrid(args.values ?? args.rows ?? args.data);
        if (cells) {
          return writeValuesResult(adapter.setValuesMap(cells, args.sheet));
        }
        if (args.range && values) {
          return writeValuesResult(adapter.setValuesBlock(args.range, values, args.sheet));
        }
        return fail(
          `set_values needs a cells map/list or range + 2D values. Got range=${describeArg(args.range)} cells=${describeArg(args.cells)} values=${describeArg(args.values)}.`,
        );
      }
      case 'clear_range':
        adapter.clearRange(args.range);
        return ok({ cleared: args.range });
      case 'set_format': {
        const style = parseJsonIfString(args.style);
        adapter.setFormat(
          args.range,
          style && typeof style === 'object' && !Array.isArray(style)
            ? (style as Record<string, string | number>)
            : {},
        );
        return ok({ formatted: args.range });
      }
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
        adapter.addConditionalFormat(
          args.range,
          args.type,
          args.value,
          parseJsonIfString(args.format) as Record<string, string> | undefined,
        );
        return ok({ range: args.range, type: args.type });
      case 'add_data_validation': {
        const rule = parseJsonIfString(args.rule);
        adapter.addDataValidation(
          args.range,
          rule && typeof rule === 'object' && !Array.isArray(rule)
            ? (rule as Record<string, string | number>)
            : {},
        );
        return ok({ range: args.range });
      }
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

function writeValuesResult(written: WriteValuesResult): AdapterToolResult {
  if (written.count === 0 && written.skipped.length) {
    return fail(
      `No cells written. Circular formulas: ${written.skipped.join('; ')}. Put totals outside the summed range.`,
    );
  }
  return ok({
    cellsWritten: written.count,
    repaired: written.repaired.length ? written.repaired : undefined,
    skipped: written.skipped.length ? written.skipped : undefined,
  });
}

function ok(result: unknown): AdapterToolResult {
  return { ok: true, result };
}
function fail(error: string): AdapterToolResult {
  return { ok: false, error };
}
