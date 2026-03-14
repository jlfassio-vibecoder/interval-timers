# ScannerView SWOT Analysis

## Overview

`ScannerView` is a React component in the Recovery PWA that captures PPG (photoplethysmography) heart rate via the device camera. Users place their finger over the rear camera; the component samples red/green channel intensity and derives BPM from peak intervals. It uses an adaptive completion model: it runs until readings are consistent for 4 seconds, resets on signal loss or inconsistency, and cues the user to adjust.

---

## Strengths

| Strength | Description |
|----------|-------------|
| **Adaptive completion** | No fixed scan duration. Completes when BPM is stable (±5 BPM) for 4 seconds, improving reliability over time-based scanning. |
| **Reset-on-inconsistency** | Aligns with real-time HR monitors: resets when signal is lost (≥1s without BPM) or when readings vary outside tolerance, prompting the user to adjust. |
| **Dual-channel PPG** | Uses green channel first (typically better for PPG), falls back to red. More robust across devices and skin tones. |
| **Rich user feedback** | Status badge (Align lens / Finding signal... / Adjust finger / Tracking), live BPM, progress bar, and status text guide the user. |
| **Camera active indicator** | Green "Camera on" badge confirms the stream is active after permission grant. |
| **iOS-specific handling** | Torch + zoom constraints applied together to avoid torch being cleared; zoom (0.5) targets ultra-wide lens to reduce lens switching. |
| **Live preview** | Video feed visible during ready/scanning so users can verify finger placement. |
| **Max timeout with reset** | 60s safety limit with "Having trouble?" message and Reset button; camera stays on and user can retry without full reload. |
| **Proper stream lifecycle** | Effect cleanup only cancels in-flight requests; stream is stopped only on retry, completion, or unmount. |
| **Median-based final value** | Uses median of last 4 consistent BPM readings instead of latest value, reducing impact of spikes. |

---

## Weaknesses

| Weakness | Description |
|----------|-------------|
| **Basic peak detection** | Simple local-max + prominence; no bandpass/bandstop, no motion artifact handling. More susceptible to noise than signal-processing approaches. |
| **No interval outlier filtering** | Uses mean interval for BPM instead of filtered median; removed IQR-based interval filtering compared to main branch, which may allow dicrotic peaks to skew results. |
| **Prominence may be too low** | `range * 0.008` with min 0.5 can accept weak/noisy peaks; could increase false BPM or sensitivity to environmental light. |
| **Single sampling region** | Fixed 80×80 center crop; no adaptation for different resolutions or lens layouts across devices. |
| **Torch support varies** | `applyConstraints` for torch fails on many devices; manual flashlight instructions shown but not enforced. |
| **No calibration** | No skin-tone or ambient-light calibration; literature shows demographic and lighting affect PPG accuracy. |
| **Large component** | ~430 lines with mixed concerns (camera, PPG algorithm, UI, lifecycle); harder to test and maintain. |
| **Constants are global** | BPM tolerance, stable duration, etc. not configurable via props. |
| **Limited offline/fallback** | ScannerView still requires camera input; manual BPM entry is available only via a separate `ManualBpmView` when camera use is not possible or preferred. |

---

## Opportunities

| Opportunity | Description |
|-------------|-------------|
| **Advanced signal processing** | Add bandpass filter (e.g., 0.5–5 Hz), detrending, or DWT/Kalman filtering to improve robustness under motion and ambient light. |
| **Restore interval filtering** | Reintroduce IQR or similar filtering on intervals to reject dicrotic/secondary peaks and improve BPM stability. |
| **Green/red fusion** | Restore or refine `resolveBpm` logic (e.g., harmonic check) instead of simple green-then-red fallback. |
| **Configurable parameters** | Expose `STABLE_DURATION_MS`, `BPM_TOLERANCE`, etc. as props for A/B testing or accessibility tuning. |
| **Signal quality index** | Compute and display a quality score (e.g., SNR, peak regularity) to guide users and gate completion. |
| **Extract PPG logic** | Move `computeBpmFromPeaks`, `areReadingsConsistent`, etc. into a small module for unit testing and reuse. |
| **Accessibility** | Add manual BPM input as fallback, screen reader announcements for state changes, and high-contrast mode. |
| **Analytics hooks** | Add optional callbacks for frame count, time-to-completion, resets, and failure reasons for product insights. |
| **Tunable prominence** | Make prominence threshold adaptive or sensor-dependent instead of fixed. |

---

## Threats

| Threat | Description |
|--------|--------------|
| **iOS Safari limits** | Video→canvas behavior and frame updates can differ; torch/zoom support is limited; lens switching on multi-camera iPhones can break consistency. |
| **PWA camera restrictions** | Add-to-home-screen PWAs on iOS run in WebView; camera access can be blocked or behave differently from Safari. |
| **Browser changes** | Future privacy or security changes may restrict camera, torch, or video streaming. |
| **Low-light environments** | Dim conditions reduce PPG signal strength and worsen noise; no automatic gain or exposure hints. |
| **Device fragmentation** | Different sensors, resolutions, and color handling across phones; algorithm tuned for common cases may fail on outliers. |
| **Medical/liability** | PPG is not FDA-cleared; results can be inaccurate. Need clear disclaimers and “not medical advice” language. |
| **User motion** | Light finger movement causes motion artifacts; no accelerometer or motion compensation like research-grade apps. |

---

## Summary

| Category | Summary |
|-----------|----------|
| **Strengths** | Adaptive completion, reset behavior, and rich feedback make the flow closer to commercial HR apps. iOS handling and stream lifecycle are well-considered. |
| **Weaknesses** | Basic signal processing and lack of interval filtering may hurt accuracy. Component size and hardcoded constants limit flexibility. |
| **Opportunities** | Strong gains possible from better filtering, modularization, and configurable parameters. |
| **Threats** | Platform and environmental limits; need clear medical disclaimers and fallbacks. |
