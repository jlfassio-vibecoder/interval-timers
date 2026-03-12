/**
 * Append query params to a path, merging with any existing params.
 */
export function appendQuery(path: string, params: Record<string, string>): string {
  const [base, existing] = path.split('?');
  const search = new URLSearchParams(existing ?? '');
  for (const [k, v] of Object.entries(params)) {
    search.set(k, v);
  }
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}
