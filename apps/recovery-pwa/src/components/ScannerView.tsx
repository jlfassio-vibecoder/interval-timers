import { useEffect, useRef, useState, useCallback } from 'react';

const SCAN_DURATION_MS = 15000;
const TICK_MS = 33; // ~30 fps
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 150;
const SAMPLE_REGION_SIZE = 80;
const MIN_BPM = 40;
const MAX_BPM = 200;
const MIN_INTERVAL_MS = 60000 / MAX_BPM; // 300ms for 200 BPM
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
  const prominence = Math.max(range * 0.008, 0.5);
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

  const avgInterval =
    intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60000 / avgInterval);
  if (bpm >= MIN_BPM && bpm <= MAX_BPM) return bpm;
  return null;
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

  const [state, setState] = useState<ScannerState>('requesting');
  const [torchSupported, setTorchSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Requesting camera...');
  const [bpm, setBpm] = useState<number | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const retry = useCallback(() => {
    setState('requesting');
    setErrorMessage('');
    setTorchSupported(true);
    setProgress(0);
    setStatus('Requesting camera...');
    setBpm(null);
    samplesRef.current = [];
  }, []);

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

        video.onloadedmetadata = () => {
          video.play().catch((e) => {
            if (!cancelled) console.warn('Video play failed:', e);
          });
        };

        video.onplaying = async () => {
          if (cancelled) return;
          const track = stream.getVideoTracks()[0];
          if (track && 'applyConstraints' in track) {
            try {
              await track.applyConstraints({
                advanced: [{ torch: true } as MediaTrackConstraintSet],
              });
              setTorchSupported(true);
            } catch {
              setTorchSupported(false);
            }
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            if (isIOS && track.getCapabilities && 'zoom' in track.getCapabilities()) {
              try {
                await track.applyConstraints({ advanced: [{ zoom: 0.5 } as MediaTrackConstraintSet] });
              } catch {
                /* zoom constraint not applicable, continue */
              }
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
      stopStream();
    };
  }, [state, stopStream]);

  useEffect(() => {
    if (state !== 'ready') return;

    const timeoutId = setTimeout(() => {
      setState('scanning');
      setProgress(0);
      setStatus('Detecting pulse...');
      samplesRef.current = [];
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
    const maxSamples = Math.ceil((SCAN_DURATION_MS / TICK_MS) * 1.2);
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_REGION_SIZE;
    sampleCanvas.height = SAMPLE_REGION_SIZE;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return () => cancelAnimationFrame(animationRef.current);

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= SCAN_DURATION_MS) {
        cancelAnimationFrame(animationRef.current);
        const samples = samplesRef.current;
        const computedBpm = computeBpmFromPeaks(samples, true) ?? computeBpmFromPeaks(samples, false);
        if (computedBpm !== null) {
          onComplete(computedBpm);
        } else {
          setState('error');
          const msg = samples.length < 10
            ? 'Camera frames not received. Ensure you\'re using the rear camera and refresh the page.'
            : 'Low signal. Keep finger still, cover lens fully, and try again.';
          setErrorMessage(msg);
        }
        stopStream();
        return;
      }

      const percent = Math.min(100, (elapsed / SCAN_DURATION_MS) * 100);
      setProgress(percent);

      if (percent > 20) setStatus('Analyzing red channel...');
      if (percent > 60) setStatus('Calculating BPM...');

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
        if (samplesRef.current.length > maxSamples) {
          samplesRef.current.shift();
        }

        const liveBpm = computeBpmFromPeaks(samplesRef.current, true) ?? computeBpmFromPeaks(samplesRef.current, false);
        if (liveBpm !== null) setBpm(liveBpm);

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
        {!torchSupported && state !== 'requesting' && (
          <p className="text-amber-400/90 text-xs mt-2 max-w-[280px] mx-auto">
            On iPhone: Swipe down, tap flashlight to turn it on, then place finger over rear camera.
          </p>
        )}
      </header>

      <div className="camera-simulation flex-grow mb-8 flex flex-col items-center justify-center relative min-h-[280px]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          width={320}
          height={240}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
          style={{ minWidth: 320, minHeight: 240 }}
          aria-hidden
        />
        <div className="camera-pulse" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute z-10 w-full max-w-[300px] h-32 opacity-80"
          aria-hidden="true"
        />
        <div className="z-20 text-center mt-32">
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
      </div>
    </section>
  );
}
