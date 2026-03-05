import React, { useState, useEffect, useRef } from 'react';
import { BASE } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ScatterChart, Scatter, ZAxis, Legend, ReferenceLine
} from 'recharts';

const PillarWalking: React.FC = () => {
  // --- SECTION 1: DATA ---
  const resultsData = [
    { name: 'Baseline', vo2: 100, bp: 145 },
    { name: 'Month 5', vo2: 114, bp: 120 }
  ];

  const scatterDataRunning = [{ x: 9, y: 9, z: 15, name: 'Running' }];
  const scatterDataWalking = [{ x: 2, y: 3, z: 10, name: 'Steady Walking' }];
  const scatterDataIWT = [{ x: 3, y: 8, z: 20, name: 'Interval Walking' }];

  // --- SECTION 3: SIMULATOR LOGIC ---
  const [simState, setSimState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [currentPhase, setCurrentPhase] = useState<'fast' | 'slow'>('fast');
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes in seconds
  const timerRef = useRef<number | null>(null);

  const cues = {
    fast: {
      title: "BRISK PHASE",
      text: "Talk, don't sing. Engage thighs. Pump arms.",
      color: "text-sync-orange",
      borderColor: "border-sync-orange",
      bg: "bg-orange-50",
      ringPulse: true
    },
    slow: {
      title: "SLOW PHASE",
      text: "Active recovery. Breathe deeply. Relax shoulders.",
      color: "text-teal-600",
      borderColor: "border-teal-500",
      bg: "bg-teal-50",
      ringPulse: false
    }
  };

  const currentCue = cues[currentPhase];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startSimulator = () => {
    if (simState === 'running') return;
    setSimState('running');
    setCurrentPhase('fast');
    setTimeLeft(180);

    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 5; // 10x speed (5s per 500ms tick)
        if (next <= 0) {
          // Phase Switch Logic inside the callback
          // We need to check currentPhase ref or use functional state update carefully
          // Simplified for React: triggering a side effect via useEffect is safer but direct logic works if strict
          return 0;
        }
        return next;
      });
    }, 500);
  };

  // Monitor timer for phase switching
  useEffect(() => {
    if (timeLeft <= 0 && simState === 'running') {
      if (currentPhase === 'fast') {
        setCurrentPhase('slow');
        setTimeLeft(180);
      } else {
        // End of set
        if (timerRef.current) window.clearInterval(timerRef.current);
        setSimState('completed');
        setTimeLeft(180); // Reset for display
        setCurrentPhase('fast');
      }
    }
  }, [timeLeft, simState, currentPhase]);

  const resetSimulator = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setSimState('idle');
    setCurrentPhase('fast');
    setTimeLeft(180);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="bg-sync-base min-h-screen text-slate-800 font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className="font-bold text-slate-800 text-lg tracking-wide">Bio-Sync60 <span className="text-sync-orange font-normal">| Pillar 4</span></span>
           </div>
           <a href={BASE + '/handbook'} className="text-sm font-bold text-gray-500 hover:text-sync-orange transition-colors">
             ← Back to Handbook
           </a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-16">
        
        {/* Hero Section */}
        <header className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 text-center relative overflow-hidden">
            <div className="relative z-10">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sync-orange/10 text-sync-orange text-xs font-bold uppercase mb-6 tracking-widest">
                    Based on Shinshu University Research
                </div>
                <h1 className="text-3xl md:text-5xl font-display font-bold text-sync-blue mb-6 tracking-tight">
                    The "Nose" Protocol:<br/>High-ROI Interval Walking
                </h1>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed mb-10">
                    Unlock <strong>HIIT-level cardiovascular gains</strong> without the orthopedic cost of running. A validated method to turn walking into a potent medicine for longevity.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    <div className="p-6 bg-sync-base rounded-2xl border border-gray-200">
                        <div className="text-3xl font-bold text-sync-orange">+14%</div>
                        <div className="text-sm font-bold text-sync-blue mt-1">VO2 Peak</div>
                        <div className="text-xs text-gray-500 mt-2">Aerobic Capacity (5 Months)</div>
                    </div>
                    <div className="p-6 bg-sync-base rounded-2xl border border-gray-200">
                        <div className="text-3xl font-bold text-teal-600">-17%</div>
                        <div className="text-sm font-bold text-sync-blue mt-1">Systolic BP</div>
                        <div className="text-xs text-gray-500 mt-2">Lifestyle-related Disease Risk</div>
                    </div>
                    <div className="p-6 bg-sync-base rounded-2xl border border-gray-200">
                        <div className="text-3xl font-bold text-gray-700">Low</div>
                        <div className="text-sm font-bold text-sync-blue mt-1">Impact Force</div>
                        <div className="text-xs text-gray-500 mt-2">Safe for Knees & Joints</div>
                    </div>
                </div>
            </div>
            {/* Decor */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
                <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sync-orange blur-3xl"></div>
            </div>
        </header>

        {/* Section 1: The Science & Data */}
        <section className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-6">
                <h2 className="text-2xl font-display font-bold text-sync-blue">The Shinshu University Study</h2>
                <div className="prose prose-stone text-gray-600">
                    <p>
                        Developed by <strong>Dr. Hiroshi Nose</strong>, this protocol is not "just walking." It is High-Intensity Interval Training (HIIT) specifically engineered to trigger biological adaptation without the trauma of high-impact sports.
                    </p>
                    <p>
                        Research conducted on over <strong>8,700 participants</strong> demonstrated significant reversals in biological aging markers over a 5-month period.
                    </p>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md text-sm mt-4">
                        <span className="font-bold text-yellow-800 block mb-1">Context Check:</span>
                        <span className="text-yellow-700">
                            While these statistics (14% VO2 increase, 17% BP decrease) are dramatic, they are primarily derived from older populations. However, the <strong>mechanism of efficiency</strong> remains valid for all ages as a "Movement Anchor."
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 text-center">Results: 5-Month Intervention</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resultsData} barSize={60}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                            <YAxis orientation="left" stroke="#E06C3E" yAxisId="left" hide />
                            <YAxis orientation="right" stroke="#0d9488" yAxisId="right" hide />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                            <Bar yAxisId="left" dataKey="vo2" name="VO2 Peak" fill="#E06C3E" radius={[6, 6, 0, 0]} label={{position: 'top', fill: '#E06C3E', fontSize: 12, formatter: (v:any) => v === 114 ? '+14%' : ''}} />
                            <Bar yAxisId="right" dataKey="bp" name="Systolic BP" fill="#0d9488" radius={[6, 6, 0, 0]} label={{position: 'top', fill: '#0d9488', fontSize: 12, formatter: (v:any) => v === 120 ? '-17%' : ''}} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-gray-400 mt-4 italic">Source: Nose et al., Shinshu University</p>
            </div>
        </section>

        {/* Section 2: The "Sweet Spot" Analysis */}
        <section>
            <div className="text-center max-w-3xl mx-auto mb-10">
                <h2 className="text-2xl font-display font-bold text-sync-blue mb-4">Why Interval Walking?</h2>
                <p className="text-gray-600">
                    Comparison of different movement modalities reveals why Interval Walking (IWT) is the "Movement Anchor." It sits in the optimization zone: high biological signal with low orthopedic noise.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Chart Col */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Impact vs. Benefit Analysis</h3>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="x" name="Orthopedic Stress" unit="" min={0} max={10} label={{ value: 'Joint Impact', position: 'bottom', offset: 0, fill: '#9CA3AF', fontSize: 12 }} />
                                <YAxis type="number" dataKey="y" name="CV Benefit" unit="" min={0} max={10} label={{ value: 'Cardio Benefit', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 12 }} />
                                <ZAxis type="number" dataKey="z" range={[100, 400]} name="Score" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Legend verticalAlign="top" height={36} />
                                <Scatter name="Running" data={scatterDataRunning} fill="#78716c" shape="circle" />
                                <Scatter name="Steady Walking" data={scatterDataWalking} fill="#a8a29e" shape="circle" />
                                <Scatter name="Interval Walking" data={scatterDataIWT} fill="#ea580c" shape="circle" />
                                <ReferenceLine x={5} stroke="#e5e7eb" strokeDasharray="3 3" />
                                <ReferenceLine y={5} stroke="#e5e7eb" strokeDasharray="3 3" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded">
                        <strong>Insight:</strong> Running provides high benefit but generates high Ground Reaction Force (GRF). Steady walking is safe but often lacks the intensity to trigger VO2 adaptation. IWT bridges this gap.
                    </div>
                </div>

                {/* Text Col */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border-l-4 border-sync-orange shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-2">1. The "Second Heart" Effect</h4>
                        <p className="text-sm text-gray-600">
                            During the <strong>Brisk</strong> phase, vigorous thigh muscle contraction acts as a peripheral pump. This forces blood back to the heart, increasing venous return. The heart must stretch to accommodate this volume (Preload), strengthening the cardiac muscle (Stroke Volume).
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border-l-4 border-teal-500 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-2">2. Lactate Threshold</h4>
                        <p className="text-sm text-gray-600">
                            The <strong>Brisk</strong> phase targets {'>'}70% VO2 Peak. This touches the anaerobic threshold, triggering mitochondrial density improvements and lactate clearance efficiency that steady walking (40% VO2) never stimulates.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* Section 3: The Protocol & Interactive Simulator */}
        <section className="bg-sync-dark text-white rounded-3xl p-8 md:p-12 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-sync-orange opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
                <div>
                    <h2 className="text-3xl font-display font-bold mb-6 text-white">The Execution</h2>
                    <p className="text-gray-300 mb-8 text-lg">
                        The protocol is deceptively simple: <strong className="text-white">5 Sets</strong> of <strong className="text-white">3 minutes Fast</strong> and <strong className="text-white">3 minutes Slow</strong>.
                    </p>
                    <p className="text-gray-400 text-sm mb-8">
                        Bio-Sync60 prescribes intensity relative to <strong className="text-white">VT1 (Ventilatory Threshold 1)</strong> or individualized calibration rather than generic 220-age formulas, to avoid metabolic inflexibility and to target true mitochondrial efficiency.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-sync-orange flex items-center justify-center font-bold text-white mt-1">
                                A
                            </div>
                            <div className="ml-4">
                                <h4 className="text-xl font-bold text-sync-orange">The "Brisk" Interval</h4>
                                <p className="text-gray-400 text-xs font-mono mt-1 mb-2">TARGET: {'>'}70% VO2 Peak | RPE 7/10</p>
                                <p className="text-gray-300 text-sm">
                                    Walk as fast as possible without running. You should be able to speak a short sentence ("I am walking fast") but <strong>not</strong> sing a song. Lean forward slightly, use your arms.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-teal-600 flex items-center justify-center font-bold text-white mt-1">
                                B
                            </div>
                            <div className="ml-4">
                                <h4 className="text-xl font-bold text-teal-400">The "Slow" Interval</h4>
                                <p className="text-gray-400 text-xs font-mono mt-1 mb-2">TARGET: 40% VO2 Peak | RPE 3/10</p>
                                <p className="text-gray-300 text-sm">
                                    Active recovery. Stroll comfortably. Do not stop completely. This phase allows lactate to clear and prepares the heart for the next stretch.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center pt-4 border-t border-gray-700 mt-6">
                            <div className="text-sm text-gray-400">
                                <span className="font-bold text-white">Total Volume:</span> 30 Minutes (5 Sets)
                            </div>
                            <div className="mx-4 text-gray-600">|</div>
                            <div className="text-sm text-gray-400">
                                <span className="font-bold text-white">Frequency:</span> 4+ Days/Week
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simulator Card */}
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-2xl relative">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white">Session Simulator</h3>
                        <span className={`px-2 py-1 rounded text-xs font-mono ${simState === 'running' ? 'bg-green-900 text-green-400 animate-pulse' : 'bg-gray-700 text-gray-300'}`}>
                            {simState === 'running' ? 'RUNNING' : simState === 'completed' ? 'COMPLETED' : 'IDLE'}
                        </span>
                    </div>

                    {/* Visual Timer Display */}
                    <div className="relative h-48 flex items-center justify-center mb-6">
                        {/* Outer Ring */}
                        <div className="absolute w-40 h-40 rounded-full border-4 border-gray-700"></div>
                        {/* Active Ring */}
                        <div className={`absolute w-40 h-40 rounded-full border-4 transition-all duration-500 ${
                            simState === 'running' 
                                ? `${currentCue.borderColor} ${currentCue.ringPulse ? 'animate-pulse' : ''}` 
                                : 'border-transparent'
                        }`}></div>
                        
                        <div className="text-center z-10">
                            <div className="text-4xl font-mono font-bold text-white">{formatTime(timeLeft)}</div>
                            <div className={`text-sm font-semibold uppercase tracking-widest mt-1 ${
                                simState === 'running' ? currentCue.color : 'text-gray-500'
                            }`}>
                                {simState === 'running' ? currentPhase : 'Ready'}
                            </div>
                        </div>
                    </div>

                    {/* Live Instructions */}
                    <div className={`rounded-lg p-4 mb-6 min-h-[80px] flex items-center justify-center text-center transition-colors duration-300 ${
                        simState === 'running' ? currentCue.bg : 'bg-gray-700/50'
                    }`}>
                        <p className={`font-medium ${simState === 'running' ? currentCue.color : 'text-gray-300 text-sm'}`}>
                            {simState === 'running' ? currentCue.text : simState === 'completed' ? 'Set Complete. In a real session, you would repeat this 5 times.' : 'Press "Start Simulator" to experience the flow of a single set (accelerated time).'}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={startSimulator}
                            disabled={simState === 'running'}
                            className={`w-full py-3 bg-white text-gray-900 font-bold rounded hover:bg-gray-200 transition-colors ${simState === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Start Simulator
                        </button>
                        <button 
                            onClick={resetSimulator}
                            className="w-full py-3 bg-gray-700 text-white font-medium rounded hover:bg-gray-600 transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-500 mt-4">Note: Simulator runs at 10x speed for demonstration.</p>
                </div>
            </div>
        </section>

        {/* Final Summary */}
        <section className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-sync-blue mb-4">Your Implementation Plan</h2>
            <div className="flex flex-wrap justify-center gap-4">
                <div className="px-4 py-2 bg-sync-base rounded-full text-gray-700 text-sm font-medium">Goal: 4 Sessions / Week</div>
                <div className="px-4 py-2 bg-sync-base rounded-full text-gray-700 text-sm font-medium">Total: 120 Minutes</div>
                <div className="px-4 py-2 bg-sync-base rounded-full text-gray-700 text-sm font-medium">ROI: High</div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default PillarWalking;
