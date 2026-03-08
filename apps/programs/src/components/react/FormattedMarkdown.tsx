/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renders markdown description content as sanitized HTML with consistent prose styling.
 * Use for workout set overviews, program/challenge descriptions, and catalog teasers.
 */

import React from 'react';
import { formatLandingPageMarkdown } from '@/lib/format-landing-page-markdown';
import { LANDING_DESCRIPTION_CLASS } from './public/landing-description-styles';

export interface FormattedMarkdownProps {
  /** Raw markdown string (headings, bold, italic, lists). */
  content: string;
  /** Optional additional or override Tailwind classes. Default includes prose-style description. */
  className?: string;
}

/**
 * Presentational component: markdown string → formatLandingPageMarkdown → div with dangerouslySetInnerHTML.
 * Handles empty/whitespace by rendering nothing.
 */
const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({
  content,
  className = LANDING_DESCRIPTION_CLASS,
}) => {
  const trimmed = content?.trim();
  if (!trimmed) return null;

  const html = formatLandingPageMarkdown(trimmed);
  if (!html) return null;

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default FormattedMarkdown;
