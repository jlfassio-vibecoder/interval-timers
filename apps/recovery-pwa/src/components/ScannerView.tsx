import { useEffect, useRef, useState, useCallback } from 'react';

const TICK_MS = 33; // ~30 fps
const STABLE_DURATION_MS = 4000;
const BPM_TOLERANCE = 5;
const BPM_CHECK_INTERVAL_MS = 500;
const SIGNAL_LOSS_RESET_MS = 1000;
const CONSISTENCY_WINDOW_COUNT = 4;
const MAX_SCAN_MS = 60000;
const MAX_SAMPLES = Math.ceil((10000 / TICK_MS) * 1.2); // ~10s rolling window
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 150;
const SAMPLE_REGION_SIZE = 80;
const MIN_BPM = 40;
const MAX_BPM = 120;
const MIN_INTERVAL_MS = 60000 / MAX_BPM; // 500ms - rejects half-intervals (dicrotic), max 120 BPM
const MAX_INTERVAL_MS = 60000 / MIN_BPM; // 1500ms for 40 BPM

type ScannerState = 'requesting' | 'ready' | 'scanning' | 'error';

interface Sample {
  timestamp: number;
  redMean: number;
  greenMean: number;
}

function computeBpmFromPeaks(samples: Sample[], useGreen: boolean): number | null {
  if (samples.length < 30) return null;

  const values = samples.map((s) => (useGreen ? s.greenMean : s.redMean));
  const times = samples.map((s) => s.timestamp);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  if (range < 0.5) return null;
  const prominence = Math.max(range * 0.025, 1.5);
  const peaks: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v >= values[i - 1] &&
      v >= values[i - 2] &&
      v >= values[i + 1] &&
      v >= values[i + 2] &&
      v >= minValue + prominence
    ) {
      peaks.push(times[i]);
    }
  }

  if (peaks.length < 3) return null;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i] - peaks[i - 1];
    if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
      intervals.push(interval);
    }
  }

  if (intervals.length < 2) return null;

  const sorted = [...intervals].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const iqr = q3 - q1;
  let filtered = intervals.filter(
    (x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr
  );
  if (filtered.length < 2) return null;

  const med = median(filtered);
  filtered = filtered.filter(
    (x) => x >= med * 0.65 && x <= med * 1.5
  );
  if (filtered.length < 2) return null;

  const intervalEstimate = median(filtered);
  const bpm = Math.round(60000 / intervalEstimate);
  if (bpm >= MIN_BPM && bpm <= MAX_BPM) return bpm;
  return null;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function resolveBpm(green: number | null, red: number | null): number | null {
  if (green === null && red === null) return null;
  if (green === null) return red;
  if (red === null) return green;
  const [lo, hi] = green <= red ? [green, red] : [red, green];
  if (hi >= lo * 1.7 && hi <= lo * 2.3) return lo;
  return green;
}

function areReadingsConsistent(readings: { bpm: number }[], tolerance: number): boolean {
  if (readings.length < CONSISTENCY_WINDOW_COUNT) return false;
  const last = readings.slice(-CONSISTENCY_WINDOW_COUNT);
  const values = last.map((r) => r.bpm);
  const med = median(values);
  return values.every((v) => Math.abs(v - med) <= tolerance);
}

export interface ScannerViewProps {
  onComplete: (finalHr: number) => void;
}

export default function ScannerView({ onComplete }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const samplesRef = useRef<Sample[]>([]);
  const recentBpmReadingsRef = useRef<{ bpm: number; timestamp: number }[]>([]);
  const stableStartTimeRef = useRef<number | null>(null);
  const lastBpmCheckRef = useRef<number>(0);
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
    lastNullBpmTimeRef.current = null;
    setProgress(0);
    setStatus('Detecting pulse...');
    setBpm(null);
    setSignalStrength('none');
    setFrameCount(0);
    setShowMaxTimeoutHint(false);
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
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
          setErrorMessage('Camera access required. Allow access and try again.');
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
      setShowMaxTimeoutHint(false);
      samplesRef.current = [];
      recentBpmReadingsRef.current = [];
      stableStartTimeRef.current = null;
      lastBpmCheckRef.current = 0;
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

            if (areReadingsConsistent(readings, BPM_TOLERANCE)) {
              const stableStart = stableStartTimeRef.current ?? now;
              stableStartTimeRef.current = stableStart;
              const stableElapsed = now - stableStart;
              setProgress(Math.min(100, (stableElapsed / STABLE_DURATION_MS) * 100));
              if (stableElapsed >= STABLE_DURATION_MS) {
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
            setStatus('Adjust finger - cover lens fully');
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
        setProgress(Math.min(100, (stableElapsed / STABLE_DURATION_MS) * 100));
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
  }, [state, onComplete, stopStream]);

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
        <div className="flex-grow flex items-center justify-center">
          <button
            type="button"
            onClick={retry}
            className="py-4 px-8 bg-orange text-white rounded-2xl font-black text-lg active:scale-95 transition-transform"
          >
            Try Again
          </button>
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
        <div className="z-20 text-center mt-32 flex flex-col items-center">
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
        <p className="text-center text-xs text-zinc-500 uppercase tracking-widest font-bold">
          {status}
        </p>
        {showMaxTimeoutHint && state === 'scanning' && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-amber-400/90 text-sm text-center">
              Having trouble? Try adjusting your finger position.
            </p>
            <button
              type="button"
              onClick={resetScan}
              className="py-2 px-6 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
