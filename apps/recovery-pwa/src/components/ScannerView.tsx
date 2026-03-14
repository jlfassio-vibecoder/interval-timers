import { useEffect, useRef, useState, useCallback } from 'react';
import {
  computeBpmFromPeaks,
  resolveBpm,
  areReadingsConsistent,
  median,
  computeSignalQualityIndex,
  type Sample,
} from '../lib/ppg';

const TICK_MS = 33; // ~30 fps
const STABLE_DURATION_MS = 4000;
const BPM_TOLERANCE = 5;

function isIOSDevice(): boolean {
  return typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
const BPM_CHECK_INTERVAL_MS = 500;
const MAX_SQI_SAMPLES = 150; // limit SQI to last N samples; computed on BPM cadence to reduce per-frame CPU
const SIGNAL_LOSS_RESET_MS = 1000;
const CONSISTENCY_WINDOW_COUNT = 4;
const MAX_SCAN_MS = 60000;
const MAX_SAMPLES = Math.ceil((10000 / TICK_MS) * 1.2); // ~10s rolling window
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 150;
const SAMPLE_REGION_SIZE = 80;
const LOW_LIGHT_THRESHOLD = 80;

type ScannerState = 'requesting' | 'ready' | 'scanning' | 'error';

export interface ScannerViewProps {
  onComplete: (finalHr: number) => void;
  onManualEntry?: () => void;
  stableDurationMs?: number;
  bpmTolerance?: number;
}

export default function ScannerView({ onComplete, onManualEntry, stableDurationMs = STABLE_DURATION_MS, bpmTolerance = BPM_TOLERANCE }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const samplesRef = useRef<Sample[]>([]);
  const recentBpmReadingsRef = useRef<{ bpm: number; timestamp: number }[]>([]);
  const stableStartTimeRef = useRef<number | null>(null);
  const lastBpmCheckRef = useRef<number>(0);
  const lastSqiCheckRef = useRef<number>(0);
  const lastNonNullBpmTimeRef = useRef<number>(0);
  const lastNullBpmTimeRef = useRef<number | null>(null);

  const [state, setState] = useState<ScannerState>('requesting');
  const [torchSupported, setTorchSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Requesting camera...');
  const [bpm, setBpm] = useState<number | null>(null);
  const [signalStrength, setSignalStrength] = useState<'none' | 'weak' | 'good'>('none');
  const [frameCount, setFrameCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [showMaxTimeoutHint, setShowMaxTimeoutHint] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const resetScan = useCallback(() => {
    samplesRef.current = [];
    recentBpmReadingsRef.current = [];
    stableStartTimeRef.current = null;
    lastBpmCheckRef.current = 0;
    lastSqiCheckRef.current = 0;
    lastNullBpmTimeRef.current = null;
    setProgress(0);
    setStatus('Detecting pulse...');
    setBpm(null);
    setSignalStrength('none');
    setFrameCount(0);
    setShowMaxTimeoutHint(false);
    setSignalQuality(0);
  }, []);

  const retry = useCallback(() => {
    stopStream();
    setState('requesting');
    setErrorMessage('');
    setTorchSupported(true);
    setProgress(0);
    setStatus('Requesting camera...');
    setBpm(null);
    setSignalStrength('none');
    setFrameCount(0);
    setCameraActive(false);
    setShowMaxTimeoutHint(false);
    setSignalQuality(0);
    samplesRef.current = [];
    recentBpmReadingsRef.current = [];
    stableStartTimeRef.current = null;
  }, [stopStream]);

  useEffect(() => {
    if (state !== 'requesting') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setErrorMessage('Camera not available. Use HTTPS and a modern browser.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        setCameraActive(true);

        video.onloadedmetadata = () => {
          video.play().catch((e) => {
            if (!cancelled) console.warn('Video play failed:', e);
          });
        };

        video.onplaying = async () => {
          if (cancelled) return;
          const track = stream.getVideoTracks()[0];
          if (track && 'applyConstraints' in track) {
            const caps = track.getCapabilities?.() ?? {};
            const isIOS = isIOSDevice();
            const advanced: MediaTrackConstraintSet[] = [{ torch: true }];
            if (isIOS && 'zoom' in caps) {
              advanced[0].zoom = 0.5;
            }
            try {
              await track.applyConstraints({ advanced });
              setTorchSupported(true);
            } catch {
              setTorchSupported(false);
            }
          }
          setState('ready');
          setStatus('Place finger over rear camera. Hold still.');
        };
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setState('error');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage(isIOSDevice()
            ? 'Camera access required. If using "Add to Home Screen", try opening in Safari instead.'
            : 'Camera access required. Allow access and try again.');
        } else if (err.name === 'NotFoundError') {
          setErrorMessage('No camera found.');
        } else {
          setErrorMessage('Camera error. Please try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state, stopStream]);

  useEffect(() => {
    if (state !== 'ready') return;

    const timeoutId = setTimeout(() => {
      setState('scanning');
      setProgress(0);
      setStatus('Detecting pulse...');
      setSignalStrength('none');
      setFrameCount(0);
      setSignalQuality(0);
      setShowMaxTimeoutHint(false);
      samplesRef.current = [];
      recentBpmReadingsRef.current = [];
      stableStartTimeRef.current = null;
      lastBpmCheckRef.current = 0;
      lastSqiCheckRef.current = 0;
      lastNullBpmTimeRef.current = null;
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [state]);

  useEffect(() => {
    if (state !== 'scanning') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startTime = Date.now();
    let lastTick = startTime;
    let waveX = 0;
    const wavePoints: { x: number; y: number }[] = [];
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_REGION_SIZE;
    sampleCanvas.height = SAMPLE_REGION_SIZE;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return () => cancelAnimationFrame(animationRef.current);

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= MAX_SCAN_MS) {
        setShowMaxTimeoutHint(true);
      }

      if (now - lastTick >= TICK_MS && video.videoWidth > 0) {
        lastTick = now;

        const w = video.videoWidth;
        const h = video.videoHeight;
        const sx = Math.floor((w - SAMPLE_REGION_SIZE) / 2);
        const sy = Math.floor((h - SAMPLE_REGION_SIZE) / 2);

        sampleCtx.drawImage(
          video,
          sx,
          sy,
          SAMPLE_REGION_SIZE,
          SAMPLE_REGION_SIZE,
          0,
          0,
          SAMPLE_REGION_SIZE,
          SAMPLE_REGION_SIZE
        );
        const imageData = sampleCtx.getImageData(0, 0, SAMPLE_REGION_SIZE, SAMPLE_REGION_SIZE);
        const data = imageData.data;
        let redSum = 0;
        let greenSum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          redSum += data[i];
          greenSum += data[i + 1];
          count++;
        }
        const redMean = count > 0 ? redSum / count : 0;
        const greenMean = count > 0 ? greenSum / count : 0;

        samplesRef.current.push({ timestamp: now, redMean, greenMean });
        if (samplesRef.current.length > MAX_SAMPLES) {
          samplesRef.current.shift();
        }

        setFrameCount(samplesRef.current.length);
        const recent = samplesRef.current.slice(-60);
        if (recent.length >= 15) {
          const vals = recent.map((s) => (s.redMean + s.greenMean) / 2);
          const r = Math.max(...vals) - Math.min(...vals);
          setSignalStrength(r >= 1.5 ? 'good' : r >= 0.5 ? 'weak' : 'none');
        }
        if (now - lastSqiCheckRef.current >= BPM_CHECK_INTERVAL_MS) {
          lastSqiCheckRef.current = now;
          const sqiSamples = samplesRef.current.slice(-MAX_SQI_SAMPLES);
          setSignalQuality(computeSignalQualityIndex(sqiSamples));
        }

        const greenBpm = computeBpmFromPeaks(samplesRef.current, true);
        const redBpm = computeBpmFromPeaks(samplesRef.current, false);
        const liveBpm = resolveBpm(greenBpm, redBpm);

        if (liveBpm !== null) {
          setBpm(liveBpm);
          lastNonNullBpmTimeRef.current = now;
          lastNullBpmTimeRef.current = null;

          if (now - lastBpmCheckRef.current >= BPM_CHECK_INTERVAL_MS) {
            lastBpmCheckRef.current = now;
            const readings = recentBpmReadingsRef.current;
            readings.push({ bpm: liveBpm, timestamp: now });
            if (readings.length > 10) readings.shift();

            if (areReadingsConsistent(readings, bpmTolerance, CONSISTENCY_WINDOW_COUNT)) {
              const stableStart = stableStartTimeRef.current ?? now;
              stableStartTimeRef.current = stableStart;
              const stableElapsed = now - stableStart;
              setProgress(Math.min(100, (stableElapsed / stableDurationMs) * 100));
              if (stableElapsed >= stableDurationMs) {
                const lastReadings = readings.slice(-CONSISTENCY_WINDOW_COUNT);
                const medianBpm = Math.round(median(lastReadings.map((r) => r.bpm)));
                cancelAnimationFrame(animationRef.current);
                onComplete(medianBpm);
                stopStream();
                return;
              }
              const secs = (stableElapsed / 1000).toFixed(1);
              setStatus(stableElapsed > 2500 ? `Almost there... ${secs}s` : `Hold steady... ${secs}s`);
            } else {
              stableStartTimeRef.current = null;
              setProgress(0);
              setStatus('Hold steady - don\'t move');
            }
          }
        } else {
          if (lastNullBpmTimeRef.current === null) lastNullBpmTimeRef.current = now;
          const nullDuration = now - lastNullBpmTimeRef.current;
          if (nullDuration >= SIGNAL_LOSS_RESET_MS) {
            stableStartTimeRef.current = null;
            recentBpmReadingsRef.current = [];
            setProgress(0);
            const meanIntensity = (redMean + greenMean) / 2;
            const isLowLight = samplesRef.current.length >= 45 && meanIntensity < LOW_LIGHT_THRESHOLD;
            setStatus(isLowLight
              ? 'Improve lighting or cover lens fully with your finger'
              : 'Adjust finger - cover lens fully');
          }
        }

        const displayMean = (redMean + greenMean) / 2;
        const normY = 75 - (displayMean - 100) * 0.3;
        wavePoints.push({ x: waveX, y: Math.max(10, Math.min(140, normY)) });
        waveX += 3;
        if (waveX > CANVAS_WIDTH) {
          wavePoints.shift();
          wavePoints.forEach((p) => (p.x -= 3));
          waveX = CANVAS_WIDTH;
        }
      }

      if (stableStartTimeRef.current !== null && recentBpmReadingsRef.current.length >= CONSISTENCY_WINDOW_COUNT) {
        const stableElapsed = now - stableStartTimeRef.current;
        setProgress(Math.min(100, (stableElapsed / stableDurationMs) * 100));
        const secs = (stableElapsed / 1000).toFixed(1);
        setStatus(stableElapsed > 2500 ? `Almost there... ${secs}s` : `Hold steady... ${secs}s`);
      }

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (wavePoints.length >= 2) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wavePoints[0].x, wavePoints[0].y);
        for (let i = 1; i < wavePoints.length; i++) {
          ctx.lineTo(wavePoints[i].x, wavePoints[i].y);
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    animationRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [state, onComplete, stopStream, stableDurationMs, bpmTolerance]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  if (state === 'error') {
    return (
      <section className="view-section">
        <header className="text-center mt-4 mb-8">
          <h2 className="text-xl font-black">Scan Failed</h2>
          <p className="text-zinc-400 text-sm mt-1">{errorMessage}</p>
        </header>
        <div className="flex-grow flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={retry}
            className="py-4 px-8 bg-orange text-white rounded-2xl font-black text-lg active:scale-95 transition-transform"
          >
            Try Again
          </button>
          {onManualEntry && (
            <button
              type="button"
              onClick={onManualEntry}
              className="text-sm text-zinc-400 hover:text-orange-light underline"
            >
              Can&apos;t use camera? Enter manually
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="view-section">
      <header className="text-center mt-4 mb-8">
        <h2 className="text-xl font-black">Measuring Pulse...</h2>
        <p className="text-zinc-400 text-sm mt-1">
          {state === 'requesting'
            ? 'Allow camera access when prompted.'
            : state === 'ready'
              ? 'Place finger over rear camera. Hold still.'
              : 'Keep finger completely still'}
        </p>
        {cameraActive && (
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Camera on</span>
          </div>
        )}
        {!torchSupported && state !== 'requesting' && (
          <p className="text-amber-400/90 text-xs mt-2 max-w-[280px] mx-auto">
            On iPhone: Swipe down, tap flashlight to turn it on, then place finger over rear camera.
          </p>
        )}
      </header>

      <div className="camera-simulation flex-grow mb-8 flex flex-col items-center justify-center relative min-h-[280px] overflow-hidden rounded-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          width={320}
          height={240}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
            state === 'scanning' || state === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ minWidth: 320, minHeight: 240 }}
          aria-hidden
        />
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
            state === 'scanning' || state === 'ready' ? 'opacity-0' : 'opacity-100'
          }`}
          aria-hidden="true"
        >
          <div className="camera-pulse" />
        </div>
        {state === 'scanning' && (
          <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                signalStrength === 'good'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : signalStrength === 'weak'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-600/40 text-zinc-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  signalStrength === 'good'
                    ? 'bg-emerald-400 animate-pulse'
                    : signalStrength === 'weak'
                      ? 'bg-amber-400'
                      : 'bg-zinc-500'
                }`}
              />
              {signalStrength === 'good'
                ? 'Tracking'
                : signalStrength === 'weak'
                  ? 'Adjust finger'
                  : frameCount > 0
                    ? 'Finding signal...'
                    : 'Align lens'}
            </div>
            {frameCount > 0 && (
              <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                {frameCount} frames
                {signalQuality > 0 && (
                  <span className="ml-1">
                    · {signalQuality < 0.3 ? 'Poor' : signalQuality < 0.6 ? 'Weak' : 'Good'}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute z-10 w-full max-w-[300px] h-32 opacity-90"
          aria-hidden="true"
        />
        <div
          className="z-20 text-center mt-32 flex flex-col items-center"
          aria-live="polite"
          aria-label={bpm !== null ? `${bpm} beats per minute` : 'Waiting for heart rate'}
        >
          <span className="text-5xl font-black font-mono drop-shadow-lg">
            {bpm ?? '--'}
          </span>
          <span className="text-lg font-bold text-orange-light ml-1">BPM</span>
        </div>
      </div>

      <div className="mt-auto pb-8">
        <div className="w-full bg-zinc-800 rounded-full h-3 mb-4 overflow-hidden">
          <div
            className="bg-orange h-3 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p
          className="text-center text-xs text-zinc-500 uppercase tracking-widest font-bold"
          aria-live="polite"
          aria-atomic="true"
        >
          {status}
        </p>
        <p className="text-center text-[10px] text-zinc-600 mt-2">
          For fitness tracking only. Not a medical device.
        </p>
        {showMaxTimeoutHint && state === 'scanning' && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-amber-400/90 text-sm text-center">
              Having trouble? Try adjusting your finger position.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={resetScan}
                className="py-2 px-6 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
              >
                Reset
              </button>
              {onManualEntry && (
                <button
                  type="button"
                  onClick={onManualEntry}
                  className="py-2 px-6 text-zinc-400 hover:text-orange-light text-sm font-semibold underline"
                >
                  Enter manually
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
