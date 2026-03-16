/**
 * Parser for biomechanical points returned by the Gemini research model.
 * Converts the 5-point string array into structured data for the detail page.
 */

import type { ParsedBiomechanics, ExerciseSource } from '@/types/generated-exercise';

/** Number of items in the full biomechanical card: Chain, Pivot, Stabilization, Mistakes, Cues. Used to detect legacy/stored 5-point arrays vs plain performance-cues lists. */
export const FULL_BIOMECHANICS_CARD_LENGTH = 5;

/**
 * Extract content after the "Point N: Label - " prefix.
 */
function extractPointContent(point: string): string {
  const match = point.match(/^Point\s*\d+:\s*[^-]+-\s*(.*)$/i);
  if (match) return match[1].trim();
  const dashIndex = point.indexOf(' - ');
  if (dashIndex !== -1) return point.substring(dashIndex + 3).trim();
  return point;
}

/**
 * Parse a point that may contain multiple items (mistakes or cues).
 */
function parseMultipleItems(content: string): string[] {
  const bulletPatterns = [
    /(?:^|\n)\s*[•●◦▪-]\s*/g,
    /(?:^|\n)\s*\d+[.)]\s*/g,
    /(?:^|\n)\s*[a-z][.)]\s*/gi,
    /;\s*/g,
  ];
  for (const pattern of bulletPatterns) {
    const parts = content.split(pattern).filter((p) => p.trim());
    if (parts.length > 1) return parts.map((p) => p.trim());
  }
  const sentences = content.split(/\.\s+(?=[A-Z])/).filter((s) => s.trim());
  if (sentences.length > 1)
    return sentences.map((s) => (s.endsWith('.') ? s.trim() : s.trim() + '.'));
  return [content.trim()];
}

/**
 * Normalize list items for display. When a single element contains comma-separated
 * quoted phrases (e.g. "'A', 'B', and 'C'"), split into separate items.
 */
export function normalizeListItems(items: string[]): string[] {
  if (!items.length || items.length !== 1) return items;
  const s = items[0];
  const parts = s.split(/,\s*'/);
  if (parts.length <= 1) return items;
  const labelPrefix = /^(?:Point \d+:|Common Mistakes:|Performance Cues:)\s*/i;
  return parts
    .map((p) =>
      p
        .replace(labelPrefix, '')
        .replace(/^\s*and\s+/i, '')
        .replace(/^'|'$/g, '')
        .trim()
    )
    .filter(Boolean);
}

function detectKineticChainType(biomechanicalChain: string): string {
  const lower = biomechanicalChain.toLowerCase();
  if (lower.includes('closed-kinetic') || lower.includes('closed kinetic'))
    return 'CLOSED-KINETIC CHAIN';
  if (lower.includes('open-kinetic') || lower.includes('open kinetic')) return 'OPEN-KINETIC CHAIN';
  if (lower.includes('unilateral')) return 'UNILATERAL';
  if (lower.includes('bilateral')) return 'BILATERAL';
  if (lower.includes('compound')) return 'COMPOUND MOVEMENT';
  if (lower.includes('isolation')) return 'ISOLATION MOVEMENT';
  return 'MOVEMENT PATTERN';
}
export function parseBiomechanicalPoints(points: string[]): {
  biomechanics: ParsedBiomechanics;
  kineticChainType: string;
} {
  const defaults: ParsedBiomechanics = {
    biomechanicalChain: '',
    pivotPoints: '',
    stabilizationNeeds: '',
    commonMistakes: [],
    performanceCues: [],
  };
  if (!points || points.length === 0) {
    return { biomechanics: defaults, kineticChainType: 'MOVEMENT PATTERN' };
  }
  let biomechanicalChainContent = '';
  for (const point of points) {
    const lowerPoint = point.toLowerCase();
    if (lowerPoint.includes('biomechanical chain') || lowerPoint.includes('point 1:')) {
      biomechanicalChainContent = extractPointContent(point);
      defaults.biomechanicalChain = biomechanicalChainContent;
    } else if (lowerPoint.includes('pivot point') || lowerPoint.includes('point 2:')) {
      defaults.pivotPoints = extractPointContent(point);
    } else if (lowerPoint.includes('stabilization') || lowerPoint.includes('point 3:')) {
      defaults.stabilizationNeeds = extractPointContent(point);
    } else if (lowerPoint.includes('common mistake') || lowerPoint.includes('point 4:')) {
      defaults.commonMistakes = parseMultipleItems(extractPointContent(point));
    } else if (lowerPoint.includes('performance cue') || lowerPoint.includes('point 5:')) {
      defaults.performanceCues = parseMultipleItems(extractPointContent(point));
    }
  }
  if (!defaults.biomechanicalChain && points.length >= 1) {
    biomechanicalChainContent = extractPointContent(points[0]);
    defaults.biomechanicalChain = biomechanicalChainContent;
  }
  if (!defaults.pivotPoints && points.length >= 2)
    defaults.pivotPoints = extractPointContent(points[1]);
  if (!defaults.stabilizationNeeds && points.length >= 3)
    defaults.stabilizationNeeds = extractPointContent(points[2]);
  if (defaults.commonMistakes.length === 0 && points.length >= 4)
    defaults.commonMistakes = parseMultipleItems(extractPointContent(points[3]));
  if (defaults.performanceCues.length === 0 && points.length >= FULL_BIOMECHANICS_CARD_LENGTH)
    defaults.performanceCues = parseMultipleItems(extractPointContent(points[4]));
  const kineticChainType = detectKineticChainType(biomechanicalChainContent);
  return { biomechanics: defaults, kineticChainType };
}

interface RawGroundingChunk {
  web?: { uri?: string; title?: string };
  uri?: string;
  url?: string;
  title?: string;
}

export function transformSearchResultsToSources(
  searchResults: RawGroundingChunk[] | undefined,
  exerciseName: string
): ExerciseSource[] {
  if (!searchResults?.length) return [];
  const sources: ExerciseSource[] = [];
  const seenDomains = new Set<string>();
  for (const result of searchResults) {
    const uri = result?.web?.uri || result?.uri || result?.url || '';
    if (!uri) continue;
    try {
      const url = new URL(uri);
      const domain = url.hostname.replace(/^www\./, '');
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      const domainName = domain.split('.')[0];
      const title = domainName
        .replace(/-/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      sources.push({ title, domain, searchQuery: `${exerciseName} biomechanics site:${domain}` });
    } catch {
      continue;
    }
  }
  return sources;
}
export function filterRealSources(sources: ExerciseSource[] | undefined): ExerciseSource[] {
  if (!sources?.length) return [];
  const lower = (d: string) => d?.toLowerCase() ?? '';
  return sources.filter(
    (s) => !lower(s.domain).includes('vertexaisearch') && !lower(s.domain).includes('vertexai')
  );
}

export function generateSlug(exerciseName: string): string {
  return exerciseName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
