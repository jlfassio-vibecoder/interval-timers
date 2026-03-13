import { useState, useCallback } from 'react';
import TimerView from './TimerView';
import ScannerView from './ScannerView';
import RpeView from './RpeView';
import LoadingView from './LoadingView';
import ResultsView from './ResultsView';

export type RecoveryView = 'landing' | 'scan' | 'rpe' | 'loading' | 'results';

export interface RecoveryEngineProps {
  sessionId: string | null;
  endTime: number;
}

export default function RecoveryEngine({ sessionId, endTime }: RecoveryEngineProps) {
  const [currentView, setCurrentView] = useState<RecoveryView>('landing');
  const [captureDelayMs, setCaptureDelayMs] = useState(0);
  const [finalHr, setFinalHr] = useState(0);
  const [rpeVal, setRpeVal] = useState(0);
  const [rpeText, setRpeText] = useState('');

  const effectiveEndTime = endTime > 0 ? endTime : Date.now() - 15000;

  const handleStartScan = useCallback(() => {
    setCaptureDelayMs(Date.now() - effectiveEndTime);
    setCurrentView('scan');
  }, [effectiveEndTime]);

  const handleScanComplete = useCallback((hr: number) => {
    setFinalHr(hr);
    setTimeout(() => setCurrentView('rpe'), 500);
  }, []);

  const handleRpeSubmit = useCallback((val: number, text: string) => {
    setRpeVal(val);
    setRpeText(text);
    setCurrentView('loading');
    setTimeout(() => setCurrentView('results'), 2500);
  }, []);

  const handleClose = useCallback(() => {
    alert('Data saved to main profile. You can close this window on your phone.');
  }, []);

  return (
    <>
      {currentView === 'landing' && (
        <TimerView endTime={effectiveEndTime} onStartScan={handleStartScan} />
      )}
      {currentView === 'scan' && (
        <ScannerView onComplete={handleScanComplete} />
      )}
      {currentView === 'rpe' && (
        <RpeView onSubmit={handleRpeSubmit} />
      )}
      {currentView === 'loading' && (
        <LoadingView />
      )}
      {currentView === 'results' && (
        <ResultsView
          captureDelayMs={captureDelayMs}
          finalHr={finalHr}
          rpeVal={rpeVal}
          rpeText={rpeText}
          onClose={handleClose}
        />
      )}
    </>
  );
}
