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
  // Match patterns like "Point 1: Biomechanical Chain - content..."
  const match = point.match(/^Point\s*\d+:\s*[^-]+-\s*(.*)$/i);
  if (match) {
    return match[1].trim();
  }
  // Fallback: try to find content after first dash
  const dashIndex = point.indexOf(' - ');
  if (dashIndex !== -1) {
    return point.substring(dashIndex + 3).trim();
  }
  return point;
}

/**
 * Parse a point that may contain multiple items (mistakes or cues).
 * Looks for patterns like bullet points, numbered lists, or sentence separators.
 */
function parseMultipleItems(content: string): string[] {
  // Try to split on common bullet/list patterns
  const bulletPatterns = [
    /(?:^|\n)\s*[•●◦▪-]\s*/g, // Bullet points
    /(?:^|\n)\s*\d+[.)]\s*/g, // Numbered lists
    /(?:^|\n)\s*[a-z][.)]\s*/gi, // Lettered lists
    /;\s*/g, // Semicolon separators
  ];

  for (const pattern of bulletPatterns) {
    const parts = content.split(pattern).filter((p) => p.trim());
    if (parts.length > 1) {
      return parts.map((p) => p.trim());
    }
  }

  // Try splitting on sentence-ending periods followed by capital letters
  const sentences = content.split(/\.\s+(?=[A-Z])/).filter((s) => s.trim());
  if (sentences.length > 1) {
    return sentences.map((s) => (s.endsWith('.') ? s.trim() : s.trim() + '.'));
  }

  // Fallback: return as single item
  return [content.trim()];
}

/**
 * Normalize list items for display. When a single element contains comma-separated
 * quoted phrases (e.g. "'A', 'B', and 'C'"), split into separate items.
 * Used for Performance Cues and Common Mistakes display.
 */
export function normalizeListItems(items: string[]): string[] {
  if (!items.length || items.length !== 1) return items;
  const s = items[0];
  // Split on comma-quote (,'): delimiter between quoted phrases
  const parts = s.split(/,\s*'/);
  if (parts.length <= 1) return items;
  // Strip only known section labels (Point N:, Common Mistakes:, Performance Cues:)
  // to avoid removing meaningful content like "Tip: …" or "Cue: …"
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

/**
 * Detect kinetic chain type from biomechanical chain content.
 */
function detectKineticChainType(biomechanicalChain: string): string {
  const lowerContent = biomechanicalChain.toLowerCase();

  if (lowerContent.includes('closed-kinetic') || lowerContent.includes('closed kinetic')) {
    return 'CLOSED-KINETIC CHAIN';
  }
  if (lowerContent.includes('open-kinetic') || lowerContent.includes('open kinetic')) {
    return 'OPEN-KINETIC CHAIN';
  }
  if (lowerContent.includes('unilateral')) {
    return 'UNILATERAL';
  }
  if (lowerContent.includes('bilateral')) {
    return 'BILATERAL';
  }
  if (lowerContent.includes('compound')) {
    return 'COMPOUND MOVEMENT';
  }
  if (lowerContent.includes('isolation')) {
    return 'ISOLATION MOVEMENT';
  }

  return 'MOVEMENT PATTERN';
}

/**
 * Parse the biomechanicalPoints array into structured data.
 *
 * Expected format (5 points):
 * - Point 1: Biomechanical Chain - ...
 * - Point 2: Pivot Points - ...
 * - Point 3: Stabilization Needs - ...
 * - Point 4: Common Mistakes - ...
 * - Point 5: Performance Cues - ...
 */
export function parseBiomechanicalPoints(points: string[]): {
  biomechanics: ParsedBiomechanics;
  kineticChainType: string;
} {
  // Default values
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

  // Try to identify each point by its label
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

  // If we couldn't identify points by label, use position-based fallback
  if (!defaults.biomechanicalChain && points.length >= 1) {
    biomechanicalChainContent = extractPointContent(points[0]);
    defaults.biomechanicalChain = biomechanicalChainContent;
  }
  if (!defaults.pivotPoints && points.length >= 2) {
    defaults.pivotPoints = extractPointContent(points[1]);
  }
  if (!defaults.stabilizationNeeds && points.length >= 3) {
    defaults.stabilizationNeeds = extractPointContent(points[2]);
  }
  if (defaults.commonMistakes.length === 0 && points.length >= 4) {
    defaults.commonMistakes = parseMultipleItems(extractPointContent(points[3]));
  }
  if (defaults.performanceCues.length === 0 && points.length >= FULL_BIOMECHANICS_CARD_LENGTH) {
    defaults.performanceCues = parseMultipleItems(extractPointContent(points[4]));
  }

  const kineticChainType = detectKineticChainType(biomechanicalChainContent);

  return { biomechanics: defaults, kineticChainType };
}

/**
 * Transform search results into source verification objects.
 * Uses the "Search Verification" pattern to avoid direct URL linking.
 *
 * @param searchResults - Raw search results from Gemini grounding
 * @param exerciseName - Name of the exercise for the search query
 */
/** Raw grounding chunk from Gemini (structure varies) */
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
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  const sources: ExerciseSource[] = [];
  const seenDomains = new Set<string>();

  for (const result of searchResults) {
    // Handle different possible structures from Gemini grounding
    const uri = result?.web?.uri || result?.uri || result?.url || '';

    if (!uri) continue;

    try {
      const url = new URL(uri);
      const domain = url.hostname.replace(/^www\./, '');

      // Skip duplicates
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);

      // Extract title from domain (e.g., "verywellfit.com" -> "VeryWellFit")
      const domainName = domain.split('.')[0];
      const title = domainName
        .replace(/-/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      sources.push({
        title,
        domain,
        searchQuery: `${exerciseName} biomechanics site:${domain}`,
      });
    } catch (error) {
      // Invalid URL, skip. Log in development to help debug skipped results.
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        console.warn('Failed to parse search result URL:', uri, error);
      }
      continue;
    }
  }

  return sources;
}

/**
 * Excludes Vertex AI Search / internal grounding sources — these are not real citations.
 * Stored sources from Gemini grounding often have domain vertexaisearch.cloud.google.com.
 */
export function filterRealSources(sources: ExerciseSource[] | undefined): ExerciseSource[] {
  if (!sources?.length) return [];
  const lower = (d: string) => d?.toLowerCase() ?? '';
  return sources.filter(
    (s) => !lower(s.domain).includes('vertexaisearch') && !lower(s.domain).includes('vertexai')
  );
}

/**
 * Generate a URL-safe slug from an exercise name.
 */
export function generateSlug(exerciseName: string): string {
  return exerciseName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
