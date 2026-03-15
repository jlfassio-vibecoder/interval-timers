/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Internal parser for biomechanical points. Used by approved-maps.
 * Adapted from apps/programs/src/lib/parse-biomechanics.ts.
 */

interface ParsedBiomechanics {
  biomechanicalChain: string;
  pivotPoints: string;
  stabilizationNeeds: string;
  commonMistakes: string[];
  performanceCues: string[];
}

/** Number of items in the full biomechanical card: Chain, Pivot, Stabilization, Mistakes, Cues. */
export const FULL_BIOMECHANICS_CARD_LENGTH = 5;

function extractPointContent(point: string): string {
  const match = point.match(/^Point\s*\d+:\s*[^-]+-\s*(.*)$/i);
  if (match) return match[1].trim();
  const dashIndex = point.indexOf(' - ');
  if (dashIndex !== -1) return point.substring(dashIndex + 3).trim();
  return point;
}

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

function detectKineticChainType(biomechanicalChain: string): string {
  const lower = biomechanicalChain.toLowerCase();
  if (lower.includes('closed-kinetic') || lower.includes('closed kinetic'))
    return 'CLOSED-KINETIC CHAIN';
  if (lower.includes('open-kinetic') || lower.includes('open kinetic'))
    return 'OPEN-KINETIC CHAIN';
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
