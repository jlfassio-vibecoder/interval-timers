/**
 * Adapter component that plays either an Agora video track or a MediaStream.
 * Used by LeaderboardRow for unified Solo (MediaStream) and Social (Agora) video display.
 */
import { useEffect, useRef } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import type { AmrapVideoSource } from '@/types/amrap-session';

function isMediaStream(
  source: AmrapVideoSource
): source is MediaStream {
  return typeof MediaStream !== 'undefined' && source instanceof MediaStream;
}

export interface VideoSourcePlayerProps {
  /** Agora track (ICameraVideoTrack | IRemoteVideoTrack) or MediaStream */
  source: AmrapVideoSource;
  className?: string;
}

export default function VideoSourcePlayer({ source, className }: VideoSourcePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!source) return;

    if (isMediaStream(source)) {
      const video = videoRef.current;
      if (video) {
        video.srcObject = source;
      }
      return () => {
        // Only detach; do not stop tracks. Stream lifecycle is owned by the
        // session/caller. Stopping on unmount would kill camera/recording for
        // the entire session when a single tile unmounts (e.g. list re-render).
        if (video && video.srcObject === source) {
          video.srcObject = null;
        }
      };
    }

    // Agora track
    const container = containerRef.current;
    if (!container) return;
    const track = source as ICameraVideoTrack | IRemoteVideoTrack;
    track.play(container, { fit: 'cover' });
    return () => {
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [source]);

  if (isMediaStream(source)) {
    return (
      <div
        className={`absolute inset-0 h-full w-full ${className ?? ''}`}
        aria-hidden
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover ${className ?? ''}`}
      aria-hidden
    />
  );
}
