import { Routes, Route } from 'react-router-dom'
import { useHubActivationLog } from '@interval-timers/handoff'
import { trackEvent } from '@interval-timers/analytics'
import { supabase } from '@/lib/supabase'
import AmrapInterval from './components/interval-timers/AmrapInterval'
import LogoutPage from './pages/LogoutPage'
import ProgrammingGuide from './pages/ProgrammingGuide'
import WorkoutExplorer from './pages/WorkoutExplorer'
import AmrapWithFriendsPage from './pages/AmrapWithFriendsPage'
import AmrapSessionPage from './pages/AmrapSessionPage'

function App() {
  useHubActivationLog(supabase, (milestone, appId) => {
    trackEvent(
      supabase,
      milestone === 'first' ? 'hub_timer_launch_1' : 'hub_timer_launch_2',
      { app_id: appId },
      { appId: 'amrap' }
    );
  });

  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <Routes>
        <Route path="/" element={<AmrapInterval />} />
        <Route path="programming-guide" element={<ProgrammingGuide />} />
        <Route path="workout-explorer" element={<WorkoutExplorer />} />
        <Route path="with-friends" element={<AmrapWithFriendsPage />} />
        <Route path="with-friends/session/:sessionId" element={<AmrapSessionPage />} />
        <Route path="logout" element={<LogoutPage />} />
      </Routes>
    </div>
  )
}

export default App
