import React, { useState, useEffect, useRef } from 'react';
import { BASE } from '../constants';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Label
} from 'recharts';

const PillarHydration: React.FC = () => {
  // --- SECTION 1: Dehydration Chart Data ---
  const dehydrationData = [
    { loss: '0%', cognitive: 100, physical: 100 },
    { loss: '1%', cognitive: 95, physical: 92 },
    { loss: '2%', cognitive: 80, physical: 75 },
    { loss: '3%', cognitive: 65, physical: 60 },
    { loss: '4%', cognitive: 50, physical: 45 },
  ];

  // --- SECTION 2: Battery Visualization ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [electrolyteLevel, setElectrolyteLevel] = useState(85);
  const [batteryStatus, setBatteryStatus] = useState({ text: 'OPTIMAL', color: 'text-blue-400' });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw Function
    const drawBattery = (level: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const batteryW = 200;
      const batteryH = 100;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Battery Body Outline
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.strokeRect(centerX - batteryW/2, centerY - batteryH/2, batteryW, batteryH);
      
      // Positive Terminal
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(centerX + batteryW/2, centerY - 15, 12, 30);

      // Determine Color & Status
      let fillStyle = '#3B82F6'; // Blue
      let statusText = "OPTIMAL";
      let statusColor = "text-blue-400";

      if (level < 30) {
        fillStyle = '#EF4444'; // Red
        statusText = "CRITICAL";
        statusColor = "text-red-500";
      } else if (level < 70) {
        fillStyle = '#F59E0B'; // Amber
        statusText = "LOW CHARGE";
        statusColor = "text-amber-500";
      }

      setBatteryStatus({ text: statusText, color: statusColor });

      // Add "Glow" effect
      ctx.shadowBlur = level / 2;
      ctx.shadowColor = fillStyle;
      
      // Draw fluid level
      const fillWidth = (batteryW - 10) * (level / 100);
      ctx.fillStyle = fillStyle;
      ctx.fillRect(centerX - batteryW/2 + 5, centerY - batteryH/2 + 5, fillWidth, batteryH - 10);

      // Reset shadow for particles
      ctx.shadowBlur = 0;

      // Draw "Ions" (Particles)
      const particleCount = Math.floor(level / 5);
      ctx.fillStyle = '#FFFFFF';
      for(let i=0; i<particleCount; i++) {
          // Deterministic "random" positions for React stability would be better, but random is fine for this visual
          const x = (centerX - batteryW/2 + 10) + Math.random() * (fillWidth - 10);
          const y = (centerY - batteryH/2 + 10) + Math.random() * (batteryH - 20);
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
      }
    };

    drawBattery(electrolyteLevel);
  }, [electrolyteLevel]);

  // --- SECTION 4: Calculator Logic ---
  const [weight, setWeight] = useState<number | ''>('');
  const [activity, setActivity] = useState<'sedentary' | 'active' | 'athlete'>('active');
  const [result, setResult] = useState<{ min: string, rec: string, show: boolean }>({ min: '0', rec: '3.8', show: false });

  const calculateHydration = () => {
    if (!weight || typeof weight !== 'number' || weight < 50) return;

    let multiplier = 0.6; 
    if (activity === 'active') multiplier = 0.75;
    if (activity === 'athlete') multiplier = 0.9;

    const totalOz = weight * multiplier;
    const totalLiters = totalOz * 0.0295735;
    
    setResult({
      min: totalLiters.toFixed(1),
      rec: '3.8', // Standard Gallon
      show: true
    });
  };

  return (
    <div className="bg-sync-base min-h-screen text-slate-800 font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className="font-bold text-slate-800 text-lg tracking-wide">SYNC-60 <span className="text-blue-600 font-normal">| Pillar 3</span></span>
           </div>
           <a href={BASE + '/handbook'} className="text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors">
             ← Back to Handbook
           </a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        
        {/* Hero */}
        <header className="text-center py-8">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-4">
                The Conductive Medium
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-600">
                Your body isn't a water tank—it's an electrical battery. 
                <span className="block mt-2 font-medium text-blue-600">Stop drinking to wet your throat. Start drinking to power your brain.</span>
            </p>
        </header>

        {/* SECTION 1: THE SCIENCE */}
        <section id="science" className="scroll-mt-24">
            <div className="mb-6 text-center md:text-left">
                <span className="text-blue-600 font-bold tracking-wide uppercase text-sm">Deep Research Verification</span>
                <h2 className="text-3xl font-bold text-slate-900 mt-1">The "2% Cliff"</h2>
                <p className="mt-4 text-lg text-slate-600 leading-relaxed max-w-3xl">
                    Research validates that a fluid loss of just 2% of body mass triggers a systemic decline. It's not just about thirst; it's about <strong>mitochondrial respiration</strong> and <strong>action potentials</strong>.
                </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl p-6 sm:p-8">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dehydrationData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="loss" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                            <YAxis domain={[40, 105]} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} label={{ value: 'Performance %', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <ReferenceLine x="2%" stroke="red" strokeDasharray="3 3" label={{ value: 'The 2% Cliff', position: 'top', fill: 'red', fontSize: 12 }} />
                            <Line type="monotone" dataKey="cognitive" stroke="#2563EB" strokeWidth={3} dot={{r: 4}} name="Cognitive Function" />
                            <Line type="monotone" dataKey="physical" stroke="#F59E0B" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} name="Physical Output" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-xl font-bold text-slate-800 mb-1">Cognitive</div>
                        <p className="text-xs text-slate-600">Memory recall and focus speed drop significantly. Brain tissue physically shrinks.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-xl font-bold text-slate-800 mb-1">Physical</div>
                        <p className="text-xs text-slate-600">Blood viscosity increases. 10-20% reduction in muscular endurance.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-xl font-bold text-slate-800 mb-1">Metabolic</div>
                        <p className="text-xs text-slate-600">Mitochondrial efficiency plummets. Fat oxidation slows down.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 2: BATTERY MECHANISM */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">The Battery Concept</h3>
                    <div className="relative h-64 w-full bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden mb-4">
                        <canvas ref={canvasRef} width="400" height="250" className="absolute inset-0 w-full h-full"></canvas>
                        <div className="z-10 text-center pointer-events-none">
                            <span className={`text-3xl font-black tracking-widest drop-shadow-md ${batteryStatus.color}`}>{batteryStatus.text}</span>
                            <div className="text-blue-200 text-xs mt-1">Voltage Level</div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Adjust Electrolyte Saturation</label>
                        <input 
                            type="range" 
                            min="0" max="100" 
                            value={electrolyteLevel} 
                            onChange={(e) => setElectrolyteLevel(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>Depleted (Brain Fog)</span>
                            <span>Saturated (High Focus)</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="order-1 md:order-2">
                <span className="text-blue-600 font-bold tracking-wide uppercase text-sm">Mechanism of Action</span>
                <h2 className="text-3xl font-bold text-slate-900 mt-2">Why "Just Water" Fails</h2>
                <p className="mt-4 text-lg text-slate-600">
                    Your nervous system sends signals via <strong>Action Potentials</strong>—literally electricity.
                </p>
                <ul className="mt-6 space-y-4">
                    <li className="flex items-start bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">Na</div>
                        <div className="ml-4">
                            <p className="text-slate-800 font-semibold">Sodium is the Spark</p>
                            <p className="text-slate-600 text-sm">Without sodium, the electrical signal cannot fire. Drinking plain water flushes sodium out (Hyponatremia), actually <em>lowering</em> your "voltage."</p>
                        </div>
                    </li>
                    <li className="flex items-start bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">K</div>
                        <div className="ml-4">
                            <p className="text-slate-800 font-semibold">Potassium is the Reset</p>
                            <p className="text-slate-600 text-sm">Maintains intracellular fluid balance and allows the nerve to reset for the next signal.</p>
                        </div>
                    </li>
                </ul>
            </div>
        </section>

        {/* SECTION 3: THE PROTOCOL */}
        <section id="protocol" className="scroll-mt-24">
            <div className="text-center mb-10">
                <span className="text-blue-600 font-bold tracking-wide uppercase text-sm">The Critical Window</span>
                <h2 className="text-3xl font-bold text-slate-900 mt-2">The Morning Bolus & Coffee Buffer</h2>
                <p className="mt-2 text-slate-600 max-w-2xl mx-auto">How you hydrate in the first 30 minutes dictates your energy for the next 12 hours.</p>
            </div>

            <div className="relative max-w-3xl mx-auto">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 md:left-1/2 md:-ml-0.5"></div>
                
                {/* Step 1 */}
                <div className="relative mb-12 md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="md:text-right ml-16 md:ml-0 px-4 mb-4 md:mb-0">
                        <h3 className="text-xl font-bold text-slate-900">Step 1: Wake Up Depleted</h3>
                        <p className="mt-2 text-slate-600 text-sm">You lose ~1lb of water overnight through breath and sweat. Blood volume is low; heart rate is elevated.</p>
                    </div>
                    <div className="absolute left-0 md:left-1/2 md:-ml-6 flex justify-center items-center w-12 h-12 bg-white rounded-full border-4 border-slate-200 font-bold text-slate-500 z-10">1</div>
                    <div className="ml-16 md:ml-0 md:col-start-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                        <div className="font-bold text-red-500">1-2% Dehydrated</div>
                        <p className="text-xs mt-2 text-slate-500 italic">Do not reach for coffee yet.</p>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="relative mb-12 md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="ml-16 md:ml-0 md:col-start-2 px-4 mb-4 md:mb-0">
                        <h3 className="text-xl font-bold text-slate-900">Step 2: The Morning Bolus</h3>
                        <p className="mt-2 text-slate-600 text-sm">Drink <strong>24-32oz (700ml-1L)</strong> of water with electrolytes immediately. This "re-pressurizes" your vascular system.</p>
                    </div>
                    <div className="absolute left-0 md:left-1/2 md:-ml-6 flex justify-center items-center w-12 h-12 bg-blue-600 rounded-full border-4 border-white font-bold text-white shadow-lg z-10">2</div>
                    <div className="ml-16 md:ml-0 md:col-start-1 md:row-start-1 bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm md:text-right">
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Action</div>
                        <div className="font-bold text-slate-800">Repressurize System</div>
                        <p className="text-xs mt-2 text-slate-600">Restores blood volume → O2 delivery → Mental Clarity.</p>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="relative mb-12 md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="md:text-right ml-16 md:ml-0 px-4 mb-4 md:mb-0">
                        <h3 className="text-xl font-bold text-slate-900">Step 3: The Coffee Buffer</h3>
                        <p className="mt-2 text-slate-600 text-sm">Caffeine inhibits ADH (Antidiuretic Hormone). If you drink coffee without sodium, you flush water out immediately.</p>
                    </div>
                    <div className="absolute left-0 md:left-1/2 md:-ml-6 flex justify-center items-center w-12 h-12 bg-amber-500 rounded-full border-4 border-white font-bold text-white shadow-lg z-10">3</div>
                    <div className="ml-16 md:ml-0 md:col-start-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Strategy</div>
                        <div className="font-bold text-slate-800">Sodium BEFORE Caffeine</div>
                        <p className="text-xs mt-2 text-slate-600">Salt helps retain the fluid, mitigating the diuretic effect.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 4: CALCULATOR */}
        <section id="calculator" className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="grid lg:grid-cols-2 gap-12 relative z-10">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-4">Intake Calculator</h2>
                    <p className="text-slate-300 mb-8 leading-relaxed">
                        The "1-Gallon" rule is a fantastic standard for high performers, but biology varies. Use this "Safety Valve" calculator to find your specific biological minimum vs. the High-Performance Standard.
                    </p>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Body Weight (lbs)</label>
                            <input 
                                type="number" 
                                placeholder="e.g., 180" 
                                value={weight}
                                onChange={(e) => setWeight(parseFloat(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Activity Level</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => setActivity('sedentary')}
                                    className={`py-3 text-sm rounded-lg border transition ${activity === 'sedentary' ? 'bg-slate-700 border-blue-500 text-white ring-2 ring-blue-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Sedentary
                                </button>
                                <button 
                                    onClick={() => setActivity('active')}
                                    className={`py-3 text-sm rounded-lg border transition ${activity === 'active' ? 'bg-slate-700 border-blue-500 text-white ring-2 ring-blue-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Moderate
                                </button>
                                <button 
                                    onClick={() => setActivity('athlete')}
                                    className={`py-3 text-sm rounded-lg border transition ${activity === 'athlete' ? 'bg-slate-700 border-blue-500 text-white ring-2 ring-blue-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Intense
                                </button>
                            </div>
                        </div>
                        <button 
                            onClick={calculateHydration}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg shadow-lg transition transform hover:scale-[1.02]"
                        >
                            Calculate Protocol
                        </button>
                    </div>
                </div>

                <div className={`bg-slate-800/50 rounded-2xl p-8 border border-slate-700 flex flex-col justify-center transition-all duration-500 ${result.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="mb-8 text-center">
                        <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Your Biological Minimum</div>
                        <div className="text-5xl font-extrabold text-blue-400">{result.min} <span className="text-2xl text-slate-400">Liters</span></div>
                        <div className="text-xs text-slate-500 mt-2">Based on activity multiplier</div>
                    </div>

                    <div className="border-t border-slate-700 pt-8 text-center">
                        <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">The Sync-60 Standard</div>
                        <div className="text-5xl font-extrabold text-white">{result.rec} <span className="text-2xl text-slate-400">Liters</span></div>
                        <div className="text-sm text-amber-400 mt-2 font-medium">
                            (1 Gallon)
                        </div>
                    </div>

                    {typeof weight === 'number' && weight < 150 && result.show && (
                        <div className="mt-6 bg-amber-900/30 border border-amber-700/50 p-4 rounded-lg">
                            <p className="text-amber-200 text-xs text-center">
                                <strong>Note:</strong> Since you are under 150lbs, the full gallon requires heavy electrolyte supplementation to avoid flushing. Aim for 3L first.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>

        {/* SECTION 5: RECIPE */}
        <section className="max-w-3xl mx-auto pb-8">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">DIY ELECTROLYTE MIX</div>
                
                <h3 className="text-2xl font-bold text-slate-900 mb-4">The "Sync-60" Cocktail</h3>
                <p className="text-slate-600 mb-8 text-sm">
                    If you don't have commercial electrolyte packets, use this ratio for your Morning Bolus.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-3xl mb-2">💧</div>
                        <div className="font-bold text-slate-800">24-32oz</div>
                        <div className="text-xs text-slate-500">Water</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-3xl mb-2">🧂</div>
                        <div className="font-bold text-slate-800">1/4 - 1/2 tsp</div>
                        <div className="text-xs text-slate-500">Pink Himalayan Salt</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-3xl mb-2">🍋</div>
                        <div className="font-bold text-slate-800">1/2</div>
                        <div className="text-xs text-slate-500">Lemon Squeezed</div>
                    </div>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default PillarHydration;
