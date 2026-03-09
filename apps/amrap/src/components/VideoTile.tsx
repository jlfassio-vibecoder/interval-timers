import { useEffect, useRef } from 'react'
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng'

interface VideoTileProps {
  videoTrack?: ICameraVideoTrack | IRemoteVideoTrack | null
  label?: string
  className?: string
}

/** Renders a video track (local or remote) in a container. Both track types support play(element) and stop(). */
export default function VideoTile({ videoTrack, label, className = '' }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return
    videoTrack.play(containerRef.current, { fit: 'cover' })
    return () => {
      try {
        videoTrack.stop()
      } catch {
        /* already stopped */
      }
    }
  }, [videoTrack])

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 ${className}`}
    >
      <div ref={containerRef} className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
      {!videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white/70">
          No video
        </div>
      )}
      {label && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-sm font-medium">
          {label}
        </div>
      )}
    </div>
  )
}
