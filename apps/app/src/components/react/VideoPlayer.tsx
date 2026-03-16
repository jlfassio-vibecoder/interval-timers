/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VideoOff } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [videoUrl]);

  if (!videoUrl) return null;

  return (
    <div className="group/video relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-[#ffbf00]/30 bg-black shadow-2xl">
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded border border-[#ffbf00]/20 bg-black/60 px-3 py-1 backdrop-blur-md">
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_red]" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffbf00]">
          Neural Feed
        </span>
      </div>
      {hasError ? (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black text-white/60"
          aria-label="Video unavailable"
        >
          <VideoOff className="h-10 w-10 text-white/40" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-wider">Video unavailable</span>
        </div>
      ) : (
        <video
          src={videoUrl}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          controls
          controlsList="nodownload"
          aria-label="Exercise demonstration video"
          onError={() => setHasError(true)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 border-[8px] border-black/10" />
    </div>
  );
};

export default VideoPlayer;
