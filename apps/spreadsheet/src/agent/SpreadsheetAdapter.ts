import type { SpreadsheetComponent } from '@syncfusion/ej2-react-spreadsheet';

/** Single seam to Syncfusion so document tools stay replaceable if the editor changes. */
export interface WriteValuesResult {
  count: number;
  repaired: string[];
  skipped: string[];
}

function emptyWriteResult(): WriteValuesResult {
  return { count: 0, repaired: [], skipped: [] };
}

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

  private qualify(range: string, sheet?: string): string {
    if (range.includes('!')) return range;
    return `${sheet ?? this.activeSheetName()}!${range}`;
  }

  async readRange(range: string): Promise<Record<string, { value: unknown; formula?: string }>> {
    const address = range.includes('!') ? range : this.qualify(range);
    const data = (await (this.ss as any).getData(address)) as Map<string, any>;
    const out: Record<string, { value: unknown; formula?: string }> = {};
    data.forEach((cell, key) => {
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

  setValuesMap(cells: Record<string, unknown>, sheet?: string): WriteValuesResult {
    const first = Object.keys(cells)[0];
    if (first) this.ensureSheetForRange(first, sheet);
    const result = emptyWriteResult();
    for (const [addr, value] of Object.entries(cells)) {
      this.writeCell(addr, value, sheet, result);
    }
    return result;
  }

  setValuesBlock(range: string, values: unknown[][], sheet?: string): WriteValuesResult {
    this.ensureSheetForRange(range, sheet);
    const start = (range.includes('!') ? range.split('!')[1] : range).split(':')[0];
    const m = start.match(/^([A-Z]+)(\d+)$/i);
    if (!m) throw new Error(`Bad range anchor: ${range}`);
    const startCol = this.colToNum(m[1].toUpperCase());
    const startRow = parseInt(m[2], 10) - 1;
    const result = emptyWriteResult();
    values.forEach((row, r) => {
      const cells = Array.isArray(row) ? row : [row];
      cells.forEach((value, c) => {
        const addr = `${this.numToCol(startCol + c)}${startRow + r + 1}`;
        this.writeCell(addr, value, sheet, result);
      });
    });
    return result;
  }

  private writeCell(
    addr: string,
    value: unknown,
    sheet: string | undefined,
    result: WriteValuesResult,
  ): void {
    const prepared = this.prepareFormula(addr, value);
    if (prepared.skip) {
      result.skipped.push(prepared.skip);
      return;
    }
    this.ss.updateCell({ value: prepared.value as any }, this.qualify(addr, sheet));
    result.count += 1;
    if (prepared.repaired) result.repaired.push(prepared.repaired);
  }

  clearRange(range: string): void {
    this.ensureSheetForRange(range);
    (this.ss as any).clear({ type: 'Clear All', range: this.qualify(range) });
  }

  setFormat(range: string, style: Record<string, string | number>): void {
    this.ensureSheetForRange(range);
    this.ensureGrid(range);
    const normalized = normalizeCellStyle(style);
    if (Object.keys(normalized).length === 0) {
      throw new Error(
        'set_format: style was empty after normalization. Use string values (fontSize must be "14pt", not 14).',
      );
    }
    this.ss.cellFormat(normalized as any, this.qualify(range));
  }

  setNumberFormat(range: string, format: string): void {
    this.ensureSheetForRange(range);
    this.ss.numberFormat(format, this.qualify(range));
  }

  merge(range: string): void {
    this.ensureSheetForRange(range);
    const parsed = this.ensureGrid(range);
    try {
      (this.ss as any).merge(this.qualify(range));
    } catch {
      this.applyMergeModel(parsed, true);
      this.refreshQuiet();
    }
  }

  unmerge(range: string): void {
    this.ensureSheetForRange(range);
    const parsed = this.ensureGrid(range);
    try {
      (this.ss as any).merge(this.qualify(range), 'Unmerge');
    } catch {
      this.applyMergeModel(parsed, false);
      this.refreshQuiet();
    }
  }

  autofit(range: string): void {
    this.ensureSheetForRange(range);
    // Syncfusion autoFit reads viewport DOM nodes that are often missing after agent writes.
    let span: { kind: 'cols' | 'rows'; start: number; end: number };
    try {
      span = this.parseAutoFitSpan(range);
    } catch {
      throw new Error(`autofit: bad range "${range}". Use A:K, 1:12, or A1:K20.`);
    }
    if (span.kind === 'rows') {
      this.setRowHeight(span.start, span.end, 22);
      return;
    }
    const sheet = this.ss.getActiveSheet() as any;
    const widths = this.measureColumnWidths(sheet, span.start, span.end);
    this.applyColumnWidths(span.start, widths);
  }

  setColWidth(startIndex: number, endIndex: number, width: number): void {
    const w = Math.max(0, width);
    const count = Math.max(0, endIndex - startIndex + 1);
    this.applyColumnWidths(startIndex, Array.from({ length: count }, () => w));
  }

  setRowHeight(startIndex: number, endIndex: number, height: number): void {
    const sheet = this.ss.getActiveSheet() as any;
    if (!Array.isArray(sheet.rows)) sheet.rows = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (!sheet.rows[i]) sheet.rows[i] = {};
      sheet.rows[i].height = height;
      try {
        this.ss.setRowHeight(height, i, this.ss.activeSheetIndex);
      } catch {
        /* model already has the height */
      }
    }
    this.refreshQuiet();
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
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Sheet name is required.');
    const sheets = this.ss.sheets as any[];
    if (sheets.some((s) => s.name === trimmed)) {
      throw new Error(`Sheet already exists: ${trimmed}`);
    }
    // insertSheet() with no model leaves rows undefined; merge/format then throw.
    (this.ss as any).insertSheet([{ name: trimmed, rowCount: 100, colCount: 26 }]);
    this.activateSheet(trimmed);
  }

  activateSheet(name: string): void {
    const sheets = this.ss.sheets as any[];
    const index = sheets.findIndex((s) => s.name === name);
    if (index < 0) throw new Error(`Sheet not found: ${name}`);
    this.ss.activeSheetIndex = index;
    try {
      (this.ss as any).goTo(`${name}!A1`);
    } catch {
      /* goTo is best-effort */
    }
    // refresh() after a tab switch races SheetTabs' focus RAF (parent is already null).
  }

  /** Syncfusion merge/format read the active sheet's rows only. */
  private ensureSheetForRange(range: string, sheet?: string): void {
    const name =
      sheet ??
      (range.includes('!') ? range.split('!')[0] : undefined);
    if (name) this.activateSheet(name);
  }

  /** Sparse cells are undefined; merge/format then read `.style` and throw. */
  private ensureGrid(range: string): {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } {
    const parsed = this.parseA1(range);
    const sheet = this.ss.getActiveSheet() as any;
    if (!Array.isArray(sheet.rows)) sheet.rows = [];
    for (let r = parsed.startRow; r <= parsed.endRow; r++) {
      if (!sheet.rows[r]) sheet.rows[r] = { cells: [] };
      if (!Array.isArray(sheet.rows[r].cells)) sheet.rows[r].cells = [];
      for (let c = parsed.startCol; c <= parsed.endCol; c++) {
        if (!sheet.rows[r].cells[c]) sheet.rows[r].cells[c] = {};
      }
    }
    return parsed;
  }

  private applyMergeModel(
    parsed: { startCol: number; startRow: number; endCol: number; endRow: number },
    merge: boolean,
  ): void {
    const sheet = this.ss.getActiveSheet() as any;
    const rowSpan = parsed.endRow - parsed.startRow + 1;
    const colSpan = parsed.endCol - parsed.startCol + 1;
    if (merge) {
      const cell = sheet.rows[parsed.startRow].cells[parsed.startCol];
      if (colSpan > 1) cell.colSpan = colSpan;
      if (rowSpan > 1) cell.rowSpan = rowSpan;
      return;
    }
    for (let r = parsed.startRow; r <= parsed.endRow; r++) {
      for (let c = parsed.startCol; c <= parsed.endCol; c++) {
        const cell = sheet.rows[r]?.cells?.[c];
        if (!cell) continue;
        delete cell.rowSpan;
        delete cell.colSpan;
      }
    }
  }

  renameSheet(oldName: string, newName: string): void {
    const sheet = (this.ss.sheets as any[]).find((s) => s.name === oldName);
    if (!sheet) throw new Error(`Sheet not found: ${oldName}`);
    sheet.name = newName;
    (this.ss as any).dataBind?.();
    this.activateSheet(newName);
  }

  /** Syncfusion charts bind one contiguous range; a disjoint Excel range plots only the first column. */
  async insertChart(
    type: string,
    range: string,
    sheet?: string,
  ): Promise<{ range: string; packed: boolean }> {
    const resolved = await this.resolveChartRange(range, sheet);
    this.ss.insertChart([
      {
        type: normalizeChartType(type) as any,
        range: resolved.address,
        theme: 'Material',
      },
    ]);
    return { range: resolved.address, packed: resolved.packed };
  }

  private async resolveChartRange(
    range: string,
    sheet?: string,
  ): Promise<{ address: string; packed: boolean }> {
    const parts = range
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      return { address: this.qualify(parts[0] ?? range, sheet), packed: false };
    }
    return { address: await this.packChartSeries(parts, sheet), packed: true };
  }

  private async packChartSeries(parts: string[], sheet?: string): Promise<string> {
    const columns: Array<Array<unknown>> = [];
    let height = 0;
    for (const part of parts) {
      const data = await this.readRange(part.includes('!') ? part : this.qualify(part, sheet));
      const parsed = this.parseA1(part.includes('!') ? part.split('!')[1] : part);
      const col: unknown[] = [];
      for (let r = parsed.startRow; r <= parsed.endRow; r++) {
        const addr = `${this.numToCol(parsed.startCol)}${r + 1}`;
        col.push(data[addr]?.value ?? data[addr]?.formula ?? '');
      }
      height = Math.max(height, col.length);
      columns.push(col);
    }
    const destCol = this.nextPackColumn();
    const destRow = 0;
    const values = Array.from({ length: height }, (_, r) =>
      columns.map((col) => col[r] ?? ''),
    );
    this.setValuesBlock(
      `${this.numToCol(destCol)}${destRow + 1}`,
      values,
      sheet ?? this.activeSheetName(),
    );
    const endCol = destCol + columns.length - 1;
    return this.qualify(
      `${this.numToCol(destCol)}${destRow + 1}:${this.numToCol(endCol)}${destRow + height}`,
      sheet,
    );
  }

  private nextPackColumn(): number {
    const sheets = this.ss.sheets as any[];
    const sheet = sheets[this.ss.activeSheetIndex] ?? sheets[0];
    const used = sheet?.usedRange?.colIndex ?? 0;
    return used + 2;
  }

  /** Models often write the destination into its own formula (`=SUM(G16:G17)` in G17). */
  private prepareFormula(
    addr: string,
    value: unknown,
  ): { value: unknown; repaired?: string; skip?: string } {
    const text = value == null ? '' : String(value).trim();
    if (!text.startsWith('=')) return { value };
    const body = addr.includes('!') ? addr.split('!')[1] : addr;
    const dest = this.tryParseA1(body);
    if (!dest) return { value };
    if (!this.formulaRefersTo(text, dest.startCol, dest.startRow)) return { value };
    const rewritten = this.rewriteSelfRefs(text, dest.startCol, dest.startRow);
    if (!rewritten || this.formulaRefersTo(rewritten, dest.startCol, dest.startRow)) {
      return { value, skip: `${body} ${text}` };
    }
    return { value: rewritten, repaired: `${body} ${text} → ${rewritten}` };
  }

  private rewriteSelfRefs(formula: string, col: number, row: number): string | null {
    const above = row > 0 ? `${this.numToCol(col)}${row}` : null;
    let next = formula.replace(
      /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/gi,
      (full, c1: string, r1: string, c2: string, r2: string) => {
        const clipped = this.clipRangeToExclude(
          this.colToNum(c1.toUpperCase()),
          parseInt(r1, 10) - 1,
          this.colToNum(c2.toUpperCase()),
          parseInt(r2, 10) - 1,
          col,
          row,
        );
        return clipped ?? full;
      },
    );
    next = next.replace(/\$?([A-Z]+):\$?([A-Z]+)(?!\d)/gi, (full, c1: string, c2: string) => {
      const left = this.colToNum(c1.toUpperCase());
      const right = this.colToNum(c2.toUpperCase());
      if (col < Math.min(left, right) || col > Math.max(left, right) || row === 0) return full;
      const letter = this.numToCol(col);
      return `${letter}1:${letter}${row}`;
    });
    if (above) {
      const self = new RegExp(`\\$?${this.numToCol(col)}\\$?${row + 1}(?!\\d)`, 'gi');
      next = next.replace(self, above);
      next = next.replace(/([A-Z]+\d+)\s*([+-])\s*\1/gi, '$1');
    }
    return next === formula ? null : next;
  }

  private clipRangeToExclude(
    c1: number,
    r1: number,
    c2: number,
    r2: number,
    col: number,
    row: number,
  ): string | null {
    let cStart = Math.min(c1, c2);
    let cEnd = Math.max(c1, c2);
    let rStart = Math.min(r1, r2);
    let rEnd = Math.max(r1, r2);
    if (col < cStart || col > cEnd || row < rStart || row > rEnd) return null;
    if (cStart === cEnd) {
      if (row === rEnd) rEnd = row - 1;
      else if (row === rStart) rStart = row + 1;
      else rEnd = row - 1;
    } else if (rStart === rEnd) {
      if (col === cEnd) cEnd = col - 1;
      else if (col === cStart) cStart = col + 1;
      else cEnd = col - 1;
    } else if (row === rEnd) {
      rEnd = row - 1;
    } else {
      return null;
    }
    if (cEnd < cStart || rEnd < rStart) return null;
    const a = `${this.numToCol(cStart)}${rStart + 1}`;
    const b = `${this.numToCol(cEnd)}${rEnd + 1}`;
    return a === b ? a : `${a}:${b}`;
  }

  private tryParseA1(range: string): ReturnType<SpreadsheetAdapter['parseA1']> | null {
    try {
      return this.parseA1(range);
    } catch {
      return null;
    }
  }

  private formulaRefersTo(formula: string, col: number, row: number): boolean {
    const body = formula.replace(/^=/, '');
    const rangeRe = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = rangeRe.exec(body))) {
      const c1 = this.colToNum(m[1].toUpperCase());
      const r1 = parseInt(m[2], 10) - 1;
      const c2 = this.colToNum(m[3].toUpperCase());
      const r2 = parseInt(m[4], 10) - 1;
      if (
        col >= Math.min(c1, c2) &&
        col <= Math.max(c1, c2) &&
        row >= Math.min(r1, r2) &&
        row <= Math.max(r1, r2)
      ) {
        return true;
      }
    }
    const colRe = /\$?([A-Z]+):\$?([A-Z]+)(?!\d)/gi;
    while ((m = colRe.exec(body))) {
      const c1 = this.colToNum(m[1].toUpperCase());
      const c2 = this.colToNum(m[2].toUpperCase());
      if (col >= Math.min(c1, c2) && col <= Math.max(c1, c2)) return true;
    }
    const stripped = body
      .replace(/\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/gi, '')
      .replace(/\$?[A-Z]+:\$?[A-Z]+(?!\d)/gi, '');
    const cellRe = /\$?([A-Z]+)\$?(\d+)/gi;
    while ((m = cellRe.exec(stripped))) {
      if (this.colToNum(m[1].toUpperCase()) === col && parseInt(m[2], 10) - 1 === row) {
        return true;
      }
    }
    return false;
  }

  private parseA1(range: string): {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } {
    const body = range.includes('!') ? range.split('!')[1] : range;
    const [start, end] = (body.includes(':') ? body : `${body}:${body}`).split(':');
    const sm = start.match(/^([A-Z]+)(\d+)$/i);
    const em = (end ?? start).match(/^([A-Z]+)(\d+)$/i);
    if (!sm || !em) throw new Error(`Bad chart range: ${range}`);
    return {
      startCol: this.colToNum(sm[1].toUpperCase()),
      startRow: parseInt(sm[2], 10) - 1,
      endCol: this.colToNum(em[1].toUpperCase()),
      endRow: parseInt(em[2], 10) - 1,
    };
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

  async snapshot(): Promise<unknown> {
    const res = (await (this.ss as any).saveAsJson()) as { jsonObject: unknown };
    return res.jsonObject;
  }

  restore(json: unknown): void {
    if (json == null) throw new Error('No snapshot to restore.');
    (this.ss as any).openFromJson({ file: json });
    (this.ss as any).refresh?.();
  }

  private textCtx: CanvasRenderingContext2D | null = null;

  private parseAutoFitSpan(range: string): { kind: 'cols' | 'rows'; start: number; end: number } {
    const body = (range.includes('!') ? range.split('!')[1] : range).trim();
    const cols = body.match(/^([A-Z]+):([A-Z]+)$/i);
    if (cols) {
      const start = this.colToNum(cols[1].toUpperCase());
      const end = this.colToNum(cols[2].toUpperCase());
      return { kind: 'cols', start: Math.min(start, end), end: Math.max(start, end) };
    }
    const rows = body.match(/^(\d+):(\d+)$/);
    if (rows) {
      const start = parseInt(rows[1], 10) - 1;
      const end = parseInt(rows[2], 10) - 1;
      return { kind: 'rows', start: Math.min(start, end), end: Math.max(start, end) };
    }
    const parsed = this.parseA1(body);
    return { kind: 'cols', start: parsed.startCol, end: parsed.endCol };
  }

  private measureColumnWidths(sheet: any, startCol: number, endCol: number): number[] {
    const rows: any[] = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const widths: number[] = [];
    for (let c = startCol; c <= endCol; c++) {
      let max = 64;
      for (let r = 0; r < rows.length; r++) {
        const cell = rows[r]?.cells?.[c];
        if (!cell) continue;
        if (typeof cell.colSpan === 'number' && cell.colSpan > 1) continue;
        const text = this.cellDisplayText(cell);
        if (!text) continue;
        const w = Math.ceil(this.measureTextWidth(text, cell.style) + 18);
        max = Math.max(max, Math.min(w, 420));
      }
      widths.push(max);
    }
    return widths;
  }

  private cellDisplayText(cell: any): string {
    if (cell.value != null && cell.value !== '') return String(cell.value);
    if (cell.formula) return String(cell.formula);
    return '';
  }

  private measureTextWidth(text: string, style?: { fontSize?: string; fontFamily?: string; fontWeight?: string }): number {
    const ctx = this.ensureTextCtx();
    if (!ctx) return text.length * 8;
    const pt = parseFontPt(style?.fontSize);
    const px = pt * (96 / 72);
    const weight =
      style?.fontWeight === 'bold' || style?.fontWeight === '700' ? '700' : '400';
    const family = style?.fontFamily || 'Calibri, Arial, sans-serif';
    ctx.font = `${weight} ${px}px ${family}`;
    return ctx.measureText(text).width;
  }

  private ensureTextCtx(): CanvasRenderingContext2D | null {
    if (this.textCtx) return this.textCtx;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    this.textCtx = canvas.getContext('2d');
    return this.textCtx;
  }

  private applyColumnWidths(startCol: number, widths: number[]): void {
    const sheet = this.ss.getActiveSheet() as any;
    if (!Array.isArray(sheet.columns)) sheet.columns = [];
    widths.forEach((width, i) => {
      const idx = startCol + i;
      if (!sheet.columns[idx]) sheet.columns[idx] = {};
      sheet.columns[idx].width = width;
      sheet.columns[idx].customWidth = true;
      try {
        this.ss.setColWidth(width, idx, this.ss.activeSheetIndex);
      } catch {
        /* model already has the width */
      }
    });
    this.refreshQuiet();
  }

  private refreshQuiet(): void {
    try {
      (this.ss as any).dataBind?.();
    } catch {
      /* ignore */
    }
    try {
      (this.ss as any).refresh?.();
    } catch {
      /* ignore */
    }
  }

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

/** Syncfusion cellFormat calls `.split` on style strings; a numeric fontSize poisons later merge(). */
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

function normalizeChartType(type: string): string {
  const key = type.replace(/[_\s-]/g, '').toLowerCase();
  const map: Record<string, string> = {
    line: 'Line',
    column: 'Column',
    bar: 'Bar',
    area: 'Area',
    pie: 'Pie',
    doughnut: 'Doughnut',
    scatter: 'Scatter',
    stackedcolumn: 'StackingColumn',
    stackedbar: 'StackingBar',
    stackingcolumn: 'StackingColumn',
    stackingbar: 'StackingBar',
  };
  return map[key] ?? type;
}

function normalizeFontSize(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}pt`;
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}pt`;
  return s;
}

function parseFontPt(fontSize?: string): number {
  if (!fontSize) return 11;
  const n = parseFloat(fontSize);
  if (!Number.isFinite(n)) return 11;
  return String(fontSize).toLowerCase().includes('px') ? n * 0.75 : n;
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
