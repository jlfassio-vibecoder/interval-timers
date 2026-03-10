/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared types for Visualization Lab (generate-exercise-image API).
 */

/** Raw search result chunk from Gemini grounding */
export interface SearchChunk {
  web?: { uri?: string; title?: string };
  uri?: string;
  url?: string;
  title?: string;
}

/** Response when researchOnly=true; no image data */
export interface ResearchOnlyResult {
  biomechanicalPoints: string[];
  searchResults?: SearchChunk[];
  imagePrompt: string;
  imagePrompts?: string[];
}

/** Response shape from /api/generate-exercise-image */
export interface BiomechanicalPoints {
  biomechanicalPoints: string[];
  image: string;
  /** Present when outputMode=sequence; length 3 for start, mid, end */
  images?: string[];
  searchResults?: SearchChunk[];
  imagePrompt?: string;
  /** Present when outputMode=sequence; exactly 3 prompts for start, mid, end */
  imagePrompts?: string[];
}
