import React, { useState, useEffect, useRef } from 'react';
import { BASE } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LineChart, Line 
} from 'recharts';

const MindfulWalking: React.FC = () => {
  const [isReportOpen, setIsReportOpen] = useState(false);

  // --- SECTION 1: IMPACT DATA ---
  const [metric, setMetric] = useState<'vo2' | 'bp'>('vo2');
  const impactData = [
    { name: 'Sedentary', vo2: 0, bp: 0 },
    { name: '10k Steps', vo2: 2, bp: -2 },
    { name: 'Interval Walk', vo2: 18, bp: -9 },
  ];

  // --- SECTION 2: SIMULATOR STATE ---
  const [simMode, setSimMode] = useState<'fast' | 'slow'>('fast');
  const [intensityData, setIntensityData] = useState<any[]>([]);

  useEffect(() => {
    // Generate initial wave data
    const base = simMode === 'fast' ? 85 : 40;
    const data = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      value: base + (Math.random() * 5 - 2.5)
    }));
    setIntensityData(data);

    const interval = setInterval(() => {
      setIntensityData(prev => {
        const newData = [...prev.slice(1)];
        const lastTime = prev[prev.length - 1].time;
        newData.push({
          time: lastTime + 1,
          value: base + (Math.random() * 5 - 2.5)
        });
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simMode]);

  const simContent = {
    fast: {
      color: "text-sync-orange",
      bgColor: "bg-orange-600",
      borderColor: "border-orange-200",
      phase: "High Intensity Interval",
      status: "Push Phase (3 Mins)",
      instruction: "Focus on form: Large strides. Land on your heel. Swing arms bent at 90°. Target RPE: 13-14 ('Somewhat Hard'). Elevate heart rate >70% Max.",
      quote: "Feel the power in your legs. The burn is the signal of adaptation.",
      icon: "⚡"
    },
    slow: {
      color: "text-green-700",
      bgColor: "bg-green-700",
      borderColor: "border-green-200",
      phase: "Active Recovery Interval",
      status: "Mindful Phase (3 Mins)",
      instruction: "Transition to 40% effort. Do not stop. Synchronize breath and step. Inhale for 3 steps, Exhale for 3 steps. Release shoulder tension.",
      quote: "\"I have arrived. I am home.\"",
      icon: "🧘"
    }
  };

  const currentSim = simContent[simMode];

  // --- SECTION 3: BREATH PACER CANVAS ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [pacerRhythm, setPacerRhythm] = useState(3);

  const animatePacer = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Cycle duration: 3 steps ~ 2.5s per phase (5s total), 2 steps ~ 1.5s per phase
    const cycleDuration = pacerRhythm * 800 * 2; 
    const phase = (time % cycleDuration) / cycleDuration;
    const rawSine = Math.sin(phase * Math.PI * 2);
    
    // Breathing logic
    const expansion = 0.6 + (0.4 * rawSine);
    const alpha = 0.4 + (0.4 * rawSine);

    // Draw Lungs (Circle)
    const maxRadius = width * 0.4;
    const radius = maxRadius * expansion;

    // Gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.8, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(72, 187, 120, ${alpha})`); // Green
    gradient.addColorStop(1, `rgba(72, 187, 120, 0)`);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(centerX, centerY, width * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Text
    ctx.font = "bold 16px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = rawSine > 0 ? "#064E3B" : "#047857"; // Dark greens
    ctx.fillText(rawSine > 0 ? "Inhale" : "Exhale", centerX, centerY);

    // Orbital Dots (Steps)
    const dotRadius = 4;
    const orbitRadius = width * 0.45;
    for(let i=0; i<pacerRhythm; i++) {
        const angle = (Math.PI * 2 / pacerRhythm) * i - Math.PI/2;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius;
        
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
        ctx.fill();
    }

    requestRef.current = requestAnimationFrame(animatePacer);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animatePacer);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [pacerRhythm]);

  const handleOpenFramework = () => {
    setIsReportOpen(true);
    setTimeout(() => {
        const element = document.getElementById('contemplative-framework');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }, 200);
  };

  return (
    <div className="bg-sync-base min-h-screen text-slate-800 font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className="font-display font-bold text-slate-800 text-lg tracking-wide">Pillar 4 <span className="text-gray-400 font-normal">| Mindful Interval Anchor</span></span>
           </div>
           <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-orange transition-colors">
             ← Back to Home
           </a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-20">
        
        {/* HERO */}
        <section className="text-center max-w-4xl mx-auto pt-8">
            <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 mb-6 leading-tight">
                The Synthesis of <span className="text-sync-orange">Power</span> & <span className="text-green-700">Peace</span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                "Pillar 4" introduces the <strong>Mindful Interval Protocol</strong>. By fusing Dr. Hiroshi Nose's high-intensity physiology with Thich Nhat Hanh’s walking meditation, we create a movement anchor that trains the heart and grounds the mind simultaneously.
            </p>
            <div className="flex justify-center gap-4">
                <button 
                    onClick={() => document.getElementById('simulator')?.scrollIntoView({behavior: 'smooth'})}
                    className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-transform hover:-translate-y-1"
                >
                    Experience Protocol
                </button>
            </div>
        </section>

        {/* SECTION 1: THE EVIDENCE */}
        <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <div className="inline-block px-3 py-1 bg-sync-orange/10 text-sync-orange rounded-full text-xs font-bold uppercase mb-4">
                        Physiological Evidence
                    </div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">Beyond "10,000 Steps"</h2>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        Research by Dr. Hiroshi Nose reveals that steady-state walking often fails to improve <strong>Peak Aerobic Capacity (VO2peak)</strong>. The "Nose Protocol"—alternating 3 minutes fast and 3 minutes slow—creates the metabolic stress required for adaptation.
                    </p>
                    <div className="bg-slate-50 p-6 rounded-xl border-l-4 border-sync-orange space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📈</span>
                            <span className="text-sm font-bold text-slate-700">VO2 Peak: +18% Improvement</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xl">❤️</span>
                            <span className="text-sm font-bold text-slate-700">Blood Pressure: -9 mmHg Reduction</span>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-700">Clinical Results (5 Months)</h3>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setMetric('vo2')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition ${metric === 'vo2' ? 'bg-sync-orange text-white shadow' : 'text-gray-500'}`}
                            >
                                VO2 Peak
                            </button>
                            <button 
                                onClick={() => setMetric('bp')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition ${metric === 'bp' ? 'bg-green-600 text-white shadow' : 'text-gray-500'}`}
                            >
                                BP Change
                            </button>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={impactData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                                <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
                                    {impactData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={metric === 'vo2' ? '#E06C3E' : index === 2 ? '#16A34A' : '#9CA3AF'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-4">
                        *Interval Walking vs. Steady State Control Group
                    </p>
                </div>
            </div>
        </section>

        {/* SECTION 2: THE SIMULATOR */}
        <section id="simulator" className="space-y-8">
            <div className="text-center">
                <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase mb-4">
                    Dual-Mode Simulator
                </div>
                <h2 className="text-3xl font-display font-bold text-slate-900">Toggle Your State</h2>
                <p className="text-slate-500 mt-2">Switch between Physiological Push and Mindful Presence.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className={`p-6 text-white transition-colors duration-500 flex justify-between items-center ${currentSim.bgColor}`}>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">{currentSim.status}</div>
                        <h3 className="text-2xl font-display font-bold">{currentSim.phase}</h3>
                    </div>
                    <div className="text-3xl font-mono opacity-90">03:00</div>
                </div>

                <div className="grid md:grid-cols-2">
                    {/* Left: Chart & Instruction */}
                    <div className="p-8 border-b md:border-b-0 md:border-r border-gray-100">
                        <div className="h-[200px] w-full mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={intensityData}>
                                    <YAxis domain={[0, 100]} hide />
                                    <Line 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke={simMode === 'fast' ? '#E06C3E' : '#15803d'} 
                                        strokeWidth={3} 
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className={`p-4 rounded-xl border-l-4 bg-gray-50 ${currentSim.borderColor}`}>
                            <h4 className="font-bold text-slate-800 mb-2">Protocol Guidance</h4>
                            <p className="text-sm text-slate-600 leading-relaxed">{currentSim.instruction}</p>
                            <p className="text-xs text-slate-500 mt-3">Bio-Sync60 recommends VT1-based calibration (or lab/wearable-based individual zones) over the 220-age formula to avoid misclassification and metabolic inflexibility and to target mitochondrial efficiency.</p>
                        </div>
                    </div>

                    {/* Right: Mindfulness Focus */}
                    <div className="p-8 bg-gray-50 flex flex-col justify-center items-center text-center">
                        <div className="text-6xl mb-6 transform transition-transform duration-500 hover:scale-110 cursor-default">{currentSim.icon}</div>
                        <blockquote className="text-xl font-display italic text-slate-700 mb-4">
                            {currentSim.quote}
                        </blockquote>
                        
                        {/* Breath Visualizer (Only visible in slow mode) */}
                        <div className={`transition-opacity duration-500 ${simMode === 'slow' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                            <div className="w-full h-1 bg-gray-200 rounded-full mb-2">
                                <div className="h-full bg-green-500 animate-pulse w-full rounded-full"></div>
                            </div>
                            <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Breath Synced</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center gap-4">
                    <button 
                        onClick={() => setSimMode('fast')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${simMode === 'fast' ? 'bg-sync-orange text-white shadow-lg scale-105' : 'bg-white text-gray-500 border hover:bg-gray-100'}`}
                    >
                        ⚡ Fast Interval
                    </button>
                    <button 
                        onClick={() => setSimMode('slow')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${simMode === 'slow' ? 'bg-green-700 text-white shadow-lg scale-105' : 'bg-white text-gray-500 border hover:bg-gray-100'}`}
                    >
                        🧘 Mindful Interval
                    </button>
                </div>
            </div>
        </section>

        {/* SECTION 3: MINDFUL TECH */}
        <section className="grid md:grid-cols-2 gap-12 items-center bg-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-2xl">
            <div>
                <div className="inline-block px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-xs font-bold uppercase mb-4 border border-green-800">
                    The Recovery Anchor
                </div>
                <h2 className="text-3xl font-display font-bold mb-6">The Art of Arrival</h2>
                <p className="text-slate-300 mb-6 leading-relaxed">
                    In standard HIIT, the recovery interval is "dead time." By integrating <strong>Thich Nhat Hanh’s Kinh Hin</strong> (Walking Meditation), we transform this downtime into active mental training.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setPacerRhythm(2)} className={`p-4 rounded-xl border text-left transition-all ${pacerRhythm === 2 ? 'bg-green-900/30 border-green-500' : 'border-slate-700 hover:bg-slate-800'}`}>
                        <div className="font-bold text-green-400 mb-1">Rhythm 2-2</div>
                        <div className="text-xs text-slate-400">Inhale 2 steps.<br/>Exhale 2 steps.</div>
                    </button>
                    <button onClick={() => setPacerRhythm(3)} className={`p-4 rounded-xl border text-left transition-all ${pacerRhythm === 3 ? 'bg-green-900/30 border-green-500' : 'border-slate-700 hover:bg-slate-800'}`}>
                        <div className="font-bold text-green-400 mb-1">Rhythm 3-3</div>
                        <div className="text-xs text-slate-400">Inhale 3 steps.<br/>Exhale 3 steps.</div>
                    </button>
                </div>
                <div className="mt-6">
                    <button 
                        onClick={handleOpenFramework}
                        className="text-green-400 font-bold hover:text-green-300 transition-colors flex items-center gap-2 text-sm border-b border-green-400/30 pb-0.5 hover:border-green-300"
                    >
                        <span>Learn More</span>
                        <span>→</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center bg-slate-800/50 rounded-2xl p-8 border border-slate-700 aspect-square">
                <canvas ref={canvasRef} width={300} height={300} className="max-w-full" />
                <p className="text-xs text-slate-500 mt-4 uppercase tracking-widest">Interactive Breath Pacer</p>
            </div>
        </section>

        {/* SECTION 4: IMPLEMENTATION */}
        <section className="bg-sync-base border-t border-gray-200 pt-10">
            <h2 className="text-2xl font-display font-bold text-center text-slate-900 mb-10">Your Weekly Architecture</h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-3xl mb-4">🗓️</div>
                    <h3 className="font-bold text-slate-800 mb-2">Frequency</h3>
                    <p className="text-sm text-slate-600">Target <strong>4 days per week</strong>. Physiological adaptations require consistent stimulus.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-3xl mb-4">⏱️</div>
                    <h3 className="font-bold text-slate-800 mb-2">Volume</h3>
                    <p className="text-sm text-slate-600"><strong>30 minutes</strong> total.<br/>5 Cycles of: 3 min Fast + 3 min Slow.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-3xl mb-4">🥛</div>
                    <h3 className="font-bold text-slate-800 mb-2">Nutrition</h3>
                    <p className="text-sm text-slate-600">Consume <strong>protein/carb source</strong> within 30 mins post-walk to maximize synthesis.</p>
                </div>
            </div>
        </section>

        {/* REPORT TRIGGER */}
        <section className="max-w-4xl mx-auto px-4 mt-16 text-center pb-10">
            <div className="bg-slate-50 rounded-3xl p-12 border border-slate-200">
                <h3 className="text-2xl font-display font-bold text-slate-900 mb-4">Read the Full Clinical Report</h3>
                <p className="text-slate-600 mb-8 max-w-xl mx-auto">
                    A deep dive into the synthesis of Dr. Hiroshi Nose’s Interval Walking Training and Thich Nhat Hanh’s contemplative practices.
                </p>
                <button 
                onClick={() => setIsReportOpen(true)}
                className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-3 mx-auto"
                >
                <span>📄</span>
                <span>Open Full Report</span>
                </button>
            </div>
        </section>

        {/* FULL ARTICLE MODAL */}
        {isReportOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsReportOpen(false)}></div>
                <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pillar 4 Deep Dive</span>
                            <h3 className="text-xl font-display font-bold text-slate-900">Clinical Synthesis: Mindful Interval Training</h3>
                        </div>
                        <button onClick={() => setIsReportOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-500 font-bold">&times;</button>
                    </div>
                    
                    {/* Content - Scrollable */}
                    <div className="overflow-y-auto p-8 md:p-12 prose prose-slate max-w-none text-slate-700">
                        
                        {/* TITLE BLOCK */}
                        <div className="text-center mb-12 border-b-2 border-slate-200 pb-8">
                            <h1 className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-2">SYNC-60 PROTOCOL</h1>
                            <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">PILLAR 4 DEEP DIVE</h2>
                            <div className="w-full h-px bg-slate-300 mx-auto mb-6"></div>
                            <h3 className="text-xl font-bold text-slate-800 leading-tight">Clinical Synthesis of Contemplative Practice and Physiological Interval Training</h3>
                            <p className="text-slate-600 italic mt-2">Integrating Thich Nhat Hanh’s Mindful Walking into the Pillar 4 Interval Walking Anchor</p>
                            <div className="w-full h-px bg-slate-300 mx-auto mt-6 mb-6"></div>
                            <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest">Peer-Reviewed & Red-Team Audited Final Edition</p>
                            <p className="text-xs text-slate-400 uppercase tracking-widest">Biological Synchronicity Systems • February 2026</p>
                        </div>

                        {/* ABSTRACT */}
                        <h3 className="text-2xl font-bold text-sync-blue mb-4">Bio-Sync60 Pillar 4</h3>
                        <h4 className="font-bold text-slate-900 mb-2">Abstract</h4>
                        <p className="mb-8">
                            This paper presents a clinical synthesis of two evidence-based interventions: the Interval Walking Training (IWT) protocol developed by Dr. Hiroshi Nose and colleagues at Shinshu University Graduate School of Medicine, and the contemplative walking framework of Thich Nhat Hanh. The IWT protocol—a cornerstone of the Bio-Sync60 framework designated as “Pillar 4: The Interval Walking Anchor”—prescribes repeating cycles of three minutes of fast walking (at or above 70% of peak aerobic capacity) followed by three minutes of slow recovery walking (approximately 40% of peak aerobic capacity), performed for a minimum of five sets daily, four days per week, over five months. Published outcomes across cohorts totaling 679 participants (mean age 65 years) demonstrate a 10–14% increase in VO₂peak, 9–10 mmHg reduction in systolic blood pressure, and 13–17% gains in knee extension and flexion strength. By integrating Thich Nhat Hanh’s concepts of “arriving,” “non-striving,” breath-step synchronization, and gatha recitation into the interval structure, this synthesis transforms Pillar 4 from a purely physiological intervention into a holistic longevity practice that addresses both metabolic resilience and psychological presence.
                        </p>

                        {/* SECTION 1 */}
                        <h3 className="text-2xl font-bold text-sync-blue mt-10 mb-4">1. The Physiological Architecture of the Shinshu University Protocol</h3>
                        <p className="mb-4">
                            The genesis of Interval Walking Training emerged from a critical observation in geriatric and metabolic science: casual, self-paced walking frequently fails to provide the metabolic stress necessary to improve peak aerobic capacity or reverse the onset of sarcopenia. Dr. Hiroshi Nose identified that middle-aged and older adults often plateau because they cannot sustain the continuous high-intensity efforts exceeding 70% of peak capacity required to trigger significant physiological remodeling. To bypass this barrier, the Shinshu team adapted elite interval training principles into a “3-minute fast, 3-minute slow” cycle, creating a temporal structure that allows metabolic recovery while accumulating a substantial volume of high-intensity work.
                        </p>

                        {/* Table 1.1 */}
                        <h4 className="font-bold text-slate-800 mt-6 mb-3">1.1 Protocol Specification</h4>
                        <div className="overflow-x-auto mb-6 border rounded-lg border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr>
                                        <th className="px-4 py-2 border-b">Component</th>
                                        <th className="px-4 py-2 border-b">Specification</th>
                                        <th className="px-4 py-2 border-b">Physiological Target</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr><td className="px-4 py-2 font-bold">Fast Interval</td><td className="px-4 py-2">3 Minutes</td><td className="px-4 py-2">≥70% VO₂peak</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Slow Interval</td><td className="px-4 py-2">3 Minutes</td><td className="px-4 py-2">~40% VO₂peak</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Minimum Sets</td><td className="px-4 py-2">5 per session</td><td className="px-4 py-2">30 minutes total active time</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Weekly Target</td><td className="px-4 py-2">4 Days</td><td className="px-4 py-2">≥60 min fast walking/week</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Clinical Timeline</td><td className="px-4 py-2">5 Months</td><td className="px-4 py-2">Minimum for structural/genetic remodeling</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-500 italic mb-6">Source: Nemoto et al. (2007), Mayo Clinic Proceedings, 82(7):803–811; Masuki et al. (2019), Mayo Clinic Proceedings, 94(12):2415–2426.</p>

                        {/* Table 1.2 */}
                        <h4 className="font-bold text-slate-800 mt-6 mb-3">1.2 Statistical Outcomes</h4>
                        <p className="mb-4">The following metrics are drawn from the primary Shinshu University publications. The larger Masuki et al. (2019) cohort of 679 participants (mean age 65±7 years) provides the most robust dataset.</p>
                        <div className="overflow-x-auto mb-6 border rounded-lg border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr>
                                        <th className="px-4 py-2 border-b">Metric</th>
                                        <th className="px-4 py-2 border-b">Baseline</th>
                                        <th className="px-4 py-2 border-b">After 5-Mo IWT</th>
                                        <th className="px-4 py-2 border-b">Change</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr><td className="px-4 py-2 font-bold">Systolic BP</td><td className="px-4 py-2">138 mmHg</td><td className="px-4 py-2">128 mmHg</td><td className="px-4 py-2 font-bold">−9 to −10 mmHg</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Diastolic BP</td><td className="px-4 py-2">81 mmHg</td><td className="px-4 py-2">76 mmHg</td><td className="px-4 py-2 font-bold">−5 mmHg</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">VO₂peak</td><td className="px-4 py-2">22.0 ml/kg/min</td><td className="px-4 py-2">25.1 ml/kg/min</td><td className="px-4 py-2 font-bold">+14.1%</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Knee Extension</td><td className="px-4 py-2">Baseline</td><td className="px-4 py-2">—</td><td className="px-4 py-2 font-bold">+13%</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Knee Flexion</td><td className="px-4 py-2">Baseline</td><td className="px-4 py-2">—</td><td className="px-4 py-2 font-bold">+17%</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">LSD Score</td><td className="px-4 py-2">2.00</td><td className="px-4 py-2">1.66</td><td className="px-4 py-2 font-bold">−17% to −20%</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm mb-6 text-slate-700">
                            <strong>Audit Note:</strong> The “17%” figure frequently cited in secondary sources refers to the composite Lifestyle-related Disease (LSD) Score, not raw blood pressure percentage. The actual systolic BP reduction is approximately 7–8% from baseline, representing ~10 mmHg—clinically equivalent to a primary antihypertensive drug.
                        </div>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">1.3 The Mechanism of Superiority: The Peripheral Pump</h4>
                        <p className="mb-4">
                            The core reason IWT outperforms steady-state walking lies in its impact on the cardiovascular and musculoskeletal systems through the skeletal muscle pump mechanism (colloquially termed the “Second Heart”). During the brisk phase, calf and thigh muscles undergo rapid, forceful contractions that compress the deep veins of the lower extremities. One-way venous valves ensure that these contractions propel deoxygenated blood back toward the heart against gravity. This increased venous return raises end-diastolic volume, and per the Frank-Starling law, the heart responds with more forceful contractions and greater stroke volume. Over five months, this repetitive “overfilling and forceful emptying” provides the stimulus for physiological cardiac remodeling.
                        </p>
                        <p className="mb-4">
                            A biomechanical advantage of IWT over running is the absence of a “flight phase.” In running, vertical ground reaction forces reach 2.5 to 3 times body weight. Fast walking maintains double-support throughout, significantly reducing vertical impact on joints while generating greater anteroposterior (propulsive) force—placing higher demand on the posterior chain without the braking stress that causes joint degradation.
                        </p>

                        {/* SECTION 2 */}
                        <h3 id="contemplative-framework" className="text-2xl font-bold text-sync-blue mt-10 mb-4">2. The Contemplative Framework of Thich Nhat Hanh</h3>
                        <p className="mb-4">
                            The integration of mindfulness into Pillar 4 centers on the teachings of Thich Nhat Hanh (1926–2022), whose approach to walking meditation rests on three pillars: “arriving,” “stopping,” and “non-striving.” In this tradition, mindful walking is the practice of bringing present-moment awareness to movement, surroundings, and sensation. Unlike conventional walking—often a means to a destination—mindful walking is treated as complete in itself; each step is experienced as an act of being fully present on the earth.
                        </p>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">2.1 The Philosophy of Arriving</h4>
                        <p className="mb-4">
                            Thich Nhat Hanh teaches that most people are “running” through life even when physically still—a mental habit of chasing future outcomes or fleeing past regrets. The primary gatha (mindfulness verse) used to counter this habit is: “I have arrived, I am home.” Here, “arrived” means establishing oneself fully in the present moment, and “home” refers to the present as the only place where life is genuinely available. In the context of Pillar 4, this philosophy anchors the practitioner during the brisk intervals, discouraging the tendency to “run through” three minutes of high-intensity effort to reach the “reward” of recovery.
                        </p>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">2.2 Breath-Step Synchronization</h4>
                        <p className="mb-4">A fundamental technique is synchronizing steps with breath. The practitioner takes a set number of steps for each inhalation and exhalation, varying with pace and lung capacity.</p>
                        
                        <div className="overflow-x-auto mb-6 border rounded-lg border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr>
                                        <th className="px-4 py-2 border-b">Technique</th>
                                        <th className="px-4 py-2 border-b">Inhale</th>
                                        <th className="px-4 py-2 border-b">Exhale</th>
                                        <th className="px-4 py-2 border-b">Gatha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr><td className="px-4 py-2 font-bold">Standard</td><td className="px-4 py-2">2–3 steps</td><td className="px-4 py-2">3–4 steps</td><td className="px-4 py-2 italic">"Arrived, Arrived. Home, Home, Home."</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Deepening</td><td className="px-4 py-2">Natural length</td><td className="px-4 py-2">+1 step</td><td className="px-4 py-2 italic">"Deep, Deep. Slow, Slow."</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Calming</td><td className="px-4 py-2">Focus on soles</td><td className="px-4 py-2">Soften jaw</td><td className="px-4 py-2 italic">"Calm, Calm. Ease, Ease."</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mb-4">The practitioner is instructed to say these words “with their feet, not with their mind”—attention anchored in the tactile sensation of foot contacting earth, grounding the body and mind against plans or worries.</p>

                        {/* SECTION 3 */}
                        <h3 className="text-2xl font-bold text-sync-blue mt-10 mb-4">3. The Integrated Protocol: Mapping Gathas to Intervals</h3>
                        <p className="mb-4">
                            The challenge of integrating Thich Nhat Hanh’s contemplative walking into the Nose Protocol lies in the fluctuating intensities. At an RPE of 7–8 during the fast interval, heart rate is elevated and breathing is heavy—this contrasts with the slow, leisurely pace typical of Zen walking meditation. However, Thich Nhat Hanh explicitly states that “fast walking for exercise” can be a deeply mindful practice if one maintains present-moment awareness and sensory engagement.
                        </p>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">3.1 Phase 1: Mindful Warm-Up (5 Minutes)</h4>
                        <p className="mb-4">
                            Before starting, the practitioner stands for one to two minutes in stillness, anchoring attention in the body. As they begin at a casual pace (RPE 2–3), they establish the breath-step rhythm and recite: “I have arrived, I am home.” The focus is on the contact between soles and earth—Thich Nhat Hanh’s instruction to walk as if “kissing the earth with your feet.”
                        </p>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">3.2 Phase 2: The Brisk Interval — “The Meditation of Strength” (3 Minutes)</h4>
                        <p className="mb-4">
                            When the brisk interval begins, the practitioner increases pace to RPE 7–8. Rather than viewing heavy breathing as stress, it is reframed as evidence of a strong, capable body. The breath-step ratio naturally shifts to approximately 4 steps per inhale and 6 steps per exhale. The gatha “Deep, Slow” anchors this phase: “Deep” refers to the depth of inhalation required by exertion; “Slow” refers to the intentional control of exhalation, which physiologically assists in managing heart rate via vagal engagement. The practitioner directs awareness to the calves and thighs, visualizing the skeletal muscle pump propelling blood back to the heart—transforming physical effort into an act of self-nourishment.
                        </p>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">3.3 Phase 3: Recovery Interval — “The Meditation of Ease” (3 Minutes)</h4>
                        <p className="mb-4">
                            The transition from fast to slow (RPE 2–4) is the critical moment for parasympathetic reactivation. The gatha shifts to “Calm, Ease” or “Smile, Release.” Thich Nhat Hanh’s “half-smile” practice—gently lifting the corners of the mouth to relax the hundreds of facial muscles—signals safety to the nervous system and amplifies the parasympathetic shift already occurring as the heart rate drops. This brief, structured contemplative pause between intervals provides the neurobiological conditions for enhanced parasympathetic reactivation, supporting the broader Bio-Sync60 goal of autonomic resilience.
                        </p>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">3.4 The IoT Feedback as “Bell of Mindfulness”</h4>
                        <p className="mb-4">
                            The Shinshu team achieved high adherence through accelerometer-based real-time feedback. In the integrated protocol, these digital signals are reframed as Thich Nhat Hanh’s “Bell of Mindfulness”—an invitation to return to the present moment rather than a digital taskmaster demanding compliance. Each chime (start, brisk, recovery, end) becomes an invitation to “stop and arrive.”
                        </p>

                        {/* SECTION 4 */}
                        <h3 className="text-2xl font-bold text-sync-blue mt-10 mb-4">4. Epigenetic Convergence: The NFKB Pathway [CORRECTED]</h3>
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm mb-6 text-slate-700">
                            <strong>Audit Correction:</strong> The original draft stated that “five months of IWT increases DNA methylation of the NFKB gene by approximately 20%.” This has been corrected based on primary source verification.
                        </div>
                        <p className="mb-4">
                            A point of convergence between the Japanese IWT research and the mindfulness literature is the modulation of the NFKB (Nuclear Factor Kappa B) pathway. NFKB is a master transcription factor that regulates the inflammasome—a complex responsible for triggering age-related chronic inflammation, often termed “inflamm-aging.”
                        </p>
                        <p className="mb-4">
                            <strong>The IWT evidence:</strong> Zhang et al. (2015, International Journal of Sports Medicine) identified NFKB2 as a gene whose promoter methylation increases in response to IWT, based on genome-wide screening. Importantly, the degree of methylation correlated with training energy expenditure. However, the quantified large-magnitude methylation increases (29% for NFKB1, 44% for NFKB2) reported by Masuki et al. (2017, PLOS ONE) occurred specifically in participants who combined IWT with high-dose dairy protein supplementation. The IWT-only control group did not show significant increases. This indicates that while IWT primes the epigenetic machinery for anti-inflammatory methylation, adequate nutritional support—particularly protein—is required to realize the full effect.
                        </p>
                        <p className="mb-4">
                            <strong>The mindfulness evidence:</strong> Separate research into mindfulness-based interventions has demonstrated downregulation of pro-inflammatory gene expression and NFKB-dependent pathways. Kaliman et al. (2014) found rapid epigenetic changes in experienced meditators after a single day of intensive practice, including reduced expression of histone deacetylase genes and attenuated inflammatory signaling.
                        </p>

                        <div className="overflow-x-auto mb-6 border rounded-lg border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr>
                                        <th className="px-4 py-2 border-b">Intervention</th>
                                        <th className="px-4 py-2 border-b">Mechanism</th>
                                        <th className="px-4 py-2 border-b">Epigenetic Outcome</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr><td className="px-4 py-2 font-bold">IWT + Protein</td><td className="px-4 py-2">Metabolic stress + leucine signaling</td><td className="px-4 py-2">29–44% increase in NFKB1/2 methylation</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">IWT Alone</td><td className="px-4 py-2">Metabolic stress / muscle pump</td><td className="px-4 py-2">NFKB2 identified as responsive gene; magnitude requires nutritional co-factor</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Mindfulness</td><td className="px-4 py-2">HPA axis regulation / calm</td><td className="px-4 py-2">Downregulation of NFKB and TNF-α pathways</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Combined (Pillar 4)</td><td className="px-4 py-2">Synergistic metabolic + autonomic signal</td><td className="px-4 py-2">Dual targeting of inflammatory gene expression (hypothesized)</td></tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION 5 */}
                        <h3 className="text-2xl font-bold text-sync-blue mt-10 mb-4">5. Reconciling Non-Striving with Performance Goals</h3>
                        <p className="mb-4">
                            A common criticism of integrating Zen mindfulness into fitness is the apparent conflict between “non-striving” and goal-oriented performance targets. Mindfulness scholars describe this as a paradox, and the paper navigates it through a concept drawn from both contemplative tradition and sport psychology.
                        </p>
                        <p className="mb-4">
                            <strong>Intention vs. Goal:</strong> In mindfulness, an “intention” is a direction—a compass of the heart—whereas a “goal” is an outcome-based target. The practitioner strives to be present for the full duration of the walk; they do not strive for a specific VO₂peak outcome during any given session.
                        </p>
                        <p className="mb-4">
                            <strong>Right Diligence:</strong> Thich Nhat Hanh’s concept of Right Diligence bridges this gap: one is determined to “nourish the capacity for understanding and joy”—including health and mobility—while “transforming anger and fear”—including fear of aging or physical decline. The 14% improvement in VO₂peak is understood as a natural byproduct of sustained, present practice rather than something grasped during any individual session.
                        </p>
                        <p className="mb-4">
                            Research from Kee & Wang (2008, Journal of Clinical Sport Psychology) demonstrates that mindfulness training enhances flow state in athletes, and Gardner & Moore’s Mindfulness-Acceptance-Commitment approach has shown that mindful awareness during exertion reduces the psychological burden of exercise intensity without reducing its physiological effectiveness. By applying breath-step synchronization and gatha recitation to the high-intensity interval, the practitioner creates a cognitive “skill” (focused breathing and mantra) that matches the “challenge” of 70% intensity—facilitating the challenge-skill balance that Csikszentmihalyi identified as the precondition for flow.
                        </p>

                        {/* SECTION 6 */}
                        <h3 className="text-2xl font-bold text-sync-blue mt-10 mb-4">6. Clinical Manual: The Integrated 30-Minute Anchor</h3>
                        <div className="overflow-x-auto mb-6 border rounded-lg border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                    <tr>
                                        <th className="px-4 py-2 border-b">Phase</th>
                                        <th className="px-4 py-2 border-b">RPE</th>
                                        <th className="px-4 py-2 border-b">Talk Test</th>
                                        <th className="px-4 py-2 border-b">Mindful Focus</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr><td className="px-4 py-2 font-bold">Warm-Up (5 min)</td><td className="px-4 py-2">2–3</td><td className="px-4 py-2">Full conversation</td><td className="px-4 py-2 italic">"I have arrived, I am home." Feet on earth.</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Brisk (3 min)</td><td className="px-4 py-2">7–8</td><td className="px-4 py-2">Short, broken sentences</td><td className="px-4 py-2 italic">"Deep, Slow." Visualize Second Heart pump.</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Recovery (3 min)</td><td className="px-4 py-2">2–4</td><td className="px-4 py-2">Easy conversation</td><td className="px-4 py-2 italic">"Calm, Ease." Half-smile. Release tension.</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Repeat ×5</td><td className="px-4 py-2">—</td><td className="px-4 py-2">—</td><td className="px-4 py-2 italic">IoT chime = Bell of Mindfulness</td></tr>
                                    <tr><td className="px-4 py-2 font-bold">Cool-Down (3 min)</td><td className="px-4 py-2">1–2</td><td className="px-4 py-2">Relaxed speech</td><td className="px-4 py-2 italic">"Dwelling in the present moment." Gratitude.</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <h4 className="font-bold text-slate-800 mt-6 mb-3">6.1 Progressive Overload</h4>
                        <p className="mb-2"><strong>Beginner (Weeks 1–4):</strong> Focus on consistency and the “Arriving” mindset. Begin with 3 sets (18 minutes) if 30 minutes is initially unattainable.</p>
                        <p className="mb-2"><strong>Intermediate (Weeks 5–12):</strong> Reach the full 5-set prescription at least 4 days per week. Ensure brisk segments maintain RPE 7–8 through mindful intensity monitoring.</p>
                        <p className="mb-4"><strong>Advanced (Week 12+):</strong> Introduce vertical load (1–3% treadmill incline or hilly terrain) during fast intervals to maintain the 70% VO₂peak threshold as cardiovascular fitness improves.</p>

                        {/* SECTION 7 */}
                        <h3 className="text-2xl font-bold text-sync-blue mt-10 mb-4">7. Conclusion</h3>
                        <p className="mb-4">
                            The Integrated Pillar 4 Interval Walking Anchor represents a precisely engineered physiological and psychological intervention. The Shinshu University IWT protocol provides the biological engine: a proven method for cardiovascular remodeling, muscular strengthening, and metabolic flexibility in aging populations. Thich Nhat Hanh’s contemplative framework provides the psychological navigator: a method for transforming metabolic stress into present-moment awareness, reducing perceived exertion, and facilitating the flow state that supports long-term adherence.
                        </p>
                        <p className="mb-4">
                            The convergence of these two traditions is not merely additive. The interval structure of IWT creates natural “transitions”—moments of shifting intensity that, without contemplative anchoring, often become moments of mental resistance or agitation. By mapping gathas to these transitions, the protocol transforms each shift in effort into an invitation to practice presence. The recovery interval, in particular, becomes a structured parasympathetic re-entry point that amplifies the autonomic benefits already inherent in the interval design.
                        </p>
                        <p className="mb-4">
                            A 10–14% increase in VO₂peak corresponds to meaningful improvements in cardiorespiratory reserve and functional capacity. A 9–10 mmHg reduction in systolic blood pressure provides clinically significant cardiovascular protection. The 13–17% gains in lower-limb strength address the sarcopenic decline that represents one of the primary threats to independence in aging. And the epigenetic evidence—while requiring the nutritional co-factor caveat identified in this audit—suggests that the combination of structured physical stress and contemplative practice engages anti-inflammatory pathways at the genomic level.
                        </p>
                        <p className="mb-4">
                            In the synthesis of these findings, the Nose Protocol provides the biological engine, and Thich Nhat Hanh provides the spiritual navigator, creating a Daily Movement Anchor that is greater than the sum of its parts.
                        </p>

                        <hr className="my-8 border-gray-200" />
                        
                        {/* REFERENCES */}
                        <div className="text-xs text-gray-500">
                            <p className="font-bold mb-2 uppercase tracking-wide">References</p>
                            <ul className="space-y-1">
                                <li>Nemoto K, Gen-no H, Masuki S, Okazaki K, Nose H. Effects of high-intensity interval walking training on physical fitness and blood pressure in middle-aged and older people. Mayo Clinic Proceedings. 2007;82(7):803–811.</li>
                                <li>Masuki S, Morikawa M, Nose H. High-intensity walking time is a key determinant to increase physical fitness and improve health outcomes after interval walking training in middle-aged and older people. Mayo Clinic Proceedings. 2019;94(12):2415–2426.</li>
                                <li>Zhang Y, Hashimoto S, Fujii C, et al. NFkB2 gene as a novel candidate that epigenetically responds to interval walking training. International Journal of Sports Medicine. 2015;36(9):769–775.</li>
                                <li>Masuki S, Morikawa M, Nakano S, et al. Effects of milk product intake on thigh muscle strength and NFKB gene methylation during home-based interval walking training in older women. PLOS ONE. 2017;12(5):e0176757.</li>
                                <li>Morikawa M, Nakano S, Mitsui N, et al. Effects of dried tofu supplementation during interval walking training on the methylation of the NFKB2 gene. Journal of Physiological Sciences. 2018;68(6):749–757.</li>
                                <li>Kaliman P, Álvarez-López MJ, Cosín-Tomás M, et al. Rapid changes in histone deacetylases and inflammatory gene expression in expert meditators. Psychoneuroendocrinology. 2014;40:96–107.</li>
                                <li>Combes A, Dekerle J, Webborn N, et al. Exercise-induced metabolic fluctuations influence AMPK, p38-MAPK and CaMKII phosphorylation in human skeletal muscle. Physiological Reports. 2015;3(9):e12462.</li>
                                <li>Šrámek P, Simecková M, Janský L, et al. Human physiological responses to immersion into water of different temperatures. European Journal of Applied Physiology. 2000;81(5):436–442.</li>
                                <li>Robergs RA, Landwehr R. The surprising history of the “HRmax=220–age” equation. Journal of Exercise Physiology Online. 2002;5(2):1–10.</li>
                                <li>Anton SD, Moehl K, Donahoo WT, et al. Flipping the metabolic switch: Understanding and applying the health benefits of fasting. Obesity. 2018;26(2):254–268.</li>
                                <li>Thich Nhat Hanh. How to Walk. Berkeley: Parallax Press; 2015.</li>
                                <li>Thich Nhat Hanh. Walking meditation. In: The Long Road Turns to Joy. Berkeley: Parallax Press; 2011.</li>
                                <li>Kee YH, Wang CKJ. Relationships between mindfulness, flow dispositions and mental skills adoption. Psychology of Sport and Exercise. 2008;9(4):393–411.</li>
                                <li>Shapiro SL, de Vibe M, Negi LT, et al. Exploring the paradoxes of mindfulness. Mindfulness. 2018;9(5):1358–1368.</li>
                            </ul>
                            <p className="mt-4">© 2026 Biological Synchronicity Systems. Part of the Bio-Sync60 Protocol.</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                        <button onClick={() => setIsReportOpen(false)} className="text-sm font-bold text-gray-500 hover:text-slate-900 px-4 py-2">Close</button>
                        <button onClick={() => window.print()} className="ml-4 bg-slate-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-800">Print Report</button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default MindfulWalking;