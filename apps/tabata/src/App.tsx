import { useHubActivationLog } from '@interval-timers/handoff';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from './lib/supabase';
import TabataInterval from './components/interval-timers/TabataInterval';

function App() {
  useHubActivationLog(supabase, (milestone, appId) => {
    trackEvent(
      supabase,
      milestone === 'first' ? 'hub_timer_launch_1' : 'hub_timer_launch_2',
      { app_id: appId },
      { appId: 'tabata' }
    );
  });

  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <TabataInterval />
    </div>
  )
}

export default App
