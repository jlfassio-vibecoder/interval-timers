import React, { useState } from 'react';
import { BASE } from '../constants';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Cell
} from 'recharts';

const FunctionalForce: React.FC = () => {
  const [activeForcePhase, setActiveForcePhase] = useState<1 | 2 | 3>(1);

  // --- DATA CONSTANTS ---
  const physiologyChartData = [
    { name: 'High Vol/Cardio', cortisol: 85, signal: 30 },
    { name: 'Func Force', cortisol: 20, signal: 95 },
  ];

  const proteinChartData = [
    { grams: 0, mps: 0 },
    { grams: 10, mps: 5 },
    { grams: 20, mps: 10 },
    { grams: 30, mps: 25 },
    { grams: 40, mps: 95 },
    { grams: 50, mps: 100 },
  ];

  const forcePhases = {
    1: {
        title: "Stabilization & Control",
        subtitle: "The Foundation",
        goal: "Connect the Brain to the Muscle",
        rationale: "Before we add heavy load, we must ensure the connective tissue (tendons/ligaments) and neural pathways are ready. We use SLOW eccentrics to eliminate momentum and force stability.",
        reps: "12–15",
        tempo: "3-1-1-0",
        tempoExplainer: "3s Lowering, 1s Pause at bottom, 1s Lift, 0s Pause at top.",
        rest: "60 seconds",
        focus: "Form Perfection",
        workouts: {
            A: [
                { name: "Goblet Squat (Heels Elevated)", cue: "Control the descent. 3 full seconds down." },
                { name: "Dumbbell Overhead Press", cue: "Ribcage down. Don't arch back." },
                { name: "Suitcase Carry", cue: "Walk perfectly upright. Resist the lean." }
            ],
            B: [
                { name: "Romanian Deadlift (DB or KB)", cue: "Hips back first. Soft knees. Feel the stretch." },
                { name: "Single-Arm DB Row", cue: "Pull towards the hip, not the armpit." },
                { name: "Deadbug (Core)", cue: "Lower back glued to floor. Slow movement." }
            ]
        }
    },
    2: {
        title: "Hypertrophy & Density",
        subtitle: "The Builder",
        goal: "Metabolic Capacity & Tissue Growth",
        rationale: "Now that stability is established, we increase the mechanical demand. We lower the reps slightly to allow for heavier weights, signaling the body to retain dense muscle tissue.",
        reps: "8–12",
        tempo: "2-0-1-0",
        tempoExplainer: "2s Lowering, 0s Pause, 1s Lift. Smooth continuous tension.",
        rest: "90 seconds",
        focus: "Progressive Overload (Add Weight)",
        workouts: {
            A: [
                { name: "Dual Kettlebell Front Squat", cue: "Elbows up. Drive through mid-foot." },
                { name: "Push-Up (or Incline Press)", cue: "Full range of motion. Chest to floor/bar." },
                { name: "Farmers Carry (Dual Heavy)", cue: "Heavy load. Short steps. Iron posture." }
            ],
            B: [
                { name: "Trap Bar Deadlift (or Heavy DB RDL)", cue: "Chest tall. Drive floor away." },
                { name: "Lat Pulldown (or Banded Pull-Up)", cue: "Drive elbows down to pockets." },
                { name: "Plank Saw", cue: "Forearm plank. Rock forward/back on toes." }
            ]
        }
    },
    3: {
        title: "Strength & Power",
        subtitle: "The Peak",
        goal: "Max Force Production (Neural Drive)",
        rationale: "The ultimate survival signal. Lifting heavy weights tells the central nervous system that high-output fibers are essential for survival. This is the most potent anti-atrophy signal.",
        reps: "5–8",
        tempo: "X-0-X-0",
        tempoExplainer: "Explosive Lift (X), Controlled Reset. Move the weight fast.",
        rest: "120–180 seconds",
        focus: "Intensity (Heavy Loads)",
        workouts: {
            A: [
                { name: "Box Squat (Heavy DB/BB)", cue: "Sit back completely. Explosive drive up." },
                { name: "Standing Overhead Press (Heavy)", cue: "Brace core hard. Punch the ceiling." },
                { name: "Heavy Ruck or Carry", cue: "Max weight you can hold for 30s." }
            ],
            B: [
                { name: "Conventional Deadlift (or Heavy KB Swing)", cue: "Hips drive power. Snap to vertical." },
                { name: "Chest Supported Row (Heavy)", cue: "Isolate the back. Squeeze hard." },
                { name: "Pallof Press", cue: "Anti-rotation. Fight the band/cable." }
            ]
        }
    }
  };

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Sync-60 <span className="text-gray-400 font-normal">| Functional Force</span></span>
           </div>
           <a href={BASE + '/handbook'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Handbook
           </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        
        {/* HERO SECTION */}
        <header className="bg-white border-b border-gray-200 shadow-sm rounded-3xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-sync-dark tracking-tight font-display">The Functional Force Architecture</h1>
                    <p className="text-sync-blue font-medium mt-2">Sync-60 Protocol: Anti-Atrophy & Metabolic Preservation</p>
                </div>
                <div className="mt-4 md:mt-0 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 text-sm">
                    <span className="font-bold block text-gray-500 text-xs uppercase tracking-wider mb-1">Target Population</span>
                    GLP-1 Agonists • Caloric Deficit • Sarcopenia Risk
                </div>
            </div>
            <p className="mt-6 text-gray-600 max-w-3xl">
                This is not a weight loss program; it is a <strong>tissue preservation protocol</strong>. When energy intake drops (via GLP-1 or diet), the body prefers to shed expensive muscle over fat. We must send a "survival signal" through Mechanical Tension to reverse this preference.
            </p>
        </header>

        {/* SECTION 1: THE PHYSIOLOGY (THE WHY) */}
        <section id="physiology">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-sync-dark flex items-center">
                    <span className="bg-sync-blue text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                    The Physiology of Retention
                </h2>
                <p className="text-gray-600 mt-2">Why we prioritize <strong>Intensity</strong> over Duration. Explore the metabolic signals below.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Text Explanation */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                    <h3 className="font-bold text-lg mb-4 text-sync-blue">The "Signal Noise" Problem</h3>
                    <p className="mb-4 text-sm text-gray-700 leading-relaxed">
                        In a caloric deficit, your recovery resources are limited. Traditional "high volume" or "cardio-style" lifting generates excessive metabolic waste and cortisol spikes, which can accelerate muscle breakdown (catabolism).
                    </p>
                    <p className="mb-4 text-sm text-gray-700 leading-relaxed">
                        <strong>The Solution:</strong> Short, heavy bouts of "Mechanical Tension." This signals the mTOR pathway: <em className="text-sync-blue">"This organism is under heavy load; we cannot afford to lose muscle tissue."</em>
                    </p>
                    <ul className="space-y-3 mt-6">
                        <li className="flex items-start">
                            <span className="text-sync-orange mr-2">●</span>
                            <span className="text-sm text-gray-700"><strong>Low Volume:</strong> Reduces cortisol cost.</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-sync-orange mr-2">●</span>
                            <span className="text-sm text-gray-700"><strong>High Tension:</strong> Maximizes retention signal.</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-sync-orange mr-2">●</span>
                            <span className="text-sm text-gray-700"><strong>Long Rest:</strong> Replenishes ATP without debt.</span>
                        </li>
                    </ul>
                </div>

                {/* Chart: Signal vs Stress */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                    <h3 className="font-bold text-sm text-gray-500 mb-4 text-center">Protocol Efficiency Comparison</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={physiologyChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fill: '#6B7280'}} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                                <Bar dataKey="cortisol" name="Cortisol (Stress)" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20} />
                                <Bar dataKey="signal" name="Retention Signal" fill="#0D9488" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-xs text-center text-gray-400">
                        *Comparing Functional Force vs. Typical "Bootcamp" Cardio
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 2: THE 60-DAY PROGRESSION (THE MAP) */}
        <section id="progression">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-sync-dark flex items-center">
                    <span className="bg-sync-blue text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                    The 3-Phase Progression
                </h2>
                <p className="text-gray-600 mt-2">Select a phase to view the specific protocols, tempos, and objectives.</p>
            </div>

            {/* Interactive Timeline Navigation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[1, 2, 3].map((phaseId) => (
                    <button 
                        key={phaseId}
                        onClick={() => setActiveForcePhase(phaseId as 1|2|3)} 
                        className={`p-4 rounded-xl border-2 text-left transition-all group ${
                            activeForcePhase === phaseId 
                            ? 'border-sync-blue bg-blue-50 shadow-md' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-bold uppercase tracking-wider ${activeForcePhase === phaseId ? 'text-sync-blue' : 'text-gray-500'}`}>
                                {phaseId === 1 ? 'Days 1–20' : phaseId === 2 ? 'Days 21–40' : 'Days 41–60'}
                            </span>
                            <span className={`text-xs ${activeForcePhase === phaseId ? 'text-sync-blue font-bold' : 'text-gray-400 group-hover:text-sync-blue'}`}>
                                {activeForcePhase === phaseId ? 'Active' : 'View'}
                            </span>
                        </div>
                        <h3 className="font-bold text-lg text-sync-dark">{forcePhases[phaseId as 1|2|3].title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{phaseId === 1 ? 'Neuromuscular Control' : phaseId === 2 ? 'Hypertrophy & Capacity' : 'Neural Drive & Strength'}</p>
                    </button>
                ))}
            </div>

            {/* Dynamic Phase Content */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-sync-blue text-white p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
                        <div>
                            <h2 className="text-3xl font-bold font-display">{forcePhases[activeForcePhase].title}</h2>
                            <p className="text-sync-orange uppercase tracking-widest text-sm font-semibold">{forcePhases[activeForcePhase].subtitle}</p>
                        </div>
                        <div className="mt-4 md:mt-0 bg-white/10 px-4 py-2 rounded border border-white/20">
                            <span className="block text-xs text-gray-300">Primary Goal</span>
                            {forcePhases[activeForcePhase].goal}
                        </div>
                    </div>
                    <p className="text-gray-300 max-w-3xl text-sm italic border-l-2 border-sync-orange pl-4 py-1">
                        "{forcePhases[activeForcePhase].rationale}"
                    </p>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Prescription Column */}
                    <div className="md:col-span-1 space-y-6">
                        <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Rep Range</h4>
                            <div className="text-3xl font-bold text-sync-dark">{forcePhases[activeForcePhase].reps}</div>
                        </div>
                        <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Tempo Protocol</h4>
                            <div className="text-3xl font-bold text-sync-dark">{forcePhases[activeForcePhase].tempo}</div>
                            <div className="text-xs text-gray-500 mt-1">{forcePhases[activeForcePhase].tempoExplainer}</div>
                        </div>
                        <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Rest Interval</h4>
                            <div className="text-xl font-bold text-sync-dark">{forcePhases[activeForcePhase].rest}</div>
                        </div>
                        <div className="bg-orange-50 border-l-4 border-sync-orange p-3 rounded-r-md">
                            <h4 className="text-orange-900 text-xs font-bold uppercase mb-1">Phase Focus</h4>
                            <p className="text-sm text-gray-700">{forcePhases[activeForcePhase].focus}</p>
                        </div>
                    </div>

                    {/* Workouts Column */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Session A */}
                        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                                <h3 className="font-bold text-sync-dark">Session A</h3>
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Squat / Push / Carry</span>
                            </div>
                            <ul className="space-y-4">
                                {forcePhases[activeForcePhase].workouts.A.map((ex, idx) => (
                                    <li key={idx}>
                                        <div className="font-bold text-sm text-gray-900">{ex.name}</div>
                                        <div className="text-xs text-sync-blue mt-0.5">Tip: {ex.cue}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Session B */}
                        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                                <h3 className="font-bold text-sync-dark">Session B</h3>
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Hinge / Pull / Core</span>
                            </div>
                            <ul className="space-y-4">
                                {forcePhases[activeForcePhase].workouts.B.map((ex, idx) => (
                                    <li key={idx}>
                                        <div className="font-bold text-sm text-gray-900">{ex.name}</div>
                                        <div className="text-xs text-sync-blue mt-0.5">Tip: {ex.cue}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 3: THE NUTRITION LINK */}
        <section id="nutrition">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-sync-dark flex items-center">
                    <span className="bg-sync-blue text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                    The Leucine Threshold
                </h2>
                <p className="text-gray-600 mt-2">Why "snacking" on protein fails. The physics of anabolic resistance.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Container */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                     <h3 className="font-bold text-sm text-gray-500 mb-4 text-center uppercase tracking-widest">Muscle Protein Synthesis (MPS)</h3>
                     <div className="h-[250px] w-full flex-grow">
                         <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={proteinChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                 <defs>
                                     <linearGradient id="colorMps" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#0D9488" stopOpacity={0.8}/>
                                         <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                                     </linearGradient>
                                 </defs>
                                 <XAxis dataKey="grams" tick={{fontSize: 12}} />
                                 <YAxis hide />
                                 <Tooltip cursor={{stroke: '#0D9488', strokeWidth: 1}} contentStyle={{borderRadius: '8px'}} />
                                 <Area type="monotone" dataKey="mps" stroke="#0D9488" fillOpacity={1} fill="url(#colorMps)" />
                             </AreaChart>
                         </ResponsiveContainer>
                     </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-2 bg-gray-50 p-8 rounded-2xl border border-gray-200">
                    <h3 className="text-xl font-bold text-sync-dark mb-4">The "New Safety Floor": 40g</h3>
                    <p className="mb-4 text-gray-700 leading-relaxed">
                        In a caloric deficit, your "Anabolic Threshold"—the amount of amino acids required to trigger muscle repair—drifts upward. 20g of protein (common in yogurts/snacks) acts merely as calories, not a building signal.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                            <h4 className="font-bold text-red-700 mb-2">The Sub-Threshold Trap</h4>
                            <p className="text-xs text-gray-600">Eating 15-20g of protein 5x a day. Result: <strong>Zero MPS spikes.</strong> Muscle wasting continues despite "high" total protein.</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-sync-blue">
                            <h4 className="font-bold text-sync-blue mb-2">The Functional Force Rule</h4>
                            <p className="text-xs text-gray-600">Minimum <strong>40g of high-quality protein</strong> (containing ~3g Leucine) in at least 2-3 meals. This "breaks the ceiling" and forces repair.</p>
                        </div>
                    </div>
                    <div className="mt-6 p-4 bg-sync-blue text-white rounded-xl text-sm border border-sync-blue/20">
                        <strong>Practical Application:</strong> Heavier engines need heavier fuel. As you move into Phase 3 (Strength), the neural demand increases. Do not perform Phase 3 workouts without the 40g post-workout anchor.
                    </div>
                </div>
            </div>
        </section>

      </main>

      <footer className="bg-sync-dark text-gray-400 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="font-bold text-gray-100 mb-2 font-display">Sync-60 Functional Force Architecture</p>
            <p className="text-sm">Designed for clinical efficacy in anti-atrophy protocols.</p>
        </div>
      </footer>
    </div>
  );
};

export default FunctionalForce;