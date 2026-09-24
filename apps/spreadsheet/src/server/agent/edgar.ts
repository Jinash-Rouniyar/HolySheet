import 'server-only';

/** Official EDGAR client. Returns compact cited tables, never raw companyfacts. */

const TICKERS_TXT_URL = 'https://www.sec.gov/include/ticker.txt';
const TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const TICKERS_FALLBACK_URL = 'https://www.sec.gov/files/company_tickers.json';
const BROWSE_ATOM =
  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&owner=exclude&count=1&output=atom';
const DATA = 'https://data.sec.gov';
const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
const EFTS = 'https://efts.sec.gov/LATEST/search-index';

const TICKERS_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 130; // ~8 req/s
const EXCERPT_CAP = 12_000;
const COMPS_CAP = 15;
const INSIDER_DOC_CAP = 8;

export interface SecEntity {
  cik: string;
  ticker: string;
  name: string;
  exchange?: string;
}

export interface SecFiling {
  form: string;
  filed: string;
  period?: string;
  accession: string;
  items?: string;
  primaryDocument?: string;
  url: string;
}

export interface SecFactPoint {
  fy?: number;
  fp?: string;
  end: string;
  form: string;
  filed: string;
  accn: string;
  val: number;
}

export interface SecFinancialRow {
  line: string;
  tag: string;
  unit: string;
  values: Record<string, number>;
}

export interface SecFinancials {
  entity: SecEntity;
  statement: StatementKind;
  period: PeriodKind;
  columns: string[];
  rows: SecFinancialRow[];
  unmappedHints: string[];
  provenance: { form: string; note: string };
}

export interface SecConceptSeries {
  entity: SecEntity;
  taxonomy: string;
  tag: string;
  label?: string;
  unit: string;
  points: SecFactPoint[];
}

export interface SecCompRow {
  cik: string;
  ticker?: string;
  name?: string;
  val: number;
  end?: string;
  accn?: string;
}

export interface SecFilingHit {
  form?: string;
  filed?: string;
  entity?: string;
  accession?: string;
  items?: string;
  url?: string;
  snippet?: string;
}

export interface SecInsiderRow {
  filed: string;
  accession: string;
  insider?: string;
  role?: string;
  date?: string;
  code?: string;
  shares?: number;
  price?: number;
  remaining?: number;
  acquiredDisposed?: string;
  url: string;
}

export type StatementKind = 'income' | 'balance' | 'cashflow' | 'metrics';
export type PeriodKind = 'annual' | 'quarterly';

interface XbrlFact {
  end?: string;
  start?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
}

interface CompanyFacts {
  cik?: number | string;
  entityName?: string;
  facts?: Record<
    string,
    Record<
      string,
      {
        label?: string;
        description?: string;
        units?: Record<string, XbrlFact[]>;
      }
    >
  >;
}

interface Submissions {
  cik?: string;
  name?: string;
  tickers?: string[];
  exchanges?: string[];
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      items?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
}

interface TickerRow {
  cik: string;
  ticker: string;
  name: string;
  exchange?: string;
}

// First listed tag the issuer reported wins.


const STATEMENT_LINES: Record<StatementKind, Array<{ line: string; tags: string[] }>> = {
  income: [
    {
      line: 'Revenue',
      tags: [
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'Revenues',
        'SalesRevenueNet',
        'RevenueFromContractWithCustomerIncludingAssessedTax',
        'SalesRevenueGoodsNet',
      ],
    },
    { line: 'Cost of revenue', tags: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'] },
    { line: 'Gross profit', tags: ['GrossProfit'] },
    { line: 'Research and development', tags: ['ResearchAndDevelopmentExpense'] },
    {
      line: 'SG&A',
      tags: [
        'SellingGeneralAndAdministrativeExpense',
        'SellingAndMarketingExpense',
        'GeneralAndAdministrativeExpense',
      ],
    },
    { line: 'Operating expenses', tags: ['OperatingExpenses'] },
    { line: 'Operating income', tags: ['OperatingIncomeLoss'] },
    { line: 'Interest expense', tags: ['InterestExpense'] },
    { line: 'Interest income', tags: ['InvestmentIncomeInterest', 'InterestIncomeOther'] },
    { line: 'Other income / expense', tags: ['NonoperatingIncomeExpense', 'OtherNonoperatingIncomeExpense'] },
    {
      line: 'Pretax income',
      tags: [
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxes',
      ],
    },
    { line: 'Income tax', tags: ['IncomeTaxExpenseBenefit'] },
    {
      line: 'Net income',
      tags: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
    },
    { line: 'EPS basic', tags: ['EarningsPerShareBasic'] },
    { line: 'EPS diluted', tags: ['EarningsPerShareDiluted'] },
    { line: 'Shares basic', tags: ['WeightedAverageNumberOfSharesOutstandingBasic'] },
    { line: 'Shares diluted', tags: ['WeightedAverageNumberOfDilutedSharesOutstanding'] },
  ],
  balance: [
    {
      line: 'Cash and equivalents',
      tags: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments'],
    },
    { line: 'Short-term investments', tags: ['ShortTermInvestments', 'MarketableSecuritiesCurrent'] },
    { line: 'Accounts receivable', tags: ['AccountsReceivableNetCurrent'] },
    { line: 'Inventory', tags: ['InventoryNet'] },
    { line: 'Current assets', tags: ['AssetsCurrent'] },
    { line: 'PP&E net', tags: ['PropertyPlantAndEquipmentNet'] },
    { line: 'Goodwill', tags: ['Goodwill'] },
    { line: 'Intangibles', tags: ['IntangibleAssetsNetExcludingGoodwill'] },
    { line: 'Total assets', tags: ['Assets'] },
    { line: 'Accounts payable', tags: ['AccountsPayableCurrent'] },
    { line: 'Short-term debt', tags: ['ShortTermBorrowings', 'CommercialPaper', 'LongTermDebtCurrent'] },
    { line: 'Current liabilities', tags: ['LiabilitiesCurrent'] },
    { line: 'Long-term debt', tags: ['LongTermDebtNoncurrent', 'LongTermDebt'] },
    { line: 'Total liabilities', tags: ['Liabilities'] },
    {
      line: 'Common stock',
      tags: ['CommonStocksIncludingAdditionalPaidInCapital', 'CommonStockValue'],
    },
    { line: 'Retained earnings', tags: ['RetainedEarningsAccumulatedDeficit'] },
    {
      line: 'Stockholders equity',
      tags: [
        'StockholdersEquity',
        'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
      ],
    },
    { line: 'Shares outstanding', tags: ['CommonStockSharesOutstanding', 'EntityCommonStockSharesOutstanding'] },
  ],
  cashflow: [
    { line: 'Net income', tags: ['NetIncomeLoss', 'ProfitLoss'] },
    {
      line: 'Depreciation and amortization',
      tags: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization'],
    },
    { line: 'Stock-based compensation', tags: ['ShareBasedCompensation'] },
    { line: 'Operating cash flow', tags: ['NetCashProvidedByUsedInOperatingActivities'] },
    { line: 'Capex', tags: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
    { line: 'Acquisitions', tags: ['PaymentsToAcquireBusinessesNetOfCashAcquired'] },
    { line: 'Investing cash flow', tags: ['NetCashProvidedByUsedInInvestingActivities'] },
    { line: 'Dividends', tags: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'] },
    { line: 'Share repurchases', tags: ['PaymentsForRepurchaseOfCommonStock'] },
    { line: 'Debt issued', tags: ['ProceedsFromIssuanceOfLongTermDebt'] },
    { line: 'Debt repaid', tags: ['RepaymentsOfLongTermDebt'] },
    { line: 'Financing cash flow', tags: ['NetCashProvidedByUsedInFinancingActivities'] },
  ],
  metrics: [
    { line: 'Revenue', tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'] },
    { line: 'Operating income', tags: ['OperatingIncomeLoss'] },
    { line: 'Net income', tags: ['NetIncomeLoss', 'ProfitLoss'] },
    { line: 'EPS diluted', tags: ['EarningsPerShareDiluted'] },
    { line: 'EPS basic', tags: ['EarningsPerShareBasic'] },
    { line: 'Shares diluted', tags: ['WeightedAverageNumberOfDilutedSharesOutstanding'] },
    { line: 'Shares outstanding', tags: ['CommonStockSharesOutstanding', 'EntityCommonStockSharesOutstanding'] },
    {
      line: 'Book value',
      tags: [
        'StockholdersEquity',
        'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
      ],
    },
    { line: 'Operating cash flow', tags: ['NetCashProvidedByUsedInOperatingActivities'] },
    { line: 'Capex', tags: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
  ],
};

export function requireSecUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT?.trim();
  if (!ua) {
    throw new Error(
      'SEC_USER_AGENT is not set. SEC blocks anonymous clients — add e.g. SEC_USER_AGENT="Celina/1.0 you@domain" to .env',
    );
  }
  return ua;
}

let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  chain = run.catch(() => undefined);
  return run;
}

async function edgarGet(url: string, accept = 'application/json'): Promise<Response> {
  const ua = requireSecUserAgent();
  await throttle();
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': ua,
        Accept: accept,
        'Accept-Encoding': 'gzip, deflate',
      },
    });
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`SEC ${res.status} for ${url}`);
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 403) {
        throw new Error(
          `SEC 403 for ${url}. Check SEC_USER_AGENT — use a name plus a real contact email (not noreply), e.g. "HolySheet Celina 1.0 you@yourdomain.com".`,
        );
      }
      throw new Error(`SEC ${res.status} for ${url}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    return res;
  }
  throw lastErr ?? new Error(`SEC request failed: ${url}`);
}

async function edgarJson<T>(url: string): Promise<T> {
  const res = await edgarGet(url, 'application/json');
  return (await res.json()) as T;
}

async function edgarText(url: string, accept: string): Promise<string> {
  const res = await edgarGet(url, accept);
  return res.text();
}

let tickersCache: { rows: TickerRow[]; expires: number } | null = null;
const submissionsCache = new Map<string, Submissions>();
const factsCache = new Map<string, CompanyFacts>();

export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

function bareCik(cik: string): string {
  return String(Number(padCik(cik)));
}

function accessionPath(accn: string): string {
  return accn.replace(/-/g, '');
}

function filingUrl(cik: string, accn: string, primary?: string): string {
  const base = `${ARCHIVES}/${bareCik(cik)}/${accessionPath(accn)}`;
  return primary ? `${base}/${primary}` : `${base}/${accn}-index.html`;
}

async function loadTickers(): Promise<TickerRow[]> {
  if (tickersCache && Date.now() < tickersCache.expires) return tickersCache.rows;
  const rows = (await loadTickersTxt()) ?? (await loadTickersExchange()) ?? (await loadTickersJson());
  if (!rows.length) throw new Error('Could not load the SEC ticker list.');
  tickersCache = { rows, expires: Date.now() + TICKERS_TTL_MS };
  return rows;
}

async function loadTickersTxt(): Promise<TickerRow[] | null> {
  try {
    const text = await edgarText(TICKERS_TXT_URL, 'text/plain');
    const rows: TickerRow[] = [];
    for (const line of text.split(/\r?\n/)) {
      const [ticker, cik] = line.split(/\t+/);
      if (!ticker || !cik) continue;
      rows.push({ cik: padCik(cik), ticker: ticker.trim().toUpperCase(), name: '' });
    }
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

async function loadTickersExchange(): Promise<TickerRow[] | null> {
  try {
    const data = await edgarJson<{
      fields?: string[];
      data?: Array<Array<string | number>>;
    }>(TICKERS_URL);
    const fields = (data.fields ?? []).map((f) => f.toLowerCase());
    const iCik = fields.indexOf('cik');
    const iName = fields.indexOf('name');
    const iTicker = fields.indexOf('ticker');
    const iEx = fields.indexOf('exchange');
    return (data.data ?? []).map((row) => ({
      cik: padCik(row[iCik < 0 ? 0 : iCik] ?? ''),
      name: String(row[iName < 0 ? 1 : iName] ?? ''),
      ticker: String(row[iTicker < 0 ? 2 : iTicker] ?? '').toUpperCase(),
      exchange: iEx >= 0 ? String(row[iEx] ?? '') : undefined,
    }));
  } catch {
    return null;
  }
}

async function loadTickersJson(): Promise<TickerRow[]> {
  const raw = await edgarJson<Record<string, { cik_str?: number; ticker?: string; title?: string }>>(
    TICKERS_FALLBACK_URL,
  );
  return Object.values(raw).map((r) => ({
    cik: padCik(r.cik_str ?? ''),
    ticker: (r.ticker ?? '').toUpperCase(),
    name: r.title ?? '',
  }));
}

async function lookupViaBrowse(query: string): Promise<SecEntity | null> {
  try {
    const url = `${BROWSE_ATOM}&CIK=${encodeURIComponent(query)}`;
    const xml = await edgarText(url, 'application/atom+xml, text/xml');
    const cik = xml.match(/<cik>\s*(\d+)\s*<\/cik>/i)?.[1];
    if (!cik) return null;
    const name = xml.match(/<conformed-name>\s*([^<]+)\s*<\/conformed-name>/i)?.[1]?.trim();
    const tickerGuess = /^[A-Z.-]{1,8}$/i.test(query.trim()) ? query.trim().toUpperCase() : '';
    return { cik: padCik(cik), ticker: tickerGuess, name: name || `CIK ${padCik(cik)}` };
  } catch {
    return null;
  }
}

export async function secLookup(query: string): Promise<{ match: SecEntity; alternatives: SecEntity[] }> {
  const q = query.trim();
  if (!q) throw new Error('Lookup query is required.');

  const asCik = /^\d{1,10}$/.test(q) || /^CIK\d+$/i.test(q);
  if (asCik) {
    const cik = padCik(q.replace(/^CIK/i, ''));
    try {
      const rows = await loadTickers();
      const hit = rows.find((r) => r.cik === cik);
      if (hit) {
        const match = toEntity(hit);
        if (!match.name) {
          const atom = await lookupViaBrowse(cik);
          if (atom?.name) match.name = atom.name;
        }
        return { match, alternatives: [] };
      }
    } catch {
      /* browse fallback */
    }
    const atom = await lookupViaBrowse(cik);
    return { match: atom ?? { cik, ticker: '', name: `CIK ${cik}` }, alternatives: [] };
  }

  try {
    const rows = await loadTickers();
    const upper = q.toUpperCase();
    const exact = rows.filter((r) => r.ticker === upper);
    if (exact.length) {
      const match = toEntity(exact[0]);
      if (!match.name) {
        const atom = await lookupViaBrowse(match.cik);
        if (atom?.name) match.name = atom.name;
        if (atom?.exchange) match.exchange = atom.exchange;
      }
      return { match, alternatives: exact.slice(1, 5).map(toEntity) };
    }
    const lower = q.toLowerCase();
    const named = rows.filter(
      (r) => (r.name && r.name.toLowerCase().includes(lower)) || r.ticker.includes(upper),
    );
    if (named.length && named[0].name) {
      return { match: toEntity(named[0]), alternatives: named.slice(1, 5).map(toEntity) };
    }
  } catch {
    /* browse fallback */
  }

  const atom = await lookupViaBrowse(q);
  if (atom) return { match: atom, alternatives: [] };
  const efts = await lookupViaEfts(q);
  if (efts) return { match: efts, alternatives: [] };
  throw new Error(`No SEC issuer matched "${query}".`);
}

async function lookupViaEfts(query: string): Promise<SecEntity | null> {
  try {
    const params = new URLSearchParams({ q: query, dateRange: 'all' });
    const data = await edgarJson<{
      hits?: { hits?: Array<{ _source?: { display_names?: string[] } }> };
    }>(`${EFTS}?${params.toString()}`);
    const names = data.hits?.hits?.[0]?._source?.display_names?.[0] ?? '';
    const cik = names.match(/CIK\s*(\d+)/i)?.[1];
    if (!cik) return null;
    const ticker = names.match(/\(([A-Z][A-Z0-9.-]{0,7})\)/)?.[1];
    const name = names.split('(')[0]?.trim();
    return { cik: padCik(cik), ticker: ticker ?? '', name: name || `CIK ${padCik(cik)}` };
  } catch {
    return null;
  }
}

function toEntity(row: TickerRow): SecEntity {
  return { cik: row.cik, ticker: row.ticker, name: row.name, exchange: row.exchange };
}

async function resolveEntity(tickerOrCik: string): Promise<SecEntity> {
  const { match } = await secLookup(tickerOrCik);
  return match;
}

async function loadSubmissions(cik: string): Promise<Submissions> {
  const key = padCik(cik);
  const hit = submissionsCache.get(key);
  if (hit) return hit;
  const data = await edgarJson<Submissions>(`${DATA}/submissions/CIK${key}.json`);
  submissionsCache.set(key, data);
  return data;
}

export async function secFilings(opts: {
  tickerOrCik: string;
  forms?: string[];
  limit?: number;
  since?: string;
  until?: string;
}): Promise<{ entity: SecEntity; filings: SecFiling[] }> {
  const entity = await resolveEntity(opts.tickerOrCik);
  const sub = await loadSubmissions(entity.cik);
  if (!entity.name && sub.name) entity.name = sub.name;
  if (!entity.ticker && sub.tickers?.[0]) entity.ticker = sub.tickers[0];
  if (!entity.exchange && sub.exchanges?.[0]) entity.exchange = sub.exchanges[0];

  const recent = sub.filings?.recent;
  const n = recent?.accessionNumber?.length ?? 0;
  const wanted = (opts.forms ?? []).map((f) => f.toUpperCase());
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const filings: SecFiling[] = [];

  for (let i = 0; i < n && filings.length < limit; i++) {
    const form = recent?.form?.[i] ?? '';
    const filed = recent?.filingDate?.[i] ?? '';
    if (wanted.length && !wanted.includes(form.toUpperCase())) continue;
    if (opts.since && filed && filed < opts.since) continue;
    if (opts.until && filed && filed > opts.until) continue;
    const accn = recent?.accessionNumber?.[i] ?? '';
    const primary = recent?.primaryDocument?.[i];
    filings.push({
      form,
      filed,
      period: recent?.reportDate?.[i] || undefined,
      accession: accn,
      items: recent?.items?.[i] || undefined,
      primaryDocument: primary,
      url: filingUrl(entity.cik, accn, primary),
    });
  }

  return { entity: enrichEntity(entity, sub), filings };
}

function enrichEntity(entity: SecEntity, sub: Submissions): SecEntity {
  return {
    cik: padCik(entity.cik || sub.cik || ''),
    ticker: entity.ticker || sub.tickers?.[0] || '',
    name: entity.name || sub.name || '',
    exchange: entity.exchange || sub.exchanges?.[0],
  };
}

async function loadFacts(cik: string): Promise<CompanyFacts> {
  const key = padCik(cik);
  const hit = factsCache.get(key);
  if (hit) return hit;
  const data = await edgarJson<CompanyFacts>(`${DATA}/api/xbrl/companyfacts/CIK${key}.json`);
  factsCache.set(key, data);
  return data;
}

function findConcept(
  facts: CompanyFacts,
  tag: string,
): { taxonomy: string; tag: string; label?: string; units: Record<string, XbrlFact[]> } | null {
  const factsRoot = facts.facts ?? {};
  for (const taxonomy of ['us-gaap', 'ifrs-full', 'dei']) {
    const node = factsRoot[taxonomy]?.[tag];
    if (node?.units) return { taxonomy, tag, label: node.label, units: node.units };
  }
  for (const [taxonomy, tags] of Object.entries(factsRoot)) {
    if (tags[tag]?.units) return { taxonomy, tag, label: tags[tag].label, units: tags[tag].units };
  }
  return null;
}

function preferredUnit(units: Record<string, XbrlFact[]>): { unit: string; points: XbrlFact[] } {
  for (const unit of ['USD', 'USD/shares', 'shares', 'pure']) {
    if (units[unit]?.length) return { unit, points: units[unit] };
  }
  const first = Object.entries(units)[0];
  return first ? { unit: first[0], points: first[1] } : { unit: '', points: [] };
}

function isAmendment(form: string): boolean {
  return form.includes('/A');
}

function matchesPeriod(fact: XbrlFact, period: PeriodKind): boolean {
  const form = (fact.form ?? '').toUpperCase();
  const fp = (fact.fp ?? '').toUpperCase();
  if (isAmendment(form)) return false;
  if (period === 'annual') {
    if (form === '10-K' || form === '20-F' || form === '40-F') return fp === 'FY' || fp === '';
    return false;
  }
  if (form === '10-Q' || form === '6-K') return /^Q[1-3]$/.test(fp);
  return false;
}

function periodKey(fact: XbrlFact, period: PeriodKind): string {
  if (period === 'annual') return String(fact.fy ?? (fact.end ?? '').slice(0, 4));
  const fy = fact.fy ?? (fact.end ?? '').slice(0, 4);
  return `${fy}${fact.fp ? ` ${fact.fp}` : ''}`;
}

function pickSeries(points: XbrlFact[], period: PeriodKind, years: number): XbrlFact[] {
  const eligible = points.filter(
    (p) => typeof p.val === 'number' && p.end && matchesPeriod(p, period),
  );
  const best = new Map<string, XbrlFact>();
  for (const p of eligible) {
    const key = periodKey(p, period);
    const prev = best.get(key);
    if (!prev || (p.filed ?? '') > (prev.filed ?? '') || (p.end ?? '') > (prev.end ?? '')) {
      best.set(key, p);
    }
  }
  return [...best.values()]
    .sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''))
    .slice(0, years);
}

export async function secFinancials(opts: {
  tickerOrCik: string;
  statement: StatementKind;
  period: PeriodKind;
  years?: number;
}): Promise<SecFinancials> {
  const entity = await resolveEntity(opts.tickerOrCik);
  const facts = await loadFacts(entity.cik);
  if (facts.entityName) entity.name = entity.name || facts.entityName;
  const years = Math.min(Math.max(opts.years ?? 5, 1), 15);
  const lines = STATEMENT_LINES[opts.statement];
  const usedTags = new Set<string>();
  const rows: SecFinancialRow[] = [];
  const columnSet = new Set<string>();

  for (const { line, tags } of lines) {
    let chosen: { tag: string; unit: string; series: XbrlFact[] } | null = null;
    for (const tag of tags) {
      const concept = findConcept(facts, tag);
      if (!concept) continue;
      const { unit, points } = preferredUnit(concept.units);
      const series = pickSeries(points, opts.period, years);
      if (!series.length) continue;
      chosen = { tag, unit, series };
      break;
    }
    if (!chosen) continue;
    usedTags.add(chosen.tag);
    const values: Record<string, number> = {};
    for (const p of chosen.series) {
      const key = periodKey(p, opts.period);
      values[key] = p.val as number;
      columnSet.add(key);
    }
    rows.push({ line, tag: chosen.tag, unit: chosen.unit, values });
  }

  const columns = [...columnSet].sort((a, b) => b.localeCompare(a)).slice(0, years);
  for (const row of rows) {
    for (const key of Object.keys(row.values)) {
      if (!columns.includes(key)) delete row.values[key];
    }
  }
  const mapped = new Set(lines.flatMap((l) => l.tags));
  const unmappedHints = listUnmappedHints(facts, mapped, usedTags);

  return {
    entity,
    statement: opts.statement,
    period: opts.period,
    columns,
    rows,
    unmappedHints,
    provenance: {
      form: opts.period === 'annual' ? '10-K' : '10-Q',
      note: 'latest non-amendment 10-K (annual) or 10-Q (quarterly); 20-F/6-K accepted as fallback',
    },
  };
}

function listUnmappedHints(
  facts: CompanyFacts,
  mapped: Set<string>,
  used: Set<string>,
): string[] {
  const hints: string[] = [];
  for (const taxonomy of ['us-gaap', 'ifrs-full']) {
    const tags = facts.facts?.[taxonomy] ?? {};
    for (const tag of Object.keys(tags)) {
      if (mapped.has(tag) || used.has(tag)) continue;
      if (/Revenue|Income|Asset|Liabilit|Cash|Equity|Debt|Share/i.test(tag)) {
        hints.push(`${taxonomy}:${tag}`);
      }
      if (hints.length >= 12) return hints;
    }
  }
  return hints;
}

export async function secConcept(opts: {
  tickerOrCik: string;
  tag?: string;
  search?: string;
}): Promise<
  | SecConceptSeries
  | { entity: SecEntity; matches: Array<{ taxonomy: string; tag: string; label?: string }> }
> {
  const entity = await resolveEntity(opts.tickerOrCik);
  const facts = await loadFacts(entity.cik);
  if (facts.entityName) entity.name = entity.name || facts.entityName;

  if (opts.search && !opts.tag) {
    const q = opts.search.toLowerCase();
    const matches: Array<{ taxonomy: string; tag: string; label?: string }> = [];
    for (const [taxonomy, tags] of Object.entries(facts.facts ?? {})) {
      for (const [tag, node] of Object.entries(tags)) {
        const label = node.label ?? '';
        if (tag.toLowerCase().includes(q) || label.toLowerCase().includes(q)) {
          matches.push({ taxonomy, tag, label });
        }
        if (matches.length >= 20) break;
      }
      if (matches.length >= 20) break;
    }
    return { entity, matches };
  }

  const tag = opts.tag?.replace(/^(us-gaap|ifrs-full|dei):/i, '');
  if (!tag) throw new Error('sec_concept requires `tag` or `search`.');
  const concept = findConcept(facts, tag);
  if (!concept) throw new Error(`Tag ${tag} not reported by ${entity.ticker || entity.cik}.`);
  const { unit, points } = preferredUnit(concept.units);
  const series = points
    .filter((p) => typeof p.val === 'number' && p.end && !isAmendment(p.form ?? ''))
    .sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''))
    .slice(0, 24)
    .map(
      (p): SecFactPoint => ({
        fy: p.fy,
        fp: p.fp,
        end: p.end ?? '',
        form: p.form ?? '',
        filed: p.filed ?? '',
        accn: p.accn ?? '',
        val: p.val as number,
      }),
    );
  return {
    entity,
    taxonomy: concept.taxonomy,
    tag: concept.tag,
    label: concept.label,
    unit,
    points: series,
  };
}

function parseFramePeriod(period: string): { duration: string; instant: string } {
  const raw = period.trim().toUpperCase().replace(/\s+/g, '');
  const fy = raw.match(/^(?:FY|CY)?(\d{4})$/);
  if (fy) return { duration: `CY${fy[1]}`, instant: `CY${fy[1]}Q4I` };
  const q = raw.match(/^(?:CY)?(\d{4})Q([1-4])I?$/);
  if (q) return { duration: `CY${q[1]}Q${q[2]}`, instant: `CY${q[1]}Q${q[2]}I` };
  if (/^CY\d{4}(Q[1-4])?I?$/.test(raw)) {
    return { duration: raw.replace(/I$/, ''), instant: raw.endsWith('I') ? raw : `${raw}I` };
  }
  throw new Error(`Unrecognized period "${period}". Use FY2023, 2023Q2, or CY2023Q4I.`);
}

export async function secComps(opts: {
  tag: string;
  period: string;
  tickers: string[];
}): Promise<{ tag: string; period: string; unit: string; rows: SecCompRow[] }> {
  const tickers = opts.tickers.slice(0, COMPS_CAP);
  if (!tickers.length) throw new Error('sec_comps requires at least one ticker.');
  const tag = opts.tag.replace(/^(us-gaap|ifrs-full|dei):/i, '');
  const frames = parseFramePeriod(opts.period);
  const entities = await Promise.all(tickers.map((t) => resolveEntity(t).catch(() => null)));
  const cikSet = new Set(entities.filter(Boolean).map((e) => padCik(e!.cik)));

  const tryFrame = async (period: string, unit: string) => {
    const url = `${DATA}/api/xbrl/frames/us-gaap/${tag}/${unit}/${period}.json`;
    return edgarJson<{
      uom?: string;
      data?: Array<{ cik?: number; entityName?: string; val?: number; end?: string; accn?: string }>;
    }>(url);
  };

  let frame: Awaited<ReturnType<typeof tryFrame>> | null = null;
  let unit = 'USD';
  for (const p of [frames.duration, frames.instant]) {
    for (const u of ['USD', 'USD/shares', 'shares']) {
      try {
        frame = await tryFrame(p, u);
        unit = frame.uom ?? u;
        break;
      } catch {
        /* try next */
      }
    }
    if (frame) break;
  }

  if (!frame?.data) {
    // Frames miss some issuers; companyfacts is slower but complete.
    const rows: SecCompRow[] = [];
    for (const ent of entities) {
      if (!ent) continue;
      try {
        const series = await secConcept({ tickerOrCik: ent.cik, tag });
        if ('points' in series && series.points[0]) {
          rows.push({
            cik: ent.cik,
            ticker: ent.ticker,
            name: ent.name,
            val: series.points[0].val,
            end: series.points[0].end,
            accn: series.points[0].accn,
          });
        }
      } catch {
        /* skip issuer */
      }
    }
    return { tag, period: opts.period, unit, rows };
  }

  const byCik = new Map(entities.filter(Boolean).map((e) => [padCik(e!.cik), e!]));
  const rows: SecCompRow[] = [];
  for (const row of frame.data) {
    const cik = padCik(row.cik ?? '');
    if (!cikSet.has(cik)) continue;
    const ent = byCik.get(cik);
    rows.push({
      cik,
      ticker: ent?.ticker,
      name: ent?.name ?? row.entityName,
      val: row.val ?? 0,
      end: row.end,
      accn: row.accn,
    });
  }
  return { tag, period: opts.period, unit, rows };
}

export async function secFilingText(opts: {
  tickerOrCik?: string;
  query?: string;
  accession?: string;
  forms?: string[];
}): Promise<{ entity?: SecEntity; hits: SecFilingHit[]; excerpt?: string; url?: string }> {
  if (opts.accession) {
    const entity = opts.tickerOrCik ? await resolveEntity(opts.tickerOrCik) : undefined;
    const accn = opts.accession;
    let url: string | undefined;
    if (entity) {
      const listed = await secFilings({ tickerOrCik: entity.cik, limit: 80 });
      const hit = listed.filings.find((f) => f.accession === accn);
      url = hit?.url;
    }
    if (!url && entity) url = filingUrl(entity.cik, accn);
    if (!url) throw new Error('Provide ticker/cik with accession so the document URL can be built.');
    let excerpt: string | undefined;
    try {
      excerpt = await excerptUrl(url, opts.query);
    } catch {
      /* URL still useful if the document body is blocked */
    }
    return {
      entity,
      hits: [{ accession: accn, url, snippet: excerpt?.slice(0, 280) }],
      excerpt,
      url,
    };
  }

  if (!opts.query) throw new Error('sec_filing_text requires `query` or `accession`.');
  const entity = opts.tickerOrCik ? await resolveEntity(opts.tickerOrCik) : undefined;
  const params = new URLSearchParams();
  // EFTS ANDs tokens; extra CIK digits often zero out hits.
  const qParts = [entity?.ticker || (entity?.cik ? String(Number(entity.cik)) : ''), opts.query]
    .map((s) => s?.trim())
    .filter(Boolean);
  params.set('q', qParts.join(' '));
  params.set('dateRange', 'all');
  if (opts.forms?.length) params.set('forms', opts.forms.join(','));

  const data = await edgarJson<{
    hits?: {
      hits?: Array<{
        _id?: string;
        _source?: {
          file_date?: string;
          display_names?: string[];
          file_type?: string;
          period_ending?: string;
          items?: string;
        };
      }>;
    };
  }>(`${EFTS}?${params.toString()}`);

  const hits: SecFilingHit[] = (data.hits?.hits ?? []).slice(0, 8).map((h) => {
    const id = h._id ?? '';
    const [accn, file] = id.split(':');
    const cikFromId = accn?.split('-')[0];
    const url =
      accn && cikFromId
        ? `${ARCHIVES}/${bareCik(cikFromId)}/${accessionPath(accn)}${file ? `/${file}` : ''}`
        : undefined;
    return {
      form: h._source?.file_type,
      filed: h._source?.file_date,
      entity: h._source?.display_names?.[0],
      accession: accn,
      items: h._source?.items,
      url,
    };
  });

  let excerpt: string | undefined;
  let url: string | undefined;
  const first = hits.find((h) => h.url);
  if (first?.url) {
    url = first.url;
    try {
      excerpt = await excerptUrl(first.url, opts.query);
      first.snippet = excerpt.slice(0, 280);
    } catch {
      /* keep the hit list even if the primary document is blocked */
    }
  }
  return { entity, hits, excerpt, url };
}

async function excerptUrl(url: string, query?: string): Promise<string> {
  const accept = url.match(/\.(xml|json)$/i) ? 'application/xml, text/plain' : 'text/html, text/plain';
  const raw = await edgarText(url, accept);
  const text = stripMarkup(raw);
  if (query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 400);
      return text.slice(start, start + EXCERPT_CAP);
    }
  }
  return text.slice(0, EXCERPT_CAP);
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function secInsiders(opts: {
  tickerOrCik: string;
  limit?: number;
}): Promise<{ entity: SecEntity; rows: SecInsiderRow[] }> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const { entity, filings } = await secFilings({
    tickerOrCik: opts.tickerOrCik,
    forms: ['4'],
    limit,
  });
  const rows: SecInsiderRow[] = [];
  const toFetch = filings.slice(0, INSIDER_DOC_CAP);
  for (const f of toFetch) {
    const { url, parsed } = await loadForm4(entity.cik, f);
    if (parsed.length) {
      for (const p of parsed) {
        rows.push({ ...p, filed: f.filed, accession: f.accession, url });
      }
    } else {
      rows.push({ filed: f.filed, accession: f.accession, url });
    }
    if (rows.length >= limit) break;
  }
  return { entity, rows: rows.slice(0, limit) };
}

function form4XmlCandidates(cik: string, filing: SecFiling): string[] {
  const primary = filing.primaryDocument ?? '';
  const file = primary.split('/').pop() ?? '';
  const urls = [
    file ? filingUrl(cik, filing.accession, file) : '',
    primary && primary !== file ? filingUrl(cik, filing.accession, primary) : '',
    filing.url,
  ];
  return [...new Set(urls.filter(Boolean))];
}

async function loadForm4(
  cik: string,
  filing: SecFiling,
): Promise<{ url: string; parsed: Array<Omit<SecInsiderRow, 'filed' | 'accession' | 'url'>> }> {
  for (const xmlUrl of form4XmlCandidates(cik, filing)) {
    try {
      const xml = await edgarText(xmlUrl, 'application/xml, text/xml, text/plain');
      if (/ownershipDocument|rptOwnerName/i.test(xml)) {
        return { url: xmlUrl, parsed: parseForm4(xml) };
      }
    } catch {
      /* try next candidate */
    }
  }
  return { url: filing.url, parsed: [] };
}

function xmlValue(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*(?:<value>)?([^<]+)`, 'i'));
  return m?.[1]?.trim();
}

function parseForm4(xml: string): Array<Omit<SecInsiderRow, 'filed' | 'accession' | 'url'>> {
  const insider = xmlValue(xml, 'rptOwnerName');
  const officer = xmlValue(xml, 'officerTitle');
  const isDir = xmlValue(xml, 'isDirector') === '1';
  const isOff = xmlValue(xml, 'isOfficer') === '1';
  const role = officer || (isOff ? 'Officer' : isDir ? 'Director' : undefined);

  const chunks = xml.split(/<nonDerivativeTransaction[\s>]/i).slice(1);
  const rows: Array<Omit<SecInsiderRow, 'filed' | 'accession' | 'url'>> = [];
  for (const chunk of chunks.slice(0, 6)) {
    const shares = Number(xmlValue(chunk, 'transactionShares'));
    const price = Number(xmlValue(chunk, 'transactionPricePerShare'));
    const remaining = Number(xmlValue(chunk, 'sharesOwnedFollowingTransaction'));
    rows.push({
      insider,
      role,
      date: xmlValue(chunk, 'transactionDate'),
      code: xmlValue(chunk, 'transactionCode'),
      shares: Number.isFinite(shares) ? shares : undefined,
      price: Number.isFinite(price) ? price : undefined,
      remaining: Number.isFinite(remaining) ? remaining : undefined,
      acquiredDisposed: xmlValue(chunk, 'transactionAcquiredDisposedCode'),
    });
  }
  if (!rows.length && insider) rows.push({ insider, role });
  return rows;
}
