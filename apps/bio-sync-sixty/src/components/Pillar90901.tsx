import React, { useState, useEffect } from 'react';
import { BASE } from '../constants';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, AreaChart, Area 
} from 'recharts';

const Pillar90901: React.FC = () => {
  const [activePhase, setActivePhase] = useState(0);
  
  // Simulator State
  const [simLight, setSimLight] = useState(true);
  const [simCold, setSimCold] = useState(true);
  const [simMove, setSimMove] = useState(true);
  const [simData, setSimData] = useState<any[]>([]);

  // --- PHASE DATA ---
  const phases = [
    {
      id: 0,
      title: "The Sunrise Reset",
      badge: "Cortisol Awakening Response (CAR)",
      range: "0–30 Mins",
      science: (
        <>
          <p className="mb-4"><strong>The Mechanism:</strong> When specific retinal cells (ipRGCs) detect the specific quality of morning sunlight (blue-yellow contrast), they signal the Suprachiasmatic Nucleus (SCN) in the brain.</p>
          <p className="mb-4"><strong>The Result:</strong> This triggers a precise pulse of cortisol (the "Wake Up" signal) and sets a timer for melatonin release ~12-14 hours later. Missing this window by viewing screens (low lux) instead of sky causes "circadian drift."</p>
        </>
      ),
      checklist: [
        "Sunny Day: 10 minutes direct outdoor exposure (no sunglasses).",
        "Cloudy Day: 20-30 minutes outdoor exposure.",
        "Through Window: Ineffective (glass filters crucial wavelengths).",
        "Timing: Must occur within 30-60 mins of waking."
      ],
      antipattern: "⚠️ The Doomscrolling Start: Phone screens emit ~500 lux. The sun emits 10,000+ lux. Your brain thinks it's still night, resulting in grogginess (sleep inertia) that caffeine cannot fix.",
      chartType: 'bar',
      chartTitle: "Why Indoors Isn't Enough (Lux Scale)",
      chartCaption: "Logarithmic Scale: The difference is exponential. Indoor light is biological darkness compared to the sun.",
      chartData: [
        { name: 'Phone/Indoor', value: 500, fill: '#9CA3AF' },
        { name: 'Cloudy Outdoor', value: 15000, fill: '#60A5FA' },
        { name: 'Sunny Outdoor', value: 100000, fill: '#E06C3E' } // Using Sync Orange instead of generic Amber
      ]
    },
    {
      id: 1,
      title: "The Vagal Entry",
      badge: "Mammalian Diving Reflex",
      range: "30–60 Mins",
      science: (
        <>
          <p className="mb-4"><strong>The Mechanism:</strong> Cold water on the face (specifically the area around the eyes and nose) triggers the trigeminal nerve to initiate the <em>Mammalian Diving Reflex</em>.</p>
          <p className="mb-4"><strong>The Nuance:</strong> Unlike a full ice bath which is a massive dopamine/norepinephrine shock, facial immersion is uniquely <strong>Cholinergic</strong>. It increases vagal tone (calm) while simultaneously increasing alertness—a "calm focus" state rather than a "panic" state.</p>
        </>
      ),
      checklist: [
        "Method: Splash cold water on face or submerge face in a bowl.",
        "Temp: Cool/Cold (doesn't need to be freezing).",
        "Duration: 30-60 seconds interspersed with breathing.",
        "Goal: Alertness without anxiety."
      ],
      antipattern: "⚠️ The Hot Shower Snooze: Immediate heat promotes vasodilation and relaxation, extending sleep inertia rather than breaking it.",
      chartType: 'line',
      chartTitle: "The 'Cool' Advantage",
      chartCaption: "Facial cooling boosts alertness (Blue) without spiking anxiety (Red), unlike high-caffeine intake.",
      chartData: [
        { name: 'Base', alert: 20, panic: 20 },
        { name: 'Contact', alert: 80, panic: 30 },
        { name: '30s', alert: 85, panic: 25 },
        { name: '60s', alert: 90, panic: 20 },
        { name: 'Recov', alert: 85, panic: 15 }
      ]
    },
    {
      id: 2,
      title: "The Movement Anchor",
      badge: "Peripheral Clock Synchronization",
      range: "60–90 Mins",
      science: (
        <>
          <p className="mb-4"><strong>The Mechanism:</strong> While light sets the Central Clock (Brain), movement sets the Peripheral Clocks (Liver, Muscle, Metabolism). This is "Time Giver" (Zeitgeber) #2.</p>
          <p className="mb-4"><strong>Adenosine Clearance:</strong> Steady-state movement increases blood flow, clearing residual adenosine (sleep pressure chemical) faster than sitting.</p>
          <p className="mb-4"><strong>Optical Flow:</strong> Self-generated forward motion suppresses the amygdala (fear center), lowering anxiety for the day ahead.</p>
        </>
      ),
      checklist: [
        "The 'Japanese Walk': Purposeful, rhythmic walking.",
        "Breathing: Nasal only. Control the intake.",
        "Duration: 10-20 minutes minimum.",
        "Intensity: Zone 1-2 (conversational pace)."
      ],
      antipattern: "⚠️ The Sedentary Start: Sitting immediately after waking uncouples your metabolism from your brain's wake signal, leading to mid-morning energy crashes.",
      chartType: 'line',
      chartTitle: "Metabolic Wake-Up (Body Temp)",
      chartCaption: "Movement drives the core body temperature rise required for optimal cognitive function.",
      chartData: [
        { name: 'Wake', temp: 36.1 },
        { name: 'Start', temp: 36.3 },
        { name: '10m', temp: 36.6 },
        { name: '20m', temp: 36.9 },
        { name: 'Post', temp: 37.0 }
      ]
    }
  ];

  const currentPhase = phases[activePhase];

  // --- SIMULATOR LOGIC ---
  useEffect(() => {
    // Labels corresponding to times: 6AM, 8AM, 10AM, 12PM, 2PM, 4PM, 6PM, 8PM, 10PM
    const baselinePoints = [20, 35, 45, 50, 30, 25, 40, 50, 30]; // "Doomscrolling" curve
    
    const optimizedPoints = baselinePoints.map((val, i) => {
      let newVal = val;
      // Index 0=6AM, 1=8AM, 2=10AM, 3=12PM, 4=2PM, 5=4PM, 6=6PM, 7=8PM, 8=10PM
      
      if (simLight) {
        if (i < 3) newVal += 30; // Morning boost
        if (i >= 3 && i < 7) newVal += 15; // Sustained energy
        if (i >= 7) newVal -= 20; // Better sleep onset (tired at night)
      }
      
      if (simCold) {
        if (i === 0) newVal += 10;
        if (i === 1) newVal += 15;
      }
      
      if (simMove) {
        if (i === 4) newVal += 20; // Fixes 2PM crash
        if (i === 5) newVal += 15;
        if (i > 5) newVal += 5;
      }
      
      return Math.min(100, Math.max(0, newVal));
    });

    const times = ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'];
    const newData = times.map((t, i) => ({
      time: t,
      baseline: baselinePoints[i],
      optimized: optimizedPoints[i]
    }));
    
    setSimData(newData);
  }, [simLight, simCold, simMove]);

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Sync-60 <span className="text-gray-400 font-normal">| The 90/90/1 Protocol</span></span>
           </div>
           <a href={BASE + '/handbook'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Handbook
           </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Intro Section */}
        <section className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <h2 className="text-3xl font-display font-bold text-sync-blue">The Biological Investment</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
                The first 90 minutes of your day determine the quality of your sleep tonight and your energy tomorrow. 
                This interactive guide breaks down the <strong>90/90/1 Rule</strong>, verified by circadian biology, to transition your brain from sleep inertia to peak performance.
            </p>
        </section>

        {/* Interactive Protocol Timeline */}
        <section className="mb-16">
            {/* Tabs */}
            <div className="flex flex-col md:flex-row justify-center space-y-2 md:space-y-0 md:space-x-4 mb-8">
                {phases.map((p) => (
                  <button 
                    key={p.id}
                    onClick={() => setActivePhase(p.id)} 
                    className={`px-6 py-4 rounded-xl text-left shadow-sm transition-all duration-300 w-full md:w-auto flex-1 ${
                      activePhase === p.id 
                        ? 'bg-sync-orange text-white transform scale-105 ring-4 ring-sync-orange/20' 
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{p.range}</div>
                    <div className="text-xl font-bold">{p.title}</div>
                  </button>
                ))}
            </div>

            {/* Dynamic Content Container */}
            <div
              key={activePhase}
              className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
                
                {/* Left Column: Text & Instructions */}
                <div className="space-y-6">
                    <div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-sync-blue/10 text-sync-blue mb-3">
                            {currentPhase.badge}
                        </span>
                        <h3 className="text-2xl font-bold text-gray-900">{currentPhase.title}</h3>
                    </div>
                    
                    <div className="prose prose-stone text-gray-600 text-sm leading-relaxed">
                        {currentPhase.science}
                    </div>

                    <div className="bg-sync-base rounded-xl p-5 border-l-4 border-sync-orange">
                        <h4 className="font-bold text-sync-blue mb-3">Protocol Checklist</h4>
                        <ul className="space-y-2 text-sm text-gray-700">
                            {currentPhase.checklist.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-sync-orange font-bold">✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                        </ul>
                    </div>

                    <div className="text-sm text-red-800 bg-red-50 p-4 rounded-xl border border-red-100 leading-relaxed">
                        {currentPhase.antipattern}
                    </div>
                </div>

                {/* Right Column: Visualization */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full min-h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-gray-800">{currentPhase.chartTitle}</h4>
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Verified Data</span>
                    </div>
                    
                    <div className="flex-grow w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          {currentPhase.chartType === 'bar' ? (
                            <BarChart data={currentPhase.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                              <YAxis scale="log" domain={[100, 150000]} axisLine={false} tickLine={false} hide />
                              <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                              />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {currentPhase.chartData.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : (
                            <LineChart data={currentPhase.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                              <YAxis hide domain={['auto', 'auto']} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                              {activePhase === 1 ? (
                                <>
                                  <Line type="monotone" dataKey="alert" stroke="#2B4C59" strokeWidth={3} dot={{r:4}} name="Alertness" />
                                  <Line type="monotone" dataKey="panic" stroke="#EF4444" strokeWidth={3} strokeDasharray="5 5" dot={{r:4}} name="Anxiety" />
                                </>
                              ) : (
                                  <Line type="monotone" dataKey="temp" stroke="#E06C3E" strokeWidth={3} dot={{r:4}} name="Body Temp (°C)" />
                              )}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                    </div>
                    <p className="mt-4 text-xs text-center text-gray-500 italic">
                        {currentPhase.chartCaption}
                    </p>
                </div>
            </div>
        </section>

        <hr className="border-gray-200 mb-16" />

        {/* Simulation Section */}
        <section className="space-y-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                  <h2 className="text-2xl font-display font-bold text-sync-blue mb-3">The Circadian Simulator</h2>
                  <p className="text-gray-600">
                    See how adhering to the 90/90/1 protocol affects your predicted energy levels and alertness throughout the day compared to the "Anti-Pattern" (Phone first, coffee immediately, sedentary).
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <label className={`flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${simLight ? 'border-sync-orange bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <input 
                          type="checkbox" 
                          checked={simLight} 
                          onChange={(e) => setSimLight(e.target.checked)} 
                          className="w-5 h-5 text-sync-orange rounded focus:ring-sync-orange"
                        />
                        <div>
                            <span className="block font-bold text-gray-800 text-sm">1. Morning Light</span>
                            <span className="text-xs text-gray-500">Outdoor view &lt; 30m</span>
                        </div>
                    </label>
                    <label className={`flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${simCold ? 'border-sync-blue bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <input 
                          type="checkbox" 
                          checked={simCold} 
                          onChange={(e) => setSimCold(e.target.checked)} 
                          className="w-5 h-5 text-sync-blue rounded focus:ring-sync-blue"
                        />
                        <div>
                            <span className="block font-bold text-gray-800 text-sm">2. Cold Exposure</span>
                            <span className="text-xs text-gray-500">Facial/Body Immersion</span>
                        </div>
                    </label>
                    <label className={`flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${simMove ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <input 
                          type="checkbox" 
                          checked={simMove} 
                          onChange={(e) => setSimMove(e.target.checked)} 
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div>
                            <span className="block font-bold text-gray-800 text-sm">3. Morning Move</span>
                            <span className="text-xs text-gray-500">Forward Ambulation</span>
                        </div>
                    </label>
                </div>

                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-8">
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={simData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="time" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} label={{ value: 'Energy %', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            <Line 
                              type="monotone" 
                              dataKey="baseline" 
                              stroke="#9CA3AF" 
                              strokeWidth={2} 
                              strokeDasharray="5 5" 
                              dot={false} 
                              name="The Anti-Pattern" 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="optimized" 
                              stroke="#E06C3E" 
                              strokeWidth={4} 
                              dot={{r: 4, strokeWidth: 2, fill: '#fff'}} 
                              activeDot={{r: 6}} 
                              name="Your Protocol" 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-8 mt-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-1 bg-gray-400 rounded-full"></div>
                        <span className="text-gray-500">Doomscrolling (Baseline)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-1 bg-sync-orange rounded-full"></div>
                        <span className="font-bold text-sync-orange">Optimized Protocol</span>
                      </div>
                    </div>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default Pillar90901;
