/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Landing page description: glanceable summary, hero image slot, tabbed sections.
 * Reduces cognitive overload by organizing markdown into scannable chunks.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ImageIcon } from 'lucide-react';
import { parseMarkdownIntoSections } from '@/lib/parse-description-sections';
import { LANDING_DESCRIPTION_CLASS } from './landing-description-styles';

export interface LandingPageDescriptionMetadata {
  durationWeeks: number;
  difficulty: string;
  equipmentProfile?: { zoneId?: string; equipmentIds?: string[] };
  theme?: string;
}

export interface LandingPageDescriptionProps {
  description: string;
  heroImageUrl?: string;
  sectionImages?: Record<string, string>;
  metadata: LandingPageDescriptionMetadata;
  zones?: { id: string; name: string }[];
  landingDescriptionClass?: string;
}

const MAX_GLANCE_BULLETS = 5;

/** Extract first N bullet points from raw markdown (lines starting with * or -) */
function extractBulletPoints(markdown: string, max: number): string[] {
  const lines = markdown.split(/\n/);
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^[*-]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (match) {
      const text = match[1]
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .trim();
      if (text && bullets.length < max) {
        bullets.push(text);
      }
    }
  }
  return bullets;
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5"
      aria-hidden
    >
      <ImageIcon className="mb-2 h-10 w-10 text-white/30" />
      <span className="text-sm text-white/40">{label}</span>
    </div>
  );
}

const LandingPageDescription: React.FC<LandingPageDescriptionProps> = ({
  description,
  heroImageUrl,
  sectionImages = {},
  metadata,
  zones = [],
  landingDescriptionClass = LANDING_DESCRIPTION_CLASS,
}) => {
  const { overview, overviewRaw, sections } = useMemo(
    () => parseMarkdownIntoSections(description || 'No description.'),
    [description]
  );

  const [activeTab, setActiveTab] = useState<'overview' | string>('overview');

  const zoneName =
    metadata.equipmentProfile?.zoneId && zones.length > 0
      ? (zones.find((z) => z.id === metadata.equipmentProfile?.zoneId)?.name ?? '—')
      : (metadata.equipmentProfile?.zoneId ?? '—');

  const glanceBullets = useMemo(
    () => extractBulletPoints(overviewRaw || '', MAX_GLANCE_BULLETS),
    [overviewRaw]
  );

  const tabs = useMemo(() => {
    const list: { id: string; label: string }[] = [{ id: 'overview', label: 'Overview' }];
    sections.forEach((s) => {
      list.push({
        id: s.slug,
        label: s.title.length > 28 ? `${s.title.slice(0, 25)}…` : s.title,
      });
    });
    return list;
  }, [sections]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, tabs.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }
      setActiveTab(tabs[nextIndex].id);
    },
    [tabs]
  );

  return (
    <div className="mb-6 space-y-6">
      {/* 1. Glanceable summary block */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">
            {metadata.durationWeeks} Weeks
          </span>
          <span className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">
            {metadata.difficulty}
          </span>
          {metadata.theme && (
            <span className="bg-orange-light/20 rounded px-3 py-1 text-sm text-orange-light">
              {metadata.theme}
            </span>
          )}
          <span className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">{zoneName}</span>
        </div>
        {glanceBullets.length > 0 && (
          <ul className="space-y-1.5 text-sm text-white/80">
            {glanceBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-orange-light" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 2. Hero image slot */}
      <div className="overflow-hidden rounded-xl">
        {heroImageUrl ? (
          <img src={heroImageUrl} alt="" className="h-auto max-h-[280px] w-full object-cover" />
        ) : (
          <ImagePlaceholder label="Hero image" />
        )}
      </div>

      {/* 3. Tabbed sections */}
      {sections.length === 0 ? (
        <div className={landingDescriptionClass} dangerouslySetInnerHTML={{ __html: overview }} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm">
          <div
            className="flex flex-wrap gap-2 border-b border-white/10 px-5 pb-2 pt-5"
            role="tablist"
            aria-label="Description sections"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-orange-light/20 text-orange-light'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="border-t border-white/10 p-5">
            {activeTab === 'overview' && (
              <div
                id="panel-overview"
                role="tabpanel"
                aria-labelledby="tab-overview"
                className={landingDescriptionClass}
                dangerouslySetInnerHTML={{ __html: overview }}
              />
            )}
            {sections.map((sec, i) => {
              if (activeTab !== sec.slug) return null;
              const sectionImageUrl = sectionImages[String(i + 1)] ?? sectionImages[sec.slug];
              return (
                <div
                  key={sec.slug}
                  id={`panel-${sec.slug}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${sec.slug}`}
                  className="flex flex-col gap-4 md:flex-row md:gap-6"
                >
                  {sectionImageUrl ? (
                    <div className="w-full shrink-0 md:w-48 lg:w-56">
                      <img
                        src={sectionImageUrl}
                        alt=""
                        className="rounded-lg border border-white/10 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full shrink-0 md:w-48 lg:w-56">
                      <ImagePlaceholder label="Section image" />
                    </div>
                  )}
                  <div
                    className={`min-w-0 flex-1 ${landingDescriptionClass}`}
                    dangerouslySetInnerHTML={{ __html: sec.content }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPageDescription;
