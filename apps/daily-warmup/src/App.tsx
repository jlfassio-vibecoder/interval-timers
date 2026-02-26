import WarmUpInterval from './components/interval-timers/WarmUpInterval'

function App() {
  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      {/* Standalone app: IntervalTimerLanding uses standalone=true so nav is hidden; onNavigate not required. */}
      <WarmUpInterval />
    </div>
  )
}

export default App
