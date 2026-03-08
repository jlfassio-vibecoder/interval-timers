import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const [channelId, setChannelId] = useState('')
  const navigate = useNavigate()

  const handleCreate = () => {
    const id = crypto.randomUUID().slice(0, 8)
    navigate(`/call/${id}?host=1`)
  }

  const handleJoin = () => {
    const trimmed = channelId.trim()
    if (!trimmed) return
    navigate(`/call/${trimmed}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-8 text-2xl font-bold text-white">Trainer Chat</h1>
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-white/10 bg-black/30 p-8">
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-xl bg-orange-600 py-3 font-bold text-white transition-colors hover:bg-orange-500"
        >
          Create session
        </button>
        <button
          type="button"
          onClick={() => navigate('/call/AMRAP?host=1')}
          className="rounded-xl border border-orange-500/60 py-3 font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
        >
          Test AMRAP channel (host)
        </button>
        <div className="border-t border-white/10 pt-6">
          <label htmlFor="channel" className="mb-2 block text-sm text-white/70">
            Join session
          </label>
          <div className="flex gap-2">
            <input
              id="channel"
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Enter channel ID"
              className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!channelId.trim()}
              className="rounded-lg bg-white/10 px-4 py-2 font-medium text-white hover:bg-white/20 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
