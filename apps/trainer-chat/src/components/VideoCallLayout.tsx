import { useState } from 'react'
import type { ICameraVideoTrack } from 'agora-rtc-sdk-ng'
import type { RemoteUserWithTracks } from '@/hooks/useAgoraChannel'
import LocalVideoTile, { RemoteVideoTile } from './VideoTile'
import clsx from 'clsx'

interface VideoCallLayoutProps {
  isHost: boolean
  localVideoTrack: ICameraVideoTrack | null
  remoteUsers: RemoteUserWithTracks[]
  onLeave: () => Promise<void>
  onMuteVideo: (muted: boolean) => void
  onMuteAudio: (muted: boolean) => void
}

export default function VideoCallLayout({
  isHost,
  localVideoTrack,
  remoteUsers,
  onLeave,
  onMuteVideo,
  onMuteAudio,
}: VideoCallLayoutProps) {
  // Host is uid 1
  const hostUser = remoteUsers.find((u) => String(u.uid) === '1')
  const otherUsers = remoteUsers.filter((u) => String(u.uid) !== '1')

  if (isHost) {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LocalVideoTile videoTrack={localVideoTrack} label="You (Host)" />
          {remoteUsers.map((u) => (
            <RemoteVideoTile
              key={String(u.uid)}
              user={u}
              label={`Participant ${u.uid}`}
            />
          ))}
        </div>
        <ControlBar onLeave={onLeave} onMuteVideo={onMuteVideo} onMuteAudio={onMuteAudio} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex flex-1 flex-col gap-4">
        {hostUser && (
          <div className="flex-1 min-h-0">
            <RemoteVideoTile user={hostUser} label="Host" />
          </div>
        )}
        <div className="flex shrink-0 gap-4 overflow-x-auto">
          <div className="w-48 shrink-0">
            <LocalVideoTile videoTrack={localVideoTrack} label="You" />
          </div>
          {otherUsers.map((u) => (
            <div key={String(u.uid)} className="w-48 shrink-0">
              <RemoteVideoTile user={u} label={`Participant ${u.uid}`} />
            </div>
          ))}
        </div>
      </div>
      <ControlBar onLeave={onLeave} onMuteVideo={onMuteVideo} onMuteAudio={onMuteAudio} />
    </div>
  )
}

function ControlBar({
  onLeave,
  onMuteVideo,
  onMuteAudio,
}: {
  onLeave: () => Promise<void>
  onMuteVideo: (muted: boolean) => void
  onMuteAudio: (muted: boolean) => void
}) {
  const [videoMuted, setVideoMuted] = useState(false)
  const [audioMuted, setAudioMuted] = useState(false)

  return (
    <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => {
          const nextMuted = !videoMuted
          setVideoMuted(nextMuted)
          onMuteVideo(nextMuted)
        }}
        className={clsx(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          videoMuted ? 'bg-red-600/50 text-white' : 'bg-white/10 text-white hover:bg-white/20'
        )}
      >
        {videoMuted ? 'Camera off' : 'Camera on'}
      </button>
      <button
        type="button"
        onClick={() => {
          const nextMuted = !audioMuted
          setAudioMuted(nextMuted)
          onMuteAudio(nextMuted)
        }}
        className={clsx(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          audioMuted ? 'bg-red-600/50 text-white' : 'bg-white/10 text-white hover:bg-white/20'
        )}
      >
        {audioMuted ? 'Mic off' : 'Mic on'}
      </button>
      <button
        type="button"
        onClick={() => void onLeave()}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
      >
        Leave
      </button>
    </div>
  )
}
