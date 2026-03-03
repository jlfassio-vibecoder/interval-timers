/**
 * Reusable subtitle shown above instructional content (e.g. step-by-step and mistakes/corrections).
 * Renders nothing when text is empty.
 */
import React from 'react';

export interface ExerciseSubtitleProps {
  /** Subtitle text. Renders nothing if empty. */
  text: string;
  /** Optional extra class for the wrapper. */
  className?: string;
}

const ExerciseSubtitle: React.FC<ExerciseSubtitleProps> = ({ text, className = '' }) => {
  if (!text.trim()) return null;

  return (
    <p
      className={`text-xs leading-relaxed text-white/70 ${className}`.trim()}
      role="doc-subtitle"
    >
      {text}
    </p>
  );
};

export default ExerciseSubtitle;
