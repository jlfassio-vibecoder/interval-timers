/**
 * Home pricing section: monetization funnel instrumentation (Phase P2).
 * Observes #pricing for view event; intercepts Stripe CTA clicks for checkout_started.
 */

import React, { useEffect } from 'react';
import { trackEvent } from '@interval-timers/analytics';
import { purchasedIndexForPlanId } from '@/data/pricing';
import { supabase } from '@/lib/supabase/supabase-instance';

const MonetizationPricingTracker: React.FC = () => {
  useEffect(() => {
    const section = document.getElementById('pricing');
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        observer.disconnect();
        void trackEvent(
          supabase,
          'monetization_pricing_viewed',
          { surface: 'home_pricing' },
          { appId: 'app' }
        );
      },
      { threshold: 0.15, rootMargin: '0px' }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = document.getElementById('pricing');
    if (!section) return;

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || !section.contains(anchor)) return;

      const card = anchor.closest('[data-cta]');
      const cta = card?.getAttribute('data-cta');
      if (!cta?.startsWith('pricing-')) return;

      const planId = cta.slice('pricing-'.length);
      const purchased_index = purchasedIndexForPlanId(planId);
      let cta_host: string | undefined;
      try {
        cta_host = new URL(anchor.href, window.location.origin).hostname;
      } catch {
        /* ignore */
      }

      e.preventDefault();
      // Best-effort analytics only: never await before redirect (slow/failed insert must not block checkout).
      void trackEvent(
        supabase,
        'monetization_checkout_started',
        {
          plan_id: planId,
          purchased_index,
          cta_host,
        },
        { appId: 'app' }
      );
      window.location.assign(anchor.href);
    };

    section.addEventListener('click', onClickCapture, true);
    return () => section.removeEventListener('click', onClickCapture, true);
  }, []);

  return null;
};

export default MonetizationPricingTracker;
