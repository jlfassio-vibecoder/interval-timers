import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

const BASE_CLASSES =
  'rounded-xl bg-orange-600 px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-transform hover:-translate-y-1 hover:bg-orange-500';

interface AmrapCtaButtonProps {
  children: ReactNode;
  /** When set, render as Link; otherwise render as button. */
  to?: string;
  /** When set, render as external anchor (e.g. HUD URL). */
  href?: string;
  /** Used when rendering as button. */
  onClick?: () => void;
  className?: string;
}

export default function AmrapCtaButton({
  children,
  to,
  href,
  onClick,
  className,
}: AmrapCtaButtonProps) {
  const classes = twMerge(BASE_CLASSES, className);

  if (href != null) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  if (to != null) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
