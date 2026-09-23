/**
 * Base path the app is served under. Must stay in sync with `basePath` in
 * next.config.js. Next prefixes this automatically for `next/link`, the router
 * and `next/image`, but NOT for `fetch`, so client-side requests to our own API
 * routes must go through `apiUrl()`.
 */
export const BASE_PATH = '/spreadsheet';

/** Build a same-origin URL to one of our API routes, honoring the base path. */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${suffix}`;
}
