import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import VideoCallPage from './pages/VideoCallPage'

function App() {
  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/call/:channelId" element={<VideoCallPage />} />
      </Routes>
    </div>
  )
}

export default App
