import { describe, it, expect } from 'vitest';
import { computeElapsedSecForLogRound } from './socialAmrapUtils';

describe('computeElapsedSecForLogRound', () => {
  const base = {
    timerState: 'work' as const,
    isPaused: false,
    session: {
      started_at: '2020-01-01T00:00:00.000Z',
      timer_segment: 'amrap' as const,
    },
    totalTime: 900,
  };

  it('uses tick-based elapsed when it matches wall time on first round', () => {
    const nowMs = new Date('2020-01-01T00:01:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeft: 840,
      participantRoundCountInSegment: 0,
      nowMs,
    });
    expect(v).toBe(60);
  });

  it('on first round, raises elapsed when local clock still shows full time but work has started', () => {
    const nowMs = new Date('2020-01-01T00:01:30.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeft: 900,
      participantRoundCountInSegment: 0,
      nowMs,
    });
    expect(v).toBe(90);
  });

  it('does not use wall time after the first round in segment', () => {
    const nowMs = new Date('2020-01-01T00:05:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeft: 400,
      participantRoundCountInSegment: 1,
      nowMs,
    });
    expect(v).toBe(500);
  });

  it('skips wall correction when paused', () => {
    const nowMs = new Date('2020-01-01T00:10:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeft: 900,
      isPaused: true,
      participantRoundCountInSegment: 0,
      nowMs,
    });
    expect(v).toBe(0);
  });
});
