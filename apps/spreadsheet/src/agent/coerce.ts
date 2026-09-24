/** Models stringify grids, use single quotes, or send a 1D/object shape. */

export function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  let current: unknown = trimmed;
  for (let depth = 0; depth < 3; depth++) {
    if (typeof current !== 'string') return current;
    const parsed = tryParseJson(current);
    if (parsed === undefined) return current;
    current = parsed;
  }
  return current;
}

function tryParseJson(raw: string): unknown | undefined {
  const attempts = [
    raw,
    raw.replace(/\]+$/, ']'),
    raw.replace(/,(\s*[\]}])/g, '$1'),
    raw.replace(/'/g, '"'),
  ];
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next */
    }
  }
  return undefined;
}

export function coerceCells(raw: unknown): Record<string, unknown> | null {
  const value = parseJsonIfString(raw);
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: Record<string, unknown> = {};
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2) {
      out[String(item[0])] = item[1];
      continue;
    }
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const addr = rec.address ?? rec.cell ?? rec.addr ?? rec.a1;
      if (addr) out[String(addr)] = rec.value ?? rec.val ?? rec.formula ?? '';
    }
  }
  return Object.keys(out).length ? out : null;
}

export function coerceValuesGrid(raw: unknown): unknown[][] | null {
  const value = parseJsonIfString(raw);
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (keys.length === 0) return null;
    if (keys.every((k) => /^\d+$/.test(k))) {
      return coerceValuesGrid(keys.sort((a, b) => Number(a) - Number(b)).map((k) => rec[k]));
    }
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.every((row) => Array.isArray(row))) return value as unknown[][];
  if (value.every((row) => row == null || typeof row !== 'object')) return [value];
  return value.map((row) => (Array.isArray(row) ? row : [row]));
}

export function describeArg(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === 'string') {
    const head = value.slice(0, 80).replace(/\s+/g, ' ');
    return `string(len=${value.length}, head=${JSON.stringify(head)})`;
  }
  if (Array.isArray(value)) {
    const row0 = value[0];
    const rowKind = Array.isArray(row0) ? `array(len=${row0.length})` : typeof row0;
    return `array(len=${value.length}, row0=${rowKind})`;
  }
  if (typeof value === 'object') {
    return `object(keys=${Object.keys(value as object).slice(0, 8).join(',')})`;
  }
  return typeof value;
}
