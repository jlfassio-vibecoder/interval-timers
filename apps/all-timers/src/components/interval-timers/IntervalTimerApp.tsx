import React, { useState, useEffect } from 'react';
import TabataInterval from './TabataInterval';
import JapaneseWalking from './JapaneseWalking';
import AerobicInterval from './AerobicInterval';
import LactateInterval from './LactateInterval';
import PhosphagenInterval from './PhosphagenInterval';
import GibalaMethod from './GibalaMethod';
import WingateInterval from './WingateInterval';
import TimmonsInterval from './TimmonsInterval';
import EmomInterval from './EmomInterval';
import AmrapInterval from './AmrapInterval';
import TenTwentyThirtyInterval from './TenTwentyThirtyInterval';
import WarmUpInterval from './WarmUpInterval';
import { IntervalTimerLanding } from '@interval-timers/timer-ui';
import IntervalTimerLandingContent from './IntervalTimerLandingContent';
import IntervalTimerLandingPage from './IntervalTimerLandingPage';
import {
  type IntervalTimerPage,
  getProtocolAccent,
  VALID_PROTOCOLS,
} from '@interval-timers/timer-core';
import { getProtocolFromPath, getSlugForProtocol } from '../../lib/seoSlugs';
import {
  getProtocolSeoMeta,
  LANDING_TITLE,
  LANDING_DESCRIPTION,
} from '../../lib/protocolSeo';

export type { IntervalTimerPage } from '@interval-timers/timer-core';

function getProtocolFromUrl(): IntervalTimerPage | null {
  if (typeof window === 'undefined') return null;
  const fromPath = getProtocolFromPath(window.location.pathname);
  if (fromPath) return fromPath;
  const params = new URLSearchParams(window.location.search);
  const p = params.get('protocol');
  if (p && VALID_PROTOCOLS.includes(p as IntervalTimerPage)) return p as IntervalTimerPage;
  return null;
}

function parseInitialProtocol(
  initialProtocol: string | null | undefined
): IntervalTimerPage | null {
  if (!initialProtocol) return null;
  return VALID_PROTOCOLS.includes(initialProtocol as IntervalTimerPage)
    ? (initialProtocol as IntervalTimerPage)
    : null;
}

interface IntervalTimerAppProps {
  /** Pass from Astro so server/client render the same protocol (avoids hydration mismatch) */
  initialProtocol?: string | null;
}

const IntervalTimerApp: React.FC<IntervalTimerAppProps> = ({ initialProtocol }) => {
  const [currentPage, setCurrentPage] = useState<IntervalTimerPage | null>(() =>
    typeof window !== 'undefined' ? getProtocolFromUrl() : parseInitialProtocol(initialProtocol)
  );

  useEffect(() => {
    const syncFromUrl = () => setCurrentPage(getProtocolFromUrl());
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const handleNavigate = (page: IntervalTimerPage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const slug = getSlugForProtocol(page);
    window.history.pushState({}, '', '/' + slug);
  };

  const handleNavigateToLanding = () => {
    setCurrentPage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.pushState({}, '', '/');
  };

  useEffect(() => {
    const baseUrl =
      typeof import.meta.env !== 'undefined' && import.meta.env.VITE_APP_URL
        ? String(import.meta.env.VITE_APP_URL).replace(/\/$/, '')
        : typeof window !== 'undefined'
          ? window.location.origin
          : '';
    if (currentPage === null) {
      document.title = LANDING_TITLE;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', LANDING_DESCRIPTION);
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', baseUrl + '/');
    } else {
      const meta = getProtocolSeoMeta(currentPage);
      document.title = meta.title;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', meta.description);
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', baseUrl + '/' + getSlugForProtocol(currentPage));
    }
  }, [currentPage]);

  if (currentPage === null) {
    return <IntervalTimerLandingPage onNavigate={handleNavigate} />;
  }

  return (
    <>
      {currentPage === 'warmup' && (
        <WarmUpInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'tabata' && (
        <TabataInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'mindful' && (
        <JapaneseWalking onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'aerobic' && (
        <AerobicInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'lactate' && (
        <LactateInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'phosphagen' && (
        <PhosphagenInterval
          onNavigate={handleNavigate}
          onNavigateToLanding={handleNavigateToLanding}
        />
      )}
      {currentPage === 'gibala' && (
        <GibalaMethod onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'wingate' && (
        <WingateInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'timmons' && (
        <TimmonsInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'emom' && (
        <EmomInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === 'amrap' && (
        <AmrapInterval onNavigate={handleNavigate} onNavigateToLanding={handleNavigateToLanding} />
      )}
      {currentPage === '10-20-30' && (
        <TenTwentyThirtyInterval
          onNavigate={handleNavigate}
          onNavigateToLanding={handleNavigateToLanding}
        />
      )}
      {![
        'warmup',
        'tabata',
        'mindful',
        'aerobic',
        'lactate',
        'phosphagen',
        'gibala',
        'wingate',
        'timmons',
        'emom',
        'amrap',
        '10-20-30',
      ].includes(currentPage) && (
        <IntervalTimerLanding
          currentProtocol={currentPage}
          onNavigate={handleNavigate}
          onNavigateToLanding={handleNavigateToLanding}
          getProtocolHref={(p) => '/' + getSlugForProtocol(p)}
          accentTheme={getProtocolAccent(currentPage)}
        >
          <IntervalTimerLandingContent protocol={currentPage} onNavigate={handleNavigate} />
        </IntervalTimerLanding>
      )}
    </>
  );
};

export default IntervalTimerApp;
