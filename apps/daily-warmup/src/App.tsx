import { useHubActivationLog } from '@interval-timers/handoff';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from './lib/supabase';
import WarmUpInterval from './components/interval-timers/WarmUpInterval';

function App() {
  useHubActivationLog(supabase, (milestone, appId) => {
    trackEvent(
      supabase,
      milestone === 'first' ? 'hub_timer_launch_1' : 'hub_timer_launch_2',
      { app_id: appId },
      { appId: 'daily-warmup' }
    );
  });

  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      {/* Standalone app: IntervalTimerLanding uses standalone=true so nav is hidden; onNavigate not required. */}
      <WarmUpInterval />
    </div>
  )
}

export default App
