/**
 * Full-screen Daily Warmup overlay for AMRAP sessions.
 * Main area: warmup timer; host video as small 16:9 tile in timer sidebar with controls/instructions.
 * Synced via session state: when host starts, all clients see the timer.
 */
import { useMemo, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  IntervalTimerOverlay,
  useWarmupConfig,
} from '@interval-timers/timer-ui';
import { getProtocolAccent } from '@interval-timers/timer-core';
import type { HIITTimelineBlock } from '@interval-timers/types';
import type { WarmupExercise } from '@interval-timers/timer-ui';
import VideoTile from '@/components/VideoTile';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';

const WARMUP_ACCENT = getProtocolAccent('warmup');

interface DailyWarmupSessionOverlayProps {
  isOpen: boolean;
  onClose: () => Promise<void>;
  onStartWarmup: () => Promise<void>;
  isHost: boolean;
  hostVideoTrack?: ICameraVideoTrack | IRemoteVideoTrack | null;
  warmupStartedAt?: string | null;
  sessionId?: string;
  hostToken?: string | null;
}

export default function DailyWarmupSessionOverlay({
  isOpen,
  onClose,
  onStartWarmup,
  isHost,
  hostVideoTrack,
  warmupStartedAt,
}: DailyWarmupSessionOverlayProps) {
  const { exercises, durationPerExercise } = useWarmupConfig();

  // Freeze config on first render so timer doesn't jump
  const [frozenConfig, setFrozenConfig] = useState<{
    timeline: HIITTimelineBlock[];
    exercises: WarmupExercise[];
    durationPerExercise: number;
  } | null>(null);

  const warmupTimeline = useMemo((): HIITTimelineBlock[] => {
    const warmupDuration = exercises.length * durationPerExercise;
    return [
      {
        type: 'warmup',
        duration: warmupDuration,
        name: 'Daily Warm Up',
        notes: 'Joint mobility & activation',
      },
      { type: 'cooldown', duration: 30, name: 'Cool Down', notes: 'Take a breath' },
    ];
  }, [exercises.length, durationPerExercise]);

  // When overlay opens, freeze config once. Reset when closed. Defer setState to avoid sync setState in effect.
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setFrozenConfig(null), 0);
      return () => clearTimeout(t);
    }
    if (!frozenConfig) {
      const config = {
        timeline: warmupTimeline,
        exercises: [...exercises],
        durationPerExercise,
      };
      const t = setTimeout(() => setFrozenConfig(config), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, frozenConfig, warmupTimeline, exercises, durationPerExercise]);

  const handleClose = useCallback(() => onClose(), [onClose]);
  const handleStartWarmup = useCallback(() => onStartWarmup(), [onStartWarmup]);

  const timerStarted = Boolean(warmupStartedAt);
  const showStartButton = !timerStarted && isHost;

  if (!isOpen || typeof document === 'undefined') return null;

  const hostVideoSlot = (
    <div className="w-full shrink-0">
      <VideoTile videoTrack={hostVideoTrack ?? null} label="Host" />
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#0d0500]">
      {timerStarted && frozenConfig ? (
        <IntervalTimerOverlay
          timeline={frozenConfig.timeline}
          onClose={handleClose}
          hideClose={!isHost}
          theme={{ workBg: WARMUP_ACCENT.workBg }}
          warmupExercises={frozenConfig.exercises}
          warmupDurationPerExercise={frozenConfig.durationPerExercise}
          hideSkipWarmup
          autoStart
          sidebarSlot={hostVideoSlot}
        />
      ) : (
        <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8">
          {isHost && (
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10"
              aria-label="Close warmup overlay"
            >
              Close
            </button>
          )}
          <h2 className="font-display text-2xl font-bold text-white">
            Daily Warm-Up
          </h2>
          {showStartButton ? (
            <>
              <p className="max-w-md text-center text-white/80">
                Joint mobility and activation. Click Start to begin for everyone in the session.
              </p>
              <button
                type="button"
                onClick={handleStartWarmup}
                className="rounded-xl bg-[#ffbf00] px-8 py-3 font-bold text-black shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-[#ffcc33]"
              >
                Start Daily Warm-Up
              </button>
            </>
          ) : (
            <p className="text-white/70">
              Waiting for host to start…
            </p>
          )}
        </main>
      )}
    </div>,
    document.body
  );
}
