/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Injects deterministic SEO meta tags (title, description, canonical, Open Graph,
 * Twitter Cards) into AI-generated deep dive HTML before serving. Ensures crawlers
 * and social platforms receive proper metadata regardless of AI output.
 */

import type { ExerciseSource } from '@/types/generated-exercise';

export interface DeepDiveMetaInput {
  exerciseName: string;
  slug: string;
  baseUrl: string; // e.g. "https://yoursite.com" (no trailing slash)
  /** Full URL (e.g. Firebase Storage download URL). When empty, og:image/twitter:image are omitted. */
  imageUrl: string;
  /** Performance cues for HowTo steps. When empty, HowTo uses a single step with the page description. */
  performanceCues: string[];
  /** Optional; used for ExerciseAction exerciseType. */
  complexityLevel?: string;
  /** Optional; when set, added to the JSON-LD script tag for CSP. */
  nonce?: string;
  /** Verified sources from exercise creation (research grounding). Injected into deep dive instead of AI-generated placeholder. */
  sources?: ExerciseSource[];
  /** Optional; target of the left nav "back" link (default /exercises). */
  backHref?: string;
  /** Optional; label for the left nav back link (default EXERCISE_LABELS.backLink). */
  backLinkLabel?: string;
}

/** Escape text for use in HTML attribute values (e.g. meta content, href). Safe for double-quoted attributes. */
export function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Max length for HowToStep name (truncate cue for name). */
const HOWTO_STEP_NAME_MAX = 80;

/**
 * Builds HowTo and ExerciseAction JSON-LD for the deep dive page.
 * Returns an object with @context and @graph for a single script block.
 */
function buildDeepDiveJsonLd(input: DeepDiveMetaInput): Record<string, unknown> {
  const { exerciseName, slug, baseUrl, imageUrl, performanceCues, complexityLevel } = input;
  const canonicalHref = `${baseUrl.replace(/\/$/, '')}/exercises/${slug}/learn`;
  const description = `Learn the biomechanics of ${exerciseName}. Performance cues, common mistakes, and detailed analysis.`;

  const howToSteps: { '@type': string; name: string; text: string }[] =
    performanceCues.length > 0
      ? // Index intentionally unused; _ satisfies no-unused-vars and convention for single unused param.
        performanceCues.map((text, _) => {
          const name =
            text.length <= HOWTO_STEP_NAME_MAX
              ? text
              : text.slice(0, HOWTO_STEP_NAME_MAX - 3) + '...';
          return { '@type': 'HowToStep', name, text };
        })
      : [{ '@type': 'HowToStep', name: 'Overview', text: description }];

  const howTo: Record<string, unknown> = {
    '@type': 'HowTo',
    name: `${exerciseName} — How to Perform`,
    description,
    url: canonicalHref,
    step: howToSteps,
  };
  if (imageUrl && imageUrl.trim().length > 0) {
    howTo.image = imageUrl.trim();
  }

  const exerciseAction: Record<string, unknown> = {
    '@type': 'ExerciseAction',
    name: exerciseName,
    url: canonicalHref,
    exerciseType:
      complexityLevel && complexityLevel.trim() ? complexityLevel.trim() : 'Strength training',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [howTo, exerciseAction],
  };
}

/**
 * Serializes JSON-LD and escapes </script> so it cannot break out of the script tag in HTML.
 */
function safeJsonLdScript(jsonObject: Record<string, unknown>): string {
  const raw = JSON.stringify(jsonObject);
  return raw.replace(/<\/script>/gi, '<\\/script>');
}

/**
 * Builds the SEO head content string (title, meta description, canonical, OG, Twitter, JSON-LD).
 * Does not inject into HTML; used by injectDeepDiveMeta and prepareDeepDiveDocument.
 */
export function buildDeepDiveHeadContent(input: DeepDiveMetaInput): string {
  const { exerciseName, slug, baseUrl, imageUrl, nonce } = input;

  const title = `${exerciseName} — Deep Dive | AI Fitcopilot | AI-Powered Hypertrophy & Tactical Workout Programs.`;
  const escapedTitle = escapeHtmlAttribute(title);
  const description = `Learn the biomechanics of ${exerciseName}. Performance cues, common mistakes, and detailed analysis.`;
  const escapedDescription = escapeHtmlAttribute(description);
  const canonicalHref = `${baseUrl.replace(/\/$/, '')}/exercises/${slug}/learn`;
  const escapedCanonical = escapeHtmlAttribute(canonicalHref);

  const hasImage = imageUrl && imageUrl.trim().length > 0;
  const escapedImageUrl = hasImage ? escapeHtmlAttribute(imageUrl.trim()) : '';

  let block = `  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDescription}">
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="${hasImage ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
`;
  if (hasImage) {
    block += `  <meta property="og:image" content="${escapedImageUrl}">
  <meta name="twitter:image" content="${escapedImageUrl}">
`;
  }

  const jsonLd = buildDeepDiveJsonLd(input);
  const safeJson = safeJsonLdScript(jsonLd);
  const nonceAttr = nonce ? ` nonce="${escapeHtmlAttribute(nonce)}"` : '';
  block += `  <script type="application/ld+json"${nonceAttr}>
${safeJson}
</script>
`;
  return block;
}

/**
 * Injects title, meta description, and canonical link into the deep dive HTML.
 * - If </head> exists: injects immediately before it (preserves AI content).
 * - If no </head>: prepends meta block at document start (fallback for malformed HTML).
 */
export function injectDeepDiveMeta(html: string, input: DeepDiveMetaInput): string {
  const metaBlock = buildDeepDiveHeadContent(input);

  const headCloseMatch = html.match(/<\/head\s*>/i);
  if (headCloseMatch) {
    return html.replace(/(<\/head\s*>)/i, metaBlock + '$1');
  }

  // Fallback: no </head> — prepend at document start (after optional DOCTYPE)
  const doctypeMatch = html.match(/^(\s*<!DOCTYPE[^>]*>\s*)/i);
  if (doctypeMatch) {
    const afterDoctype = html.slice(doctypeMatch[1].length);
    const headOpen = afterDoctype.match(/<head\s*>/i);
    if (headOpen) {
      return doctypeMatch[1] + afterDoctype.replace(/(<head\s*>)/i, '$1\n' + metaBlock);
    }
    return doctypeMatch[1] + '<head>\n' + metaBlock + '</head>\n' + afterDoctype;
  }

  return '<head>\n' + metaBlock + '</head>\n' + html;
}
