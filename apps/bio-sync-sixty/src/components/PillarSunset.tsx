import React, { useState, useEffect } from 'react';
import { BASE } from '../constants';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, ReferenceLine
} from 'recharts';

const PillarSunset: React.FC = () => {
  // --- STATE ---
  const [lightLevel, setLightLevel] = useState(100);
  const [mode, setMode] = useState<'day' | 'sunset' | 'night'>('day');
  const [isDeepSleep, setIsDeepSleep] = useState(false);
  const [sleepTime, setSleepTime] = useState("22:30");
  const [schedule, setSchedule] = useState<{t90: string, t60: string, t30: string} | null>(null);

  // --- THEME LOGIC ---
  useEffect(() => {
    if (lightLevel > 60) setMode('day');
    else if (lightLevel > 20) setMode('sunset');
    else setMode('night');
  }, [lightLevel]);

  // Dynamic Styles
  const containerClass = {
    day: 'bg-[#F3F0E6] text-slate-800',
    sunset: 'bg-stone-900 text-stone-200',
    night: 'bg-[#0F172A] text-indigo-100'
  }[mode];

  const cardClass = {
    day: 'bg-white border-stone-200 shadow-sm',
    sunset: 'bg-stone-800 border-stone-700 shadow-lg',
    night: 'bg-[#1E293B] border-slate-700 shadow-2xl shadow-indigo-900/20'
  }[mode];

  const textAccent = {
    day: 'text-sync-blue',
    sunset: 'text-amber-500',
    night: 'text-indigo-400'
  }[mode];

  // --- DATA ---
  const blueLightData = [
    { nm: 380, suppression: 10 }, { nm: 400, suppression: 20 },
    { nm: 420, suppression: 45 }, { nm: 440, suppression: 80 },
    { nm: 460, suppression: 100 }, { nm: 480, suppression: 95 },
    { nm: 500, suppression: 60 }, { nm: 550, suppression: 20 },
    { nm: 600, suppression: 5 }, { nm: 650, suppression: 2 },
    { nm: 700, suppression: 0 }
  ];

  const glymphaticData = [
    { name: 'Awake', rate: 15, fill: '#9CA3AF' },
    { name: 'Light Sleep', rate: 30, fill: '#60A5FA' },
    { name: 'Deep Sleep', rate: isDeepSleep ? 95 : 15, fill: isDeepSleep ? '#4F46E5' : '#E5E7EB' }
  ];

  // --- CALCULATOR ---
  const calculateSchedule = () => {
    const [hours, minutes] = sleepTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);

    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    setSchedule({
      t90: fmt(new Date(date.getTime() - 90 * 60000)),
      t60: fmt(new Date(date.getTime() - 60 * 60000)),
      t30: fmt(new Date(date.getTime() - 30 * 60000)),
    });
  };

  return (
    <div className={`min-h-screen transition-colors duration-700 font-sans pb-20 ${containerClass}`}>
      
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors duration-700 ${mode === 'day' ? 'bg-white/95 border-gray-200/50' : mode === 'sunset' ? 'bg-stone-900/95 border-stone-800' : 'bg-[#0F172A]/95 border-indigo-900/30'}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className={`font-bold text-lg tracking-wide ${mode === 'day' ? 'text-slate-800' : 'text-white'}`}>SYNC-60 <span className={`font-normal ${textAccent}`}>| Pillar 5</span></span>
           </div>
           <a href={BASE + '/handbook'} className={`text-sm font-bold transition-colors ${mode === 'day' ? 'text-gray-500 hover:text-sync-blue' : 'text-gray-400 hover:text-white'}`}>
             ← Back to Handbook
           </a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-20">
        
        {/* HERO: Slider & Concept */}
        <header className="text-center pt-8">
            <div className={`inline-block px-3 py-1 mb-6 text-xs font-bold tracking-wider uppercase rounded-full ${mode === 'day' ? 'bg-blue-100 text-blue-800' : mode === 'sunset' ? 'bg-amber-900/30 text-amber-500' : 'bg-indigo-900/30 text-indigo-400'}`}>
                Neurobiology of Sleep
            </div>
            <h1 className={`text-4xl sm:text-6xl font-display font-bold mb-6 leading-tight transition-colors duration-500 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>
                Pillar 5: <br/>The Digital Sunset
            </h1>
            <p className={`text-xl mb-12 max-w-2xl mx-auto leading-relaxed transition-colors duration-500 ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>
                Sleep isn't just rest; it's a biological cleaning process. 
                Use the slider to simulate the sunset and trigger the brain's recovery mechanisms.
            </p>

            <div className={`max-w-md mx-auto p-8 rounded-2xl border transition-all duration-700 ${cardClass}`}>
                <label className="block text-sm font-bold mb-4 flex justify-between items-center">
                    <span>Environmental Light</span>
                    <span className={`text-lg ${textAccent}`}>
                        {mode === 'day' ? 'Daylight (Blue Rich)' : mode === 'sunset' ? 'Sunset (Warm)' : 'Darkness (Ideal)'}
                    </span>
                </label>
                <input 
                    type="range" 
                    min="0" max="100" 
                    value={lightLevel} 
                    onChange={(e) => setLightLevel(parseInt(e.target.value))}
                    className="w-full h-3 bg-gradient-to-r from-indigo-900 via-amber-500 to-blue-400 rounded-lg appearance-none cursor-pointer mb-2 transform rotate-180"
                />
                <div className="flex justify-between text-xs text-gray-500 font-mono uppercase tracking-widest mt-2">
                    <span>Night</span>
                    <span>Sunset</span>
                    <span>Noon</span>
                </div>

                <div className={`mt-6 p-4 rounded-xl border transition-colors duration-500 ${mode === 'day' ? 'bg-blue-50 border-blue-100' : mode === 'sunset' ? 'bg-amber-900/20 border-amber-800/50' : 'bg-indigo-900/20 border-indigo-800/50'}`}>
                    <p className={`text-sm font-bold ${mode === 'day' ? 'text-blue-800' : mode === 'sunset' ? 'text-amber-500' : 'text-indigo-300'}`}>
                        Hormonal Status: 
                        <span className="block mt-1 font-normal opacity-90">
                            {mode === 'day' ? 'Cortisol High / Melatonin Blocked' : mode === 'sunset' ? 'Cortisol Dropping / Melatonin Rising' : 'Melatonin Peak Flow / Glymphatics Ready'}
                        </span>
                    </p>
                </div>
            </div>
        </header>

        {/* SECTION 1: THE MECHANISM (Blue Light) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
                <h2 className={`text-3xl font-display font-bold mb-6 ${textAccent}`}>The "Blue Light Brake"</h2>
                <p className={`text-lg mb-6 leading-relaxed ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Your eyes contain special sensors called <strong>ipRGCs</strong>. These cells aren't for vision—they are for timekeeping.
                </p>
                <p className={`leading-relaxed mb-6 ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>
                    When specific wavelengths of light (Blue: 460–480nm) hit these cells, they send a "Daytime Signal" directly to the Master Clock (SCN). This instantly <strong>halts</strong> the production of Melatonin.
                </p>
                <div className={`p-4 rounded-r-lg border-l-4 ${mode === 'day' ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-amber-900/20 border-amber-500 text-amber-100'}`}>
                    <p className="text-sm font-bold">
                        💡 Insight: It's not just "light." It's a specific frequency that acts as a chemical brake on your sleep system.
                    </p>
                </div>
            </div>

            <div className={`p-6 rounded-2xl border ${cardClass}`}>
                <div className="mb-6">
                    <h3 className={`text-lg font-bold ${mode === 'day' ? 'text-slate-800' : 'text-white'}`}>Melatonin Suppression Sensitivity</h3>
                    <p className="text-xs text-gray-500">Wavelength (nm) vs. % Suppression</p>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={blueLightData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={mode === 'day' ? '#f3f4f6' : '#334155'} />
                            <XAxis dataKey="nm" tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                            <YAxis hide domain={[0, 110]} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <ReferenceLine x={460} stroke="red" strokeDasharray="3 3" label={{ value: 'Peak', fill: 'red', fontSize: 12 }} />
                            <Line type="monotone" dataKey="suppression" stroke="#3B82F6" strokeWidth={3} dot={{r: 0}} activeDot={{r: 6}} fill="url(#colorBlue)" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Peak Sensitivity (460nm)</span>
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Safe Zone ({'>'}600nm)</span>
                </div>
            </div>
        </section>

        {/* SECTION 2: THE SCIENCE (Glymphatic System) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className={`order-2 lg:order-1 p-6 rounded-2xl border ${cardClass}`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-lg font-bold ${mode === 'day' ? 'text-slate-800' : 'text-white'}`}>Toxin Clearance Rate</h3>
                    <button 
                        onClick={() => setIsDeepSleep(!isDeepSleep)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${isDeepSleep ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                        {isDeepSleep ? 'Wake Up' : 'Enter Deep Sleep'}
                    </button>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={glymphaticData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={mode === 'day' ? '#f3f4f6' : '#334155'} />
                            <XAxis dataKey="name" tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} />
                            <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                                {glymphaticData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className={`mt-4 p-3 rounded-lg text-center text-sm font-bold transition-colors ${isDeepSleep ? 'bg-green-100 text-green-800' : 'bg-indigo-50 text-indigo-800'}`}>
                    {isDeepSleep 
                        ? "State: DEEP SLEEP. Cells shrink 60%. Waste flushed." 
                        : "State: AWAKE. Waste clearance blocked."}
                </div>
            </div>

            <div className="order-1 lg:order-2 space-y-6">
                <div>
                    <h2 className={`text-3xl font-display font-bold mb-4 ${textAccent}`}>The "Brain Wash"</h2>
                    <p className={`text-lg leading-relaxed ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Why do we sleep? To take out the trash. The <strong>Glymphatic System</strong> is the brain's waste clearance mechanism.
                    </p>
                </div>
                
                <div className="space-y-4">
                    <div className="group">
                        <h4 className={`font-bold text-lg mb-1 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>1. The Accumulation</h4>
                        <p className={`text-sm ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>During the day, your brain accumulates metabolic waste, including beta-amyloid and tau proteins.</p>
                    </div>
                    <div className="group">
                        <h4 className={`font-bold text-lg mb-1 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>2. The 60% Shrink</h4>
                        <p className={`text-sm ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>During Slow Wave Sleep (Deep Sleep), glial cells shrink by up to 60%, creating channels for fluid flow.</p>
                    </div>
                    <div className="group">
                        <h4 className={`font-bold text-lg mb-1 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>3. The Wash</h4>
                        <p className={`text-sm ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>Cerebrospinal fluid floods these spaces, washing away toxins. <span className="text-sync-orange">The Digital Sunset is required</span> to reach these deep sleep stages.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 3: AIRPLANE MODE */}
        <section className={`py-12 px-6 rounded-3xl border transition-colors ${cardClass}`}>
            <h2 className={`text-2xl font-display font-bold text-center mb-10 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>
                The "Airplane Mode" Factor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={`p-6 rounded-2xl border transition-colors ${mode === 'day' ? 'bg-red-50 border-red-100' : 'bg-red-900/20 border-red-900/50'}`}>
                    <div className="text-4xl mb-4">🔔</div>
                    <h3 className={`font-bold mb-2 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>Hyper-Vigilance</h3>
                    <p className={`text-sm ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>The mere presence of a phone keeps the brain in "threat detection" mode, anticipating notifications.</p>
                </div>
                <div className={`p-6 rounded-2xl border transition-colors ${mode === 'day' ? 'bg-orange-50 border-orange-100' : 'bg-orange-900/20 border-orange-900/50'}`}>
                    <div className="text-4xl mb-4">📉</div>
                    <h3 className={`font-bold mb-2 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>Fragmented SWS</h3>
                    <p className={`text-sm ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>This low-level anxiety prevents the brain from fully committing to the deep restorative stages.</p>
                </div>
                <div className={`p-6 rounded-2xl border transition-colors ${mode === 'day' ? 'bg-green-50 border-green-100' : 'bg-green-900/20 border-green-900/50'}`}>
                    <div className="text-4xl mb-4">✈️</div>
                    <h3 className={`font-bold mb-2 ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>The Solution</h3>
                    <p className={`text-sm ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>Airplane Mode or removing the device from the room is the only biological "Safety Signal."</p>
                </div>
            </div>
        </section>

        {/* SECTION 4: PROTOCOL CALCULATOR */}
        <section className="max-w-2xl mx-auto">
            <h2 className={`text-2xl font-display font-bold text-center mb-8 ${textAccent}`}>Generate Your Protocol</h2>
            
            <div className={`p-8 rounded-3xl border transition-colors ${cardClass}`}>
                <div className="flex flex-col md:flex-row gap-6 items-end mb-8">
                    <div className="w-full">
                        <label className={`block text-sm font-bold mb-2 ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>Desired Sleep Time</label>
                        <input 
                            type="time" 
                            value={sleepTime} 
                            onChange={(e) => setSleepTime(e.target.value)}
                            className={`w-full p-4 rounded-xl border font-mono text-lg outline-none focus:ring-2 focus:ring-sync-orange transition-colors ${mode === 'day' ? 'bg-gray-50 border-gray-200 text-slate-900' : 'bg-black/20 border-gray-700 text-white'}`}
                        />
                    </div>
                    <button 
                        onClick={calculateSchedule}
                        className="w-full md:w-auto px-8 py-4 bg-sync-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                    >
                        Calculate
                    </button>
                </div>

                {schedule && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center p-4 rounded-xl bg-orange-900/10 border border-orange-500/20">
                            <div className="w-16 text-center font-mono font-bold text-sync-orange">{schedule.t90}</div>
                            <div className="ml-4">
                                <div className={`font-bold ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>Phase 1: The Red Shift</div>
                                <div className={`text-xs ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>Turn phone to Red Scale. Dim overheads.</div>
                            </div>
                        </div>
                        <div className="flex items-center p-4 rounded-xl bg-indigo-900/10 border border-indigo-500/20">
                            <div className="w-16 text-center font-mono font-bold text-indigo-500">{schedule.t60}</div>
                            <div className="ml-4">
                                <div className={`font-bold ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>Phase 2: The Disconnect</div>
                                <div className={`text-xs ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>Phone to Airplane Mode. No more screens.</div>
                            </div>
                        </div>
                        <div className="flex items-center p-4 rounded-xl bg-slate-900/5 border border-slate-500/20">
                            <div className="w-16 text-center font-mono font-bold text-slate-500">{schedule.t30}</div>
                            <div className="ml-4">
                                <div className={`font-bold ${mode === 'day' ? 'text-slate-900' : 'text-white'}`}>Phase 3: The Analog Hour</div>
                                <div className={`text-xs ${mode === 'day' ? 'text-slate-600' : 'text-slate-400'}`}>Fiction reading, stretching, or journaling.</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>

      </main>
    </div>
  );
};

export default PillarSunset;
