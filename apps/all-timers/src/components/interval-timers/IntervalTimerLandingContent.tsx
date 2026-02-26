/**
 * Config-driven landing content: hero + sections + CTAs.
 * Used for protocols that do not have hasCustomContent (the 9 "coming soon" protocols).
 * Fallback: if no config, renders generic coming-soon copy.
 */
import React from 'react';
import type { IntervalTimerPage } from '@interval-timers/timer-core';
import { getProtocolAccent, getProtocolLabel } from '@interval-timers/timer-core';
import { getSlugForProtocol } from '../../lib/seoSlugs';
import { getProtocolLandingConfig } from './intervalTimerLandingConfig';

interface IntervalTimerLandingContentProps {
  protocol: IntervalTimerPage;
  onNavigate: (page: IntervalTimerPage) => void;
}

/** Renders hero title with optional highlighted word (gold). */
function renderTitle(title: string, highlightWord?: string) {
  if (!highlightWord || !title.includes(highlightWord)) {
    return <span>{title}</span>;
  }
  const parts = title.split(highlightWord);
  return (
    <>
      {parts[0]}
      <span className="text-[#ffbf00]">{highlightWord}</span>
      {parts.slice(1).join(highlightWord)}
    </>
  );
}

const IntervalTimerLandingContent: React.FC<IntervalTimerLandingContentProps> = ({
  protocol,
  onNavigate,
}) => {
  const config = getProtocolLandingConfig(protocol);

  /** Only prevent default for unmodified left-clicks so Ctrl/Cmd+click and middle-click open in new tab. */
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, page: IntervalTimerPage) => {
    if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      onNavigate(page);
    }
  };

  // Fallback: if config missing (e.g. new protocol not yet in config), show generic coming soon
  if (!config) {
    const label = getProtocolLabel(protocol);
    return (
      <>
        <section className="mx-auto max-w-4xl pt-8 text-center">
          <h1 className="mb-6 font-heading text-4xl font-bold leading-tight text-white md:text-6xl">
            <span className="text-[#ffbf00]">{label}</span> Timer
          </h1>
          <p className="mb-10 text-xl leading-relaxed text-white/80">
            This timer is coming soon. Try Tabata or Japanese Walking in the meantime.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/tabata-timer"
              onClick={(e) => handleAnchorClick(e, 'tabata')}
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Try Tabata
            </a>
            <a
              href="/japanese-walking"
              onClick={(e) => handleAnchorClick(e, 'mindful')}
              className="rounded-xl border border-[#ffbf00]/50 bg-[#ffbf00]/10 px-8 py-3 font-bold text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/20"
            >
              Try Japanese Walking
            </a>
          </div>
        </section>
      </>
    );
  }

  const accent = getProtocolAccent(protocol);
  const { hero, sections } = config;

  const handlePrimaryCta = () => {
    if (hero.primaryCtaScrollTargetId) {
      document
        .getElementById(hero.primaryCtaScrollTargetId)
        ?.scrollIntoView({ behavior: 'smooth' });
    } else if (hero.primaryCtaNavigateTo) {
      onNavigate(hero.primaryCtaNavigateTo);
    }
  };

  return (
    <>
      <section className="mx-auto max-w-4xl pt-8 text-center">
        <h1 className="mb-6 font-heading text-4xl font-bold leading-tight text-white md:text-6xl">
          {renderTitle(hero.title, hero.highlightWord)}
        </h1>
        <p className="mb-10 text-xl leading-relaxed text-white/80">{hero.subtitle}</p>
        <div className="flex justify-center gap-4">
          {hero.primaryCtaScrollTargetId ? (
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5"
            >
              {hero.primaryCtaLabel}
            </button>
          ) : hero.primaryCtaNavigateTo ? (
            <a
              href={'/' + getSlugForProtocol(hero.primaryCtaNavigateTo)}
              onClick={(e) => handleAnchorClick(e, hero.primaryCtaNavigateTo!)}
              className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5"
            >
              {hero.primaryCtaLabel}
            </a>
          ) : null}
          {hero.secondaryCtaLabel && hero.secondaryCtaNavigateTo && (
            <a
              href={'/' + getSlugForProtocol(hero.secondaryCtaNavigateTo)}
              onClick={(e) => handleAnchorClick(e, hero.secondaryCtaNavigateTo!)}
              className="rounded-xl border border-[#ffbf00]/50 bg-[#ffbf00]/10 px-8 py-3 font-bold text-[#ffbf00] transition-colors hover:bg-[#ffbf00]/20"
            >
              {hero.secondaryCtaLabel}
            </a>
          )}
        </div>
      </section>

      {sections.length > 0 &&
        sections.map((section, idx) => (
          <section
            key={idx}
            className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-sm md:p-12"
          >
            <div
              className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${accent.badge} ${accent.badgeText}`}
            >
              {section.badge}
            </div>
            <h2 className="font-display mb-4 text-3xl font-bold text-white">{section.heading}</h2>
            <p className="leading-relaxed text-white/80">{section.body}</p>
          </section>
        ))}
    </>
  );
};

export default IntervalTimerLandingContent;
