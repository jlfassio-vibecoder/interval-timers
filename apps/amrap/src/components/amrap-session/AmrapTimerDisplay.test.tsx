import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AmrapTimerDisplay from './AmrapTimerDisplay';

describe('AmrapTimerDisplay trainerLiveEmbed metrics', () => {
  const base = {
    phase: 'setup' as const,
    displayLabel: 'SETUP',
    displayTitle: 'Setup',
    displaySub: 'Get into position',
    displayValue: '00:08',
    embedHostAndTimerInLeftColumn: true,
    clockAsideRight: <div data-testid="rounds-slot">rounds</div>,
  };

  it('renders participant two-column metrics row (no empty center gutter)', () => {
    const { container } = render(
      <AmrapTimerDisplay
        {...base}
        embedMetricsVariant="participantTwoColumn"
      />
    );
    expect(container.querySelector('.grid-cols-4')).toBeNull();
    expect(container.querySelector('.mb-4.flex.w-full.flex-row.items-start')).toBeTruthy();
    expect(container.querySelectorAll('.aspect-square').length).toBe(2);
    expect(container.querySelector('[data-testid="rounds-slot"]')).toBeTruthy();
  });

  it('renders host four-column metrics row when embedMetricsVariant is hostFourColumn', () => {
    const { container } = render(
      <AmrapTimerDisplay
        {...base}
        embedMetricsVariant="hostFourColumn"
        beforeMainClock={<div>host-controls</div>}
      />
    );
    expect(container.querySelector('.grid-cols-4')).toBeTruthy();
  });
});
