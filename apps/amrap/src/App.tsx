import { Routes, Route } from 'react-router-dom'
import AmrapInterval from './components/interval-timers/AmrapInterval'
import ProgrammingGuide from './pages/ProgrammingGuide'
import WorkoutExplorer from './pages/WorkoutExplorer'

function App() {
  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <Routes>
        <Route path="/" element={<AmrapInterval />} />
        <Route path="programming-guide" element={<ProgrammingGuide />} />
        <Route path="workout-explorer" element={<WorkoutExplorer />} />
      </Routes>
    </div>
  )
}

export default App
