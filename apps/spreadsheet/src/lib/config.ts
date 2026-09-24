/** Must match `basePath` in next.config.js. Next does not prefix `fetch`. */
export const BASE_PATH = '/spreadsheet';

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${suffix}`;
}
