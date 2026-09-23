import type { SpreadsheetComponent } from '@syncfusion/ej2-react-spreadsheet';

/**
 * Typed, batched wrapper over the Syncfusion EJ2 Spreadsheet imperative API.
 * This is the single seam between the agent's document tools and Syncfusion, so
 * planning, snapshots and audit stay replaceable if the editor ever changes
 * (mirrors GenOffice's WorkbookAdapter idea).
 *
 * Syncfusion's typings are loose in places, so a few calls are intentionally
 * cast to `any`; each such call is wrapped by the client-tool executor which
 * converts thrown errors into structured tool errors for the model.
 */
export class SpreadsheetAdapter {
  constructor(private readonly getInstance: () => SpreadsheetComponent | null) {}

  private get ss(): SpreadsheetComponent {
    const inst = this.getInstance();
    if (!inst) throw new Error('Spreadsheet is not ready yet.');
    return inst;
  }

  private activeSheetName(): string {
    const sheet = this.ss.getActiveSheet() as { name?: string };
    return sheet?.name ?? 'Sheet1';
  }

  /** Qualify an A1 range with a sheet name (defaults to the active sheet). */
  private qualify(range: string, sheet?: string): string {
    if (range.includes('!')) return range;
    return `${sheet ?? this.activeSheetName()}!${range}`;
  }

  // ---- reads -------------------------------------------------------------

  async readRange(range: string): Promise<Record<string, { value: unknown; formula?: string }>> {
    const address = range.includes('!') ? range : this.qualify(range);
    const data = (await (this.ss as any).getData(address)) as Map<string, any>;
    const out: Record<string, { value: unknown; formula?: string }> = {};
    data.forEach((cell, key) => {
      // getData keys are like "Sheet!A1"; strip the sheet prefix for brevity.
      const addr = key.includes('!') ? key.split('!')[1] : key;
      out[addr] = { value: cell?.value ?? null, formula: cell?.formula };
    });
    return out;
  }

  getSheets(): Array<{ index: number; name: string; usedRange: string }> {
    return (this.ss.sheets as any[]).map((s, index) => ({
      index,
      name: s.name,
      usedRange: this.usedRangeAddress(s),
    }));
  }

  getSelection(): { sheet: string; range: string } {
    const sheet = this.ss.getActiveSheet() as any;
    return {
      sheet: sheet?.name ?? '',
      range: sheet?.selectedRange ?? 'A1',
    };
  }

  private usedRangeAddress(sheet: any): string {
    const used = sheet?.usedRange;
    if (!used) return 'A1';
    const endCol = this.numToCol(used.colIndex ?? 0);
    return `A1:${endCol}${(used.rowIndex ?? 0) + 1}`;
  }

  async describeWorkbook(): Promise<unknown> {
    const sheets = this.getSheets();
    const detail = [];
    for (const s of sheets) {
      let headers: unknown[] = [];
      try {
        const first = await this.readRange(`${s.name}!${s.usedRange.split(':')[0]}:${s.usedRange.split(':')[1]?.replace(/\d+$/, '1') ?? 'A1'}`);
        headers = Object.entries(first)
          .filter(([addr]) => addr.endsWith('1'))
          .map(([, v]) => v.value);
      } catch {
        /* ignore header probe errors */
      }
      detail.push({ ...s, headers });
    }
    return { sheets: detail };
  }

  async getSheetCsv(sheet?: string): Promise<string> {
    const name = sheet ?? this.activeSheetName();
    const target = (this.ss.sheets as any[]).find((s) => s.name === name);
    if (!target) throw new Error(`Sheet not found: ${name}`);
    const used = target.usedRange;
    const rows = (used?.rowIndex ?? 0) + 1;
    const cols = (used?.colIndex ?? 0) + 1;
    const address = `${name}!A1:${this.numToCol(cols - 1)}${rows}`;
    const data = (await (this.ss as any).getData(address)) as Map<string, any>;
    const grid: string[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ''),
    );
    data.forEach((cell, key) => {
      const addr = key.includes('!') ? key.split('!')[1] : key;
      const m = addr.match(/^([A-Z]+)(\d+)$/);
      if (!m) return;
      const c = this.colToNum(m[1]);
      const r = parseInt(m[2], 10) - 1;
      if (r < rows && c < cols) {
        const val = cell?.value ?? '';
        grid[r][c] = String(val);
      }
    });
    return grid
      .map((row) => row.map((v) => csvEscape(v)).join(','))
      .join('\n');
  }

  // ---- mutations ---------------------------------------------------------

  setValuesMap(cells: Record<string, unknown>, sheet?: string): number {
    let count = 0;
    for (const [addr, value] of Object.entries(cells)) {
      this.ss.updateCell({ value: value as any }, this.qualify(addr, sheet));
      count++;
    }
    return count;
  }

  setValuesBlock(range: string, values: unknown[][], sheet?: string): number {
    const start = (range.includes('!') ? range.split('!')[1] : range).split(':')[0];
    const m = start.match(/^([A-Z]+)(\d+)$/);
    if (!m) throw new Error(`Bad range anchor: ${range}`);
    const startCol = this.colToNum(m[1]);
    const startRow = parseInt(m[2], 10) - 1;
    let count = 0;
    values.forEach((row, r) => {
      row.forEach((value, c) => {
        const addr = `${this.numToCol(startCol + c)}${startRow + r + 1}`;
        this.ss.updateCell({ value: value as any }, this.qualify(addr, sheet));
        count++;
      });
    });
    return count;
  }

  clearRange(range: string): void {
    (this.ss as any).clear({ type: 'Clear All', range: this.qualify(range) });
  }

  setFormat(range: string, style: Record<string, string | number>): void {
    const normalized = normalizeCellStyle(style);
    if (Object.keys(normalized).length === 0) {
      throw new Error(
        'set_format: style was empty after normalization. Use string values (fontSize must be "14pt", not 14).',
      );
    }
    this.ss.cellFormat(normalized as any, this.qualify(range));
  }

  setNumberFormat(range: string, format: string): void {
    this.ss.numberFormat(format, this.qualify(range));
  }

  merge(range: string): void {
    (this.ss as any).merge(this.qualify(range));
  }

  unmerge(range: string): void {
    (this.ss as any).merge(this.qualify(range), 'Unmerge');
  }

  autofit(range: string): void {
    (this.ss as any).autoFit(this.qualify(range));
  }

  setColWidth(startIndex: number, endIndex: number, width: number): void {
    for (let i = startIndex; i <= endIndex; i++) {
      this.ss.setColWidth(width, i, this.ss.activeSheetIndex);
    }
  }

  setRowHeight(startIndex: number, endIndex: number, height: number): void {
    for (let i = startIndex; i <= endIndex; i++) {
      this.ss.setRowHeight(height, i, this.ss.activeSheetIndex);
    }
  }

  freezePanes(rows: number, cols: number): void {
    const sheet = this.ss.getActiveSheet() as any;
    sheet.frozenRows = rows;
    sheet.frozenColumns = cols;
    (this.ss as any).dataBind?.();
    (this.ss as any).refresh?.();
  }

  insertRows(index: number, count: number): void {
    this.ss.insertRow(index, index + count - 1);
  }

  insertCols(index: number, count: number): void {
    this.ss.insertColumn(index, index + count - 1);
  }

  deleteRows(index: number, count: number): void {
    (this.ss as any).delete(index, index + count - 1, 'Row');
  }

  deleteCols(index: number, count: number): void {
    (this.ss as any).delete(index, index + count - 1, 'Column');
  }

  addSheet(name: string): void {
    (this.ss as any).insertSheet();
    const sheets = this.ss.sheets as any[];
    const last = sheets[sheets.length - 1];
    if (last) last.name = name;
    (this.ss as any).dataBind?.();
  }

  renameSheet(oldName: string, newName: string): void {
    const sheet = (this.ss.sheets as any[]).find((s) => s.name === oldName);
    if (!sheet) throw new Error(`Sheet not found: ${oldName}`);
    sheet.name = newName;
    (this.ss as any).dataBind?.();
  }

  insertChart(type: string, range: string, sheet?: string): void {
    this.ss.insertChart([
      { type: type as any, range: this.qualify(range, sheet), theme: 'Material' },
    ]);
  }

  addConditionalFormat(
    range: string,
    type: string,
    value?: string | number,
    format?: Record<string, string>,
  ): void {
    (this.ss as any).conditionalFormat({
      type,
      cFColor: undefined,
      value: value !== undefined ? String(value) : undefined,
      range: this.qualify(range),
      format: format ? { style: format } : undefined,
    });
  }

  addDataValidation(range: string, rule: Record<string, string | number>): void {
    (this.ss as any).addDataValidation(rule as any, this.qualify(range));
  }

  sortRange(range: string, order: 'Ascending' | 'Descending' = 'Ascending'): Promise<unknown> {
    return (this.ss as any).sort(
      { sortDescriptors: { order }, containsHeader: true },
      this.qualify(range),
    );
  }

  applyFilter(range: string): void {
    (this.ss as any).applyFilter(undefined, this.qualify(range));
  }

  addNamedRange(name: string, range: string): void {
    (this.ss as any).addDefinedName({ name, refersTo: `=${this.qualify(range)}` });
  }

  scrollTo(range: string): void {
    try {
      (this.ss as any).goTo(this.qualify(range));
    } catch {
      /* best effort */
    }
  }

  // ---- snapshots (undo/rollback) ----------------------------------------

  async snapshot(): Promise<unknown> {
    const res = (await (this.ss as any).saveAsJson()) as { jsonObject: unknown };
    return res.jsonObject;
  }

  restore(json: unknown): void {
    (this.ss as any).openFromJson({ file: json });
  }

  // ---- helpers -----------------------------------------------------------

  private colToNum(col: string): number {
    let n = 0;
    for (let i = 0; i < col.length; i++) {
      n = n * 26 + (col.charCodeAt(i) - 64);
    }
    return n - 1;
  }

  private numToCol(num: number): string {
    let s = '';
    let n = num + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
}

/**
 * Syncfusion cellFormat calls `.split` / `.indexOf` / `.includes` on style
 * strings. The model often sends fontSize: 14 (number), which throws and can
 * also leave a bad style on the cell so a later merge() crashes the same way.
 */
function normalizeCellStyle(
  style: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style || typeof style !== 'object') return out;
  for (const [rawKey, raw] of Object.entries(style)) {
    if (raw == null || raw === '') continue;
    const key = rawKey;
    if (key === 'fontSize') {
      out.fontSize = normalizeFontSize(raw);
      continue;
    }
    if (key === 'fontWeight') {
      out.fontWeight = raw === true || raw === 700 || raw === '700' ? 'bold' : String(raw);
      continue;
    }
    if (typeof raw === 'object') continue;
    out[key] = String(raw);
  }
  return out;
}

function normalizeFontSize(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}pt`;
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}pt`;
  return s;
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
