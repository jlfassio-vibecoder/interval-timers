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
import IntervalTimerLanding from './IntervalTimerLanding';
import IntervalTimerLandingContent from './IntervalTimerLandingContent';
import IntervalTimerLandingPage from './IntervalTimerLandingPage';
import {
  type IntervalTimerPage,
  getProtocolAccent,
  VALID_PROTOCOLS,
} from './intervalTimerProtocols';

export type { IntervalTimerPage } from './intervalTimerProtocols';

function getProtocolFromUrl(): IntervalTimerPage | null {
  if (typeof window === 'undefined') return null;
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
    const url = new URL(window.location.href);
    url.searchParams.set('protocol', page);
    window.history.pushState({}, '', url.pathname + '?' + url.searchParams.toString());
  };

  if (currentPage === null) {
    return <IntervalTimerLandingPage onNavigate={handleNavigate} />;
  }

  return (
    <>
      {currentPage === 'warmup' && <WarmUpInterval onNavigate={handleNavigate} />}
      {currentPage === 'tabata' && <TabataInterval onNavigate={handleNavigate} />}
      {currentPage === 'mindful' && <JapaneseWalking onNavigate={handleNavigate} />}
      {currentPage === 'aerobic' && <AerobicInterval onNavigate={handleNavigate} />}
      {currentPage === 'lactate' && <LactateInterval onNavigate={handleNavigate} />}
      {currentPage === 'phosphagen' && <PhosphagenInterval onNavigate={handleNavigate} />}
      {currentPage === 'gibala' && <GibalaMethod onNavigate={handleNavigate} />}
      {currentPage === 'wingate' && <WingateInterval onNavigate={handleNavigate} />}
      {currentPage === 'timmons' && <TimmonsInterval onNavigate={handleNavigate} />}
      {currentPage === 'emom' && <EmomInterval onNavigate={handleNavigate} />}
      {currentPage === 'amrap' && <AmrapInterval onNavigate={handleNavigate} />}
      {currentPage === '10-20-30' && <TenTwentyThirtyInterval onNavigate={handleNavigate} />}
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
          accentTheme={getProtocolAccent(currentPage)}
        >
          <IntervalTimerLandingContent protocol={currentPage} onNavigate={handleNavigate} />
        </IntervalTimerLanding>
      )}
    </>
  );
};

export default IntervalTimerApp;
