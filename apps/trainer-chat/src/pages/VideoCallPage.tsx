import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAgoraChannel } from '@/hooks/useAgoraChannel'
import VideoCallLayout from '@/components/VideoCallLayout'

export default function VideoCallPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isHost = searchParams.get('host') === '1'

  const {
    joined,
    localVideoTrack,
    remoteUsers,
    leave,
    muteVideo,
    muteAudio,
    error,
  } = useAgoraChannel(channelId ?? '', isHost)

  const handleLeave = async () => {
    await leave()
    navigate('/')
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="mb-4 text-red-400">{error}</p>
        <Link
          to="/"
          className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500"
        >
          Back
        </Link>
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-white/80">Joining channel…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
        <Link
          to="/"
          className="text-sm text-white/70 hover:text-white"
        >
          ← Exit
        </Link>
        <span className="text-sm font-medium text-white/90">
          Channel: {channelId}
        </span>
        <span className="w-12" />
      </header>
      <main className="min-h-0 flex-1">
        <VideoCallLayout
          isHost={isHost}
          localVideoTrack={localVideoTrack}
          remoteUsers={remoteUsers}
          onLeave={handleLeave}
          onMuteVideo={muteVideo}
          onMuteAudio={muteAudio}
        />
      </main>
    </div>
  )
}
