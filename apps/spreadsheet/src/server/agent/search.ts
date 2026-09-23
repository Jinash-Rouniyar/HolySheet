import 'server-only';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  answer?: string;
  results: WebSearchResult[];
  provider: 'tavily' | 'exa';
}

/**
 * Single web-search tool backing. Tavily is primary, Exa is the fallback; the
 * standalone "Deep Search" feature and Perplexity are gone — the agent decides
 * when to research as part of its normal tool use.
 */
export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<WebSearchResponse> {
  const preferred = (process.env.WEB_SEARCH_PROVIDER ?? 'tavily').toLowerCase();
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  const hasExa = Boolean(process.env.EXA_API_KEY);

  if (preferred === 'exa' && hasExa) return exaSearch(query, maxResults);
  if (preferred === 'tavily' && hasTavily) return tavilySearch(query, maxResults);
  if (hasTavily) return tavilySearch(query, maxResults);
  if (hasExa) return exaSearch(query, maxResults);
  throw new Error(
    'No web search provider configured. Set TAVILY_API_KEY or EXA_API_KEY.',
  );
}

async function tavilySearch(
  query: string,
  maxResults: number,
): Promise<WebSearchResponse> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      include_answer: true,
      search_depth: 'advanced',
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return {
    answer: data.answer,
    provider: 'tavily',
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    })),
  };
}

async function exaSearch(
  query: string,
  maxResults: number,
): Promise<WebSearchResponse> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.EXA_API_KEY ?? '',
    },
    body: JSON.stringify({
      query,
      numResults: maxResults,
      contents: { text: { maxCharacters: 1200 } },
    }),
  });
  if (!res.ok) {
    throw new Error(`Exa error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; text?: string }>;
  };
  return {
    provider: 'exa',
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: (r.text ?? '').slice(0, 1200),
    })),
  };
}
