import React from 'react';

export interface WelcomeTestimonialQuote {
  quote: string;
  attribution?: string;
}

export interface WelcomeTestimonialsSlotProps {
  quotes?: WelcomeTestimonialQuote[];
  className?: string;
}

/**
 * Optional testimonials strip for the welcome card. Renders nothing when quotes empty.
 */
const WelcomeTestimonialsSlot: React.FC<WelcomeTestimonialsSlotProps> = ({
  quotes = [],
  className = '',
}) => {
  const list = quotes.filter((q) => q.quote?.trim()).slice(0, 3);
  if (list.length === 0) return null;

  return (
    <div
      className={`mt-6 space-y-3 border-t border-white/10 pt-6 text-left ${className}`}
      aria-label="Testimonials"
    >
      {list.map((q, i) => (
        <blockquote
          key={i}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75"
        >
          <p className="italic text-white/85">&ldquo;{q.quote.trim()}&rdquo;</p>
          {q.attribution?.trim() ? (
            <footer className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/40">
              — {q.attribution.trim()}
            </footer>
          ) : null}
        </blockquote>
      ))}
    </div>
  );
};

export default WelcomeTestimonialsSlot;
