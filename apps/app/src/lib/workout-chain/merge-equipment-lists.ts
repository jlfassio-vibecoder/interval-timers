/**
 * Pure helpers for Workout Factory equipment resolution (prepare + tests).
 */

/** Split comma-separated labels; trim; drop empties. */
export function parseCommaSeparatedEquipmentLabels(raw: string | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Merge extras into base, deduping case-insensitively (first occurrence wins). */
export function mergeEquipmentDedupe(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...base, ...extra]) {
    const t = n.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function isBodyweightOnlyEquipment(names: string[]): boolean {
  return names.length === 1 && names[0].trim().toLowerCase() === 'bodyweight';
}
