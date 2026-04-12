/**
 * Shared AMRAP timer display. Renders phase label, title, subtext, and time value.
 * Used by both Solo and Social session views.
 */
import React, { type ReactNode } from 'react';

export type AmrapTimerPhase = 'waiting' | 'setup' | 'work' | 'finished';

export interface AmrapTimerDisplayProps {
  phase: AmrapTimerPhase;
  displayLabel: string;
  displayTitle: string;
  displaySub?: string;
  displayValue: string;
  /** When true, uses compact text styling (e.g. for scheduled/countdown display) */
  beforeCountdownWindow?: boolean;
  showStartButton?: boolean;
  onStart?: () => void;
  /** Optional wrapper className (e.g. for bg color) */
  containerClassName?: string;
  /** Optional content to render below the timer value (e.g. work phase controls, "Work complete") */
  children?: React.ReactNode;
  /**
   * When set (or with `stackStartWithClockAside`), renders a row: left column | label+clock | right column.
   * Used for layouts that place optional content beside the main clock.
   */
  clockAsideLeft?: React.ReactNode;
  clockAsideRight?: React.ReactNode;
  /** When true with `showStartButton`, renders Start in the left column above `clockAsideLeft`. */
  stackStartWithClockAside?: boolean;
  /**
   * Host controls (e.g. pause / finish) shown above the countdown in the **left** column when
   * `embedHostAndTimerInLeftColumn` is true. Ignored otherwise.
   */
  beforeMainClock?: React.ReactNode;
  /**
   * Trainer Live embed (setup/work): left column = `beforeMainClock` then countdown;
   * center = `children` (e.g. LOG ROUND); right = `clockAsideRight` (rounds). Waiting/Start uses the default aside row.
   */
  embedHostAndTimerInLeftColumn?: boolean;
  /**
   * Trainer Live embed: when `embedHostAndTimerInLeftColumn` is true, use a 4-column row (host + optional center)
   * or a 2-column row (timer card | rounds card) for participants without host controls — avoids an empty center gutter.
   */
  embedMetricsVariant?: 'hostFourColumn' | 'participantTwoColumn';
  /**
   * Rendered before `displaySub` in the title row (e.g. Trainer Live Me/Leader video background toggle).
   * Stacks above the subtitle on narrow viewports; sits to its left in a row when wider.
   */
  titleBarAccessoryBeforeSub?: ReactNode;
  /**
   * Trainer Live embed: keep the timer chrome over the live video backdrop (no full opaque card on the
   * outer wrapper). Inner blocks use semi-transparent surfaces (`EMBED_METRIC_CARD_SURFACE`) instead.
   */
  liveEmbedOverVideo?: boolean;
  /**
   * Trainer Live **client** embed: main duration card is left-aligned, square, with label/time centered
   * inside (used when the simple centered `max-w-lg` clock row would apply).
   */
  liveEmbedClientSquareClock?: boolean;
  /**
   * Embed left column: override label (e.g. WORK / REST) and main time color (Tabata work=red, rest=green).
   * When unset, uses default AMRAP phase colors.
   */
  embedMainClockLabelClassName?: string;
  embedMainClockValueClassName?: string;
}

/** Matches exercise list cards (`AmrapExerciseListEditor` / `AmrapExerciseList`). */
const EMBED_METRIC_CARD_SURFACE =
  'rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4';

function getTimerBg(phase: AmrapTimerPhase): string {
  switch (phase) {
    case 'setup':
      return 'bg-stone-800';
    case 'work':
      return 'bg-orange-600';
    case 'finished':
      return 'bg-stone-900';
    default:
      return 'bg-stone-800';
  }
}

export default function AmrapTimerDisplay({
  phase,
  displayLabel,
  displayTitle,
  displaySub,
  displayValue,
  beforeCountdownWindow = false,
  showStartButton = false,
  onStart,
  containerClassName,
  children,
  clockAsideLeft,
  clockAsideRight,
  stackStartWithClockAside = false,
  beforeMainClock,
  embedHostAndTimerInLeftColumn = false,
  embedMetricsVariant = 'hostFourColumn',
  titleBarAccessoryBeforeSub,
  embedMainClockLabelClassName,
  embedMainClockValueClassName,
  liveEmbedOverVideo = false,
  liveEmbedClientSquareClock = false,
}: AmrapTimerDisplayProps) {
  const bg = containerClassName ?? getTimerBg(phase);
  const isTimeValue = /^\d{1,2}:\d{2}$/.test(displayValue);

  const useClockAsideRow =
    clockAsideLeft != null ||
    clockAsideRight != null ||
    (stackStartWithClockAside && showStartButton);

  const startButtonEl =
    showStartButton && onStart ? (
      <button
        type="button"
        onClick={onStart}
        className="mt-8 w-full max-w-[14rem] rounded-2xl bg-orange-600 px-[4.5rem] py-6 text-[1.875rem] font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500"
      >
        Start
      </button>
    ) : null;

  const labelAndClockEmbed = (
    <div className="flex w-full flex-col items-center text-center">
      <div
        className={
          embedMainClockLabelClassName && embedMainClockLabelClassName.length > 0
            ? embedMainClockLabelClassName
            : 'mb-2 text-[15px] font-bold uppercase tracking-widest opacity-80'
        }
      >
        {displayLabel}
      </div>
      <div
        className={
          beforeCountdownWindow
            ? 'flex w-full min-w-0 justify-center overflow-hidden text-center font-bold tabular-nums text-[2.25rem] text-white/90 md:text-[2.8125rem]'
            : embedMainClockValueClassName && embedMainClockValueClassName.length > 0
              ? `flex w-full min-w-0 justify-center overflow-hidden text-center font-bold tabular-nums ${embedMainClockValueClassName}`
              : `flex w-full min-w-0 justify-center overflow-hidden text-center font-bold tabular-nums font-mono ${
                  phase === 'work' ? 'text-orange-500' : 'text-white/90'
                }`
        }
        style={!beforeCountdownWindow ? { containerType: 'inline-size' } : undefined}
      >
        {beforeCountdownWindow ? (
          displayValue
        ) : (
          <span
            style={
              isTimeValue
                ? { fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }
                : undefined
            }
            className={!isTimeValue ? 'text-[clamp(1.5rem,5vmin,4rem)]' : undefined}
          >
            {displayValue}
          </span>
        )}
      </div>
      {!(stackStartWithClockAside && showStartButton) && startButtonEl}
    </div>
  );

  const labelAndClock = (
    <div className="flex w-full flex-col items-center text-center">
      <div className="mb-2 text-[15px] font-bold uppercase tracking-widest opacity-80">
        {displayLabel}
      </div>
      <div
        className={`w-full overflow-hidden min-w-0 font-bold tabular-nums ${
          beforeCountdownWindow
            ? 'text-[2.25rem] text-white/90 md:text-[2.8125rem]'
            : `font-mono ${phase === 'work' ? 'text-orange-500' : 'text-white/90'}`
        }`}
        style={!beforeCountdownWindow ? { containerType: 'inline-size' } : undefined}
      >
        {beforeCountdownWindow ? (
          displayValue
        ) : (
          <span
            style={
              isTimeValue
                ? { fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }
                : undefined
            }
            className={!isTimeValue ? 'text-[clamp(1.5rem,5vmin,4rem)]' : undefined}
          >
            {displayValue}
          </span>
        )}
      </div>
      {!(stackStartWithClockAside && showStartButton) && startButtonEl}
    </div>
  );

  const mainClockArea = (
    <div className="flex h-full w-full flex-col items-center justify-between">
      {labelAndClock}
      {children && <div className="mt-0 w-full flex-grow">{children}</div>}
    </div>
  );

  const embedLeftColumnStack = (
    <>
      {beforeMainClock}
      {labelAndClockEmbed}
    </>
  );

  const embedSplitLayout = embedHostAndTimerInLeftColumn && useClockAsideRow;
  const transparentOuter = embedSplitLayout || liveEmbedOverVideo;

  const subTextClass = `text-sm font-medium opacity-90 ${
    embedSplitLayout ? 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]' : ''
  }`;

  const titleBarTrailing =
    titleBarAccessoryBeforeSub != null ? (
      <div className="flex w-full min-w-0 flex-col items-end gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-end sm:gap-3">
        {titleBarAccessoryBeforeSub}
        {displaySub ? (
          <p className={`text-right ${subTextClass}`}>{displaySub}</p>
        ) : null}
      </div>
    ) : displaySub ? (
      <p className={`text-right ${subTextClass}`}>{displaySub}</p>
    ) : (
      <span />
    );

  const titleRowClassName =
    titleBarAccessoryBeforeSub != null
      ? `flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${
          embedSplitLayout ? 'mb-4 px-0.5' : ''
        }`
      : `flex items-baseline justify-between gap-4 ${
          embedSplitLayout ? 'mb-4 px-0.5' : ''
        }`;

  const embedTitleGrid = (
    <div className="mb-4 grid w-full grid-cols-1 gap-3 px-0.5 sm:grid-cols-2 sm:items-start sm:gap-4">
      <h2
        className={`min-w-0 font-display text-2xl font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] ${
          titleBarAccessoryBeforeSub != null ? 'sm:max-w-[min(100%,28rem)] sm:pr-2' : ''
        }`}
      >
        {displayTitle}
      </h2>
      <div className="flex flex-col items-center gap-2 text-center">
        {titleBarAccessoryBeforeSub != null ? (
          <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {titleBarAccessoryBeforeSub}
          </div>
        ) : null}
        {displaySub ? (
          <p className={`max-w-sm ${subTextClass} text-balance text-center`}>{displaySub}</p>
        ) : null}
      </div>
    </div>
  );

  const titleShadow = liveEmbedOverVideo ? 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]' : '';
  const titleShadowOrEmbed = liveEmbedOverVideo
    ? titleShadow
    : 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]';

  /** Matches `participantTwoColumn` metric row widths so titles sit centered over each card. */
  const embedParticipantMetricTitleRow =
    embedMetricsVariant === 'participantTwoColumn' && titleBarAccessoryBeforeSub == null ? (
      <div className="mb-4 flex w-full flex-row items-start gap-3 sm:gap-4 px-0.5">
        <div className="flex w-[min(46%,12.5rem)] shrink-0 justify-center sm:w-[13rem]">
          <h2 className={`min-w-0 w-full text-center font-display text-2xl font-bold ${titleShadowOrEmbed}`}>
            {displayTitle}
          </h2>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-end justify-start">
          {displaySub ? (
            <p className={`max-w-[13rem] w-full text-center ${subTextClass}`}>{displaySub}</p>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <div
      className={
        transparentOuter
          ? 'w-full bg-transparent p-0'
          : `rounded-2xl border border-white/10 ${bg} p-6 transition-colors duration-300`
      }
    >
      {embedSplitLayout ? (
        embedParticipantMetricTitleRow ?? embedTitleGrid
      ) : (
        <div className={titleRowClassName}>
          <h2
            className={`min-w-0 font-display text-2xl font-bold ${titleShadow} ${
              titleBarAccessoryBeforeSub != null ? 'sm:max-w-[min(100%,28rem)] sm:pr-2' : ''
            }`}
          >
            {displayTitle}
          </h2>
          {titleBarTrailing}
        </div>
      )}

      {useClockAsideRow ? (
        embedHostAndTimerInLeftColumn ? (
          embedMetricsVariant === 'participantTwoColumn' ? (
            <div className="mt-2 flex w-full flex-row items-start gap-3 sm:gap-4">
              <div
                className={`${EMBED_METRIC_CARD_SURFACE} flex aspect-square w-[min(46%,12.5rem)] shrink-0 flex-col justify-center overflow-hidden sm:w-[13rem]`}
              >
                {embedLeftColumnStack}
              </div>
              {clockAsideRight != null ? (
                <div className="flex min-w-0 flex-1 flex-col items-end justify-start">
                  <div
                    className={`${EMBED_METRIC_CARD_SURFACE} flex aspect-square w-full max-w-[13rem] flex-col items-center justify-center gap-2 overflow-hidden p-3 sm:p-4`}
                  >
                    {clockAsideRight}
                  </div>
                </div>
              ) : (
                <div className="min-w-0 shrink-0" aria-hidden />
              )}
            </div>
          ) : (
            <div className="mt-2 grid w-full grid-cols-4 items-stretch gap-4 sm:gap-6">
              <div className="col-span-1 flex min-h-0 min-w-0 flex-col items-start justify-start text-left">
                <div
                  className={`${EMBED_METRIC_CARD_SURFACE} flex min-h-0 w-full flex-col gap-3 ${
                    beforeMainClock ? 'min-h-[14rem] justify-start overflow-y-auto' : 'aspect-square justify-center overflow-hidden'
                  }`}
                >
                  {embedLeftColumnStack}
                </div>
              </div>
              <div className="col-span-2 flex min-h-0 min-w-0 flex-col items-center justify-end self-stretch bg-transparent">
                {children && (
                  <div className="flex w-full min-w-0 flex-col items-center px-1">
                    {children}
                  </div>
                )}
              </div>
              {clockAsideRight != null ? (
                <div className="col-span-1 flex h-full min-w-0 flex-col items-end justify-start">
                  <div
                    className={`${EMBED_METRIC_CARD_SURFACE} flex w-full max-w-[13rem] flex-col items-center justify-center gap-3 py-4`}
                  >
                    {clockAsideRight}
                  </div>
                </div>
              ) : (
                <div className="col-span-1 min-w-0" aria-hidden />
              )}
            </div>
          )
        ) : (
          <div className="mt-8 grid w-full grid-cols-4 items-start gap-4 sm:gap-6">
            <div className="col-span-1 flex min-h-0 min-w-0 flex-col items-center justify-start gap-3 text-left">
              {stackStartWithClockAside && showStartButton && onStart && (
                <button
                  type="button"
                  onClick={onStart}
                  className="w-full max-w-[14rem] rounded-2xl bg-orange-600 px-6 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500 sm:py-6 sm:text-xl"
                >
                  Start
                </button>
              )}
              {clockAsideLeft}
            </div>
            <div className="col-span-2 min-w-0 flex flex-col justify-start self-stretch">
              {mainClockArea}
            </div>
            {clockAsideRight != null ? (
              <div className="col-span-1 flex h-full min-w-0 flex-col items-center justify-start">
                {clockAsideRight}
              </div>
            ) : (
              <div className="col-span-1 min-w-0" aria-hidden />
            )}
          </div>
        )
      ) : (
        <div className={liveEmbedClientSquareClock ? 'mt-8' : 'mt-8 text-center'}>
          {liveEmbedOverVideo ? (
            <div
              className={`${EMBED_METRIC_CARD_SURFACE} flex flex-col justify-center ${
                liveEmbedClientSquareClock
                  ? 'ml-0 aspect-square w-[min(100%,13rem)] max-w-[13rem] shrink-0 sm:w-[13rem]'
                  : 'mx-auto max-w-lg'
              }`}
            >
              {mainClockArea}
            </div>
          ) : (
            mainClockArea
          )}
        </div>
      )}
    </div>
  );
}
