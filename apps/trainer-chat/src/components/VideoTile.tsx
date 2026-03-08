import { useEffect, useRef } from 'react'
import type { ICameraVideoTrack } from 'agora-rtc-sdk-ng'
import type { RemoteUserWithTracks } from '@/hooks/useAgoraChannel'

interface VideoTileProps {
  videoTrack?: ICameraVideoTrack | null
  label: string
  isLocal?: boolean
}

interface RemoteVideoTileProps {
  user: RemoteUserWithTracks
  label: string
}

function LocalVideoTile({ videoTrack, label }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return
    videoTrack.play(containerRef.current)
    return () => {
      videoTrack.stop()
    }
  }, [videoTrack])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-sm font-medium">
        {label}
      </div>
    </div>
  )
}

export function RemoteVideoTile({ user, label }: RemoteVideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const track = user.videoTrack

  useEffect(() => {
    if (!track || !containerRef.current) return
    track.play(containerRef.current)
    return () => {
      track.stop()
    }
  }, [track])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div ref={containerRef} className="h-full w-full" />
      {!track && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white/70">
          No video
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-sm font-medium">
        {label}
      </div>
    </div>
  )
}

export default LocalVideoTile
