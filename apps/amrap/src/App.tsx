import { Routes, Route } from 'react-router-dom'
import AmrapInterval from './components/interval-timers/AmrapInterval'
import ProgrammingGuide from './pages/ProgrammingGuide'
import WorkoutExplorer from './pages/WorkoutExplorer'
import AmrapWithFriendsPage from './pages/AmrapWithFriendsPage'
import AmrapSessionPage from './pages/AmrapSessionPage'

function App() {
  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <Routes>
        <Route path="/" element={<AmrapInterval />} />
        <Route path="programming-guide" element={<ProgrammingGuide />} />
        <Route path="workout-explorer" element={<WorkoutExplorer />} />
        <Route path="with-friends" element={<AmrapWithFriendsPage />} />
        <Route path="with-friends/session/:sessionId" element={<AmrapSessionPage />} />
      </Routes>
    </div>
  )
}

export default App
