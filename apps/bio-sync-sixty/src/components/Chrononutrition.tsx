import React, { useState } from 'react';
import { BASE } from '../constants';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, AreaChart, Area 
} from 'recharts';

const Chrononutrition: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'insulin' | 'jetlag' | 'switch' | 'repair'>('insulin');
  const [isArticleOpen, setIsArticleOpen] = useState(false);

  // --- TAB 1: INSULIN LOGIC ---
  const [mealTime, setMealTime] = useState<'morning' | 'evening'>('morning');
  const insulinData = mealTime === 'morning' 
    ? [
        { name: 'Baseline', value: 85 },
        { name: '1 Hr Post', value: 125 },
        { name: '2 Hr Post', value: 105 },
        { name: '3 Hr Post', value: 90 }
      ]
    : [
        { name: 'Baseline', value: 85 },
        { name: '1 Hr Post', value: 155 },
        { name: '2 Hr Post', value: 145 },
        { name: '3 Hr Post', value: 120 }
      ];

  // --- TAB 2: JET LAG LOGIC ---
  const [dinnerTime, setDinnerTime] = useState(18); // 18:00 = 6pm
  const getJetLagStatus = (hour: number) => {
    if (hour <= 19) return { title: "Synchronized", desc: "Dinner aligns with biological evening. Liver and Brain clocks in harmony.", color: "text-sync-blue bg-sync-blue/10 border-sync-blue" };
    if (hour <= 21) return { title: "Partial Desynchrony", desc: "Liver is working while Melatonin is rising. Conflict begins.", color: "text-yellow-700 bg-yellow-50 border-yellow-500" };
    return { title: "Metabolic Jet Lag", desc: "Brain says 'Sleep', Food says 'Wake Up'. Systemic inflammation risk.", color: "text-sync-orange bg-orange-50 border-sync-orange" };
  };
  const jetLagStatus = getJetLagStatus(dinnerTime);

  // --- TAB 3: THE SWITCH LOGIC ---
  const [fastingHours, setFastingHours] = useState(2);
  const getFuelData = () => {
    const data = [];
    for (let i = 0; i <= 24; i++) {
      data.push({
        hour: i,
        glycogen: Math.max(0, 100 - (i * 6)),
        ketones: i < 10 ? 5 : i < 14 ? (i - 10) * 15 : 80
      });
    }
    return data;
  };
  const fuelData = getFuelData();
  
  const getSwitchState = (hours: number) => {
    if (hours < 4) return { text: "FED STATE", bg: "bg-sync-blue" };
    if (hours < 12) return { text: "GLYCOGEN DEPLETION", bg: "bg-gray-500" };
    if (hours < 14) return { text: "INITIATING SWITCH...", bg: "bg-purple-600 animate-pulse" };
    return { text: "KETOSIS / FAT BURNING", bg: "bg-sync-orange" };
  };
  const switchState = getSwitchState(fastingHours);

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Bio-Sync60 <span className="text-gray-400 font-normal">| Chrononutrition</span></span>
           </div>
           <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Home
           </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-16 pb-12 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-display font-bold text-sync-blue mb-4">
           The Clock in Your Liver
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
           It is not just about <em>what</em> you eat, but <em>when</em>. Discover how Early Time-Restricted Eating (eTRE) aligns your peripheral clocks with your master clock.
        </p>
        <div className="mt-6 inline-block px-3 py-1 bg-sync-orange/10 text-sync-orange rounded-full text-xs font-bold uppercase tracking-widest">Validated Mechanism</div>
      </header>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 mb-10 overflow-x-auto">
        <div className="flex space-x-2 md:space-x-4 border-b border-gray-200 pb-1 min-w-max">
          {[
            { id: 'insulin', label: '1. The Factory Shift' },
            { id: 'jetlag', label: '2. Metabolic Jet Lag' },
            { id: 'switch', label: '3. The Switch (14h)' },
            { id: 'repair', label: '4. The Cleaning Crew' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'border-sync-orange text-sync-orange' 
                  : 'border-transparent text-gray-400 hover:text-sync-blue'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- TAB CONTENT --- */}
      <main className="max-w-5xl mx-auto px-4">
        
        {/* MODULE 1: INSULIN */}
        {activeTab === 'insulin' && (
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
             <h2 className="text-2xl font-display font-bold text-sync-blue mb-4">Mechanism 1: Circadian Insulin Sensitivity</h2>
             <p className="text-gray-600 mb-8 leading-relaxed max-w-3xl">
                <strong>Analogy: The Factory Shift.</strong> Your pancreas operates on a shift schedule. In the morning, the full crew is present to process glucose. In the evening, only a skeleton crew remains. Melatonin actively suppresses insulin secretion to prevent nighttime hypoglycemia.
             </p>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="bg-sync-base p-8 rounded-2xl border border-sync-blue/5">
                   <h3 className="font-bold text-sync-blue mb-6">Simulate Meal Time</h3>
                   <div className="flex gap-4 mb-8">
                     <button 
                       onClick={() => setMealTime('morning')}
                       className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                         mealTime === 'morning' ? 'bg-sync-orange text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'
                       }`}
                     >
                       ☀️ 8:00 AM Meal
                     </button>
                     <button 
                       onClick={() => setMealTime('evening')}
                       className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                         mealTime === 'evening' ? 'bg-sync-blue text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'
                       }`}
                     >
                       🌙 8:00 PM Meal
                     </button>
                   </div>
                   
                   <div className={`p-4 rounded-xl border-l-4 transition-all ${mealTime === 'morning' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                      <h4 className={`font-bold text-sm mb-1 ${mealTime === 'morning' ? 'text-green-800' : 'text-red-800'}`}>
                        {mealTime === 'morning' ? 'Morning Efficiency' : 'Evening Resistance'}
                      </h4>
                      <p className={`text-xs ${mealTime === 'morning' ? 'text-green-700' : 'text-red-700'}`}>
                        {mealTime === 'morning' 
                          ? "Pancreas is highly responsive. Glucose is cleared quickly. Minimal fat storage signal." 
                          : "Melatonin interferes with insulin. Same meal causes higher spike. Increased fat storage signal."}
                      </p>
                   </div>
                </div>

                <div className="h-[300px] w-full">
                   <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Glucose Area Under Curve (AUC)</p>
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={insulinData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                       <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                       <YAxis hide />
                       <Tooltip cursor={{fill: 'transparent'}} />
                       <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                         {insulinData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={mealTime === 'morning' ? '#E06C3E' : '#2B4C59'} />
                         ))}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
        )}

        {/* MODULE 2: JET LAG */}
        {activeTab === 'jetlag' && (
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
             <h2 className="text-2xl font-display font-bold text-sync-blue mb-4">Mechanism 2: Metabolic Jet Lag</h2>
             <p className="text-gray-600 mb-8 leading-relaxed max-w-3xl">
                The Master Clock (Brain/SCN) is set by <strong>Light</strong>. Peripheral Clocks (Liver) are set by <strong>Food</strong>. Eating late sends your liver to a different time zone than your brain.
             </p>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
               
               {/* Clocks Visual */}
               <div className="flex justify-center items-center gap-8 py-8 bg-sync-base/30 rounded-2xl">
                  {/* Brain Clock */}
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-full border-4 border-gray-200 bg-white relative mx-auto mb-4 shadow-inner">
                       <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-gray-300"></div>
                       <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-gray-300"></div>
                       {/* Brain Hand Fixed at Noon/Day */}
                       <div className="absolute top-1/2 left-1/2 w-1 h-12 bg-sync-orange origin-bottom -translate-x-1/2 -translate-y-full rounded-full"></div>
                       <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-sync-dark rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                    <h4 className="font-bold text-sync-blue text-sm">Brain (SCN)</h4>
                    <p className="text-xs text-gray-500">Set by Light ☀️</p>
                  </div>

                  {/* Liver Clock */}
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-full border-4 border-gray-200 bg-white relative mx-auto mb-4 shadow-inner">
                       <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-gray-300"></div>
                       <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-gray-300"></div>
                       {/* Liver Hand Rotates */}
                       <div 
                         className="absolute top-1/2 left-1/2 w-1 h-12 bg-sync-blue origin-bottom -translate-x-1/2 -translate-y-full rounded-full transition-transform duration-500"
                         style={{ transform: `rotate(${(dinnerTime - 18) * 20}deg)` }}
                       ></div>
                       <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-sync-dark rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                    <h4 className="font-bold text-sync-blue text-sm">Liver Clock</h4>
                    <p className="text-xs text-gray-500">Set by Food 🍔</p>
                  </div>
               </div>

               {/* Controls */}
               <div className="flex flex-col justify-center">
                  <label className="text-sm font-bold text-gray-500 uppercase mb-4">Adjust Dinner Time</label>
                  <input 
                    type="range" 
                    min="17" max="23" 
                    value={dinnerTime} 
                    onChange={(e) => setDinnerTime(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-2 accent-sync-blue"
                  />
                  <div className="flex justify-between text-xs text-gray-400 font-bold uppercase mb-8">
                    <span>5 PM (Synced)</span>
                    <span>11 PM (Jet Lag)</span>
                  </div>

                  <div className={`p-6 rounded-2xl border-l-4 transition-all ${jetLagStatus.color}`}>
                    <h3 className="font-bold text-lg mb-2">{jetLagStatus.title}</h3>
                    <p className="text-sm opacity-90">{jetLagStatus.desc}</p>
                    <p className="text-xs mt-4 font-mono font-bold">Selected Time: {dinnerTime}:00</p>
                  </div>
               </div>

             </div>
          </div>
        )}

        {/* MODULE 3: THE SWITCH */}
        {activeTab === 'switch' && (
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
             <h2 className="text-2xl font-display font-bold text-sync-blue mb-4">Mechanism 3: The Metabolic Switch</h2>
             <p className="text-gray-600 mb-8 leading-relaxed max-w-3xl">
                <strong>The Metabolic Switch.</strong> Before burning fat, the liver must deplete glycogen. This switch typically <strong>initiates transition</strong> between 12 and 36 hours of fasting (Anton et al., 2018), depending on pre-fast meal composition and activity.
             </p>

             <div className="bg-sync-dark rounded-2xl p-8 text-white shadow-xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Control */}
                <div className="lg:col-span-1 flex flex-col justify-center">
                   <div className="text-center mb-8">
                     <span className="text-6xl font-display font-bold">{fastingHours}</span>
                     <span className="text-xl text-gray-400 ml-2">Hours Fasted</span>
                   </div>
                   <input 
                    type="range" 
                    min="0" max="24" 
                    value={fastingHours} 
                    onChange={(e) => setFastingHours(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-6 accent-sync-orange"
                  />
                  <div className={`py-3 px-4 rounded-full text-center text-xs font-bold uppercase tracking-widest transition-colors ${switchState.bg} text-white`}>
                    {switchState.text}
                  </div>
                </div>

                {/* Chart */}
                <div className="lg:col-span-2 h-[300px]">
                   <p className="text-center text-xs font-bold text-gray-500 uppercase mb-4">Fuel Source Mix</p>
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={fuelData}>
                       <defs>
                         <linearGradient id="colorGlycogen" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                         </linearGradient>
                         <linearGradient id="colorKetones" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#E06C3E" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#E06C3E" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="hour" stroke="#555" tick={{fontSize: 10}} />
                       <YAxis hide />
                       <Tooltip contentStyle={{backgroundColor: '#333', border: 'none', color: '#fff'}} />
                       {/* Reference Line for Current Hour */}
                       <Line type="monotone" dataKey={() => null} stroke="transparent" /> 
                       {/* Render Glycogen */}
                       <Area type="monotone" dataKey="glycogen" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGlycogen)" name="Glycogen (Sugar)" />
                       {/* Render Ketones */}
                       <Area type="monotone" dataKey="ketones" stroke="#E06C3E" fillOpacity={1} fill="url(#colorKetones)" name="Ketones (Fat)" />
                       
                       {/* Current Position Indicator (Simplified visual via active dot or similar not easily done in rechart without custom layer, relying on state update of chart data if needed, but here static chart with slider is fine) */}
                     </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className={`p-4 rounded-xl border transition-colors ${fastingHours < 4 ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                  <div className="font-bold text-sm text-gray-900">0–4 Hours</div>
                  <div className="text-xs text-gray-500">Anabolic. Storing energy.</div>
                </div>
                <div className={`p-4 rounded-xl border transition-colors ${fastingHours >= 4 && fastingHours < 12 ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-100'}`}>
                  <div className="font-bold text-sm text-gray-900">4–12 Hours</div>
                  <div className="text-xs text-gray-500">Catabolic. Using liver glycogen.</div>
                </div>
                <div className={`p-4 rounded-xl border transition-colors ${fastingHours >= 12 ? 'bg-orange-50 border-sync-orange' : 'bg-white border-gray-100'}`}>
                  <div className="font-bold text-sm text-gray-900">12–16 Hours</div>
                  <div className="text-xs text-gray-500">Metabolic Switch Initiation.</div>
                </div>
             </div>
          </div>
        )}

        {/* MODULE 4: REPAIR */}
        {activeTab === 'repair' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2">
             <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100">
                <h2 className="text-2xl font-display font-bold text-sync-blue mb-6">Mechanism 4: The Cleaning Crew</h2>
                <p className="text-gray-600 mb-8">
                  When digestion stops, renovation begins. The ketone <strong>Beta-Hydroxybutyrate (BHB)</strong> acts as a signaling molecule.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative overflow-hidden group hover:border-sync-blue/30 transition-colors">
                      <div className="absolute top-0 right-0 p-4 text-6xl font-black text-gray-200 group-hover:text-sync-blue/10 transition-colors select-none">BDNF</div>
                      <h3 className="font-bold text-sync-blue text-lg mb-2 relative z-10">Brain Growth</h3>
                      <p className="text-sm text-gray-600 relative z-10">"Miracle-Gro" for the brain. Fasting triggers BDNF expression, supporting neuroplasticity.</p>
                   </div>
                   <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative overflow-hidden group hover:border-sync-orange/30 transition-colors">
                      <div className="absolute top-0 right-0 p-4 text-6xl font-black text-gray-200 group-hover:text-sync-orange/10 transition-colors select-none">NLRP3</div>
                      <h3 className="font-bold text-sync-orange text-lg mb-2 relative z-10">Inflammation Off</h3>
                      <p className="text-sm text-gray-600 relative z-10">The Inflammasome. BHB specifically blocks NLRP3, reducing systemic inflammation.</p>
                   </div>
                </div>
             </div>

             <div className="bg-sync-dark text-white rounded-3xl p-8 shadow-xl">
                <h3 className="font-bold text-sync-orange mb-4">Why Early TRE Wins</h3>
                <p className="text-xs text-gray-400 mb-6">Based on RCTs comparing 8am-2pm vs 12pm-8pm eating windows.</p>
                <ul className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">✓</span>
                    <div>
                      <strong className="block text-white">Insulin Sensitivity</strong>
                      <span className="text-gray-400 text-xs">Significantly improved due to alignment.</span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">✓</span>
                    <div>
                      <strong className="block text-white">Blood Pressure</strong>
                      <span className="text-gray-400 text-xs">Greater reduction in evening systolic BP.</span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">✓</span>
                    <div>
                      <strong className="block text-white">Oxidative Stress</strong>
                      <span className="text-gray-400 text-xs">Lower markers of lipid peroxidation.</span>
                    </div>
                  </li>
                </ul>
             </div>
          </div>
        )}

      </main>

      {/* FULL ARTICLE BUTTON */}
      <section className="max-w-4xl mx-auto px-4 mt-20 text-center">
         <div className="bg-sync-blue/5 rounded-3xl p-12 border border-sync-blue/10">
             <h3 className="text-2xl font-display font-bold text-sync-blue mb-4">Read the Clinical Report</h3>
             <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                 Deep dive into the randomized controlled trials comparing eTRE vs. Late TRE and the molecular mechanisms of clocks.
             </p>
             <button 
                onClick={() => setIsArticleOpen(true)}
                className="bg-sync-blue text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-sync-dark hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-3 mx-auto"
             >
                <span>📄</span>
                <span>Open Full Article</span>
             </button>
         </div>
      </section>

      {/* FULL ARTICLE MODAL */}
      {isArticleOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-sync-dark/60 backdrop-blur-sm" onClick={() => setIsArticleOpen(false)}></div>
              <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="text-xl font-display font-bold text-sync-blue">The Clock in Your Liver</h3>
                      <button onClick={() => setIsArticleOpen(false)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors text-gray-600 font-bold">&times;</button>
                  </div>
                  <div className="overflow-y-auto p-8 md:p-12 prose prose-slate max-w-none">
                    
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-sync-blue mb-6">The Clock in Your Liver – Why When You Eat Matters</h1>
                    
                    <p className="text-lg text-gray-700 leading-relaxed mb-6">
                        The traditional perspective of metabolic health has long been dominated by the thermodynamic principle of caloric balance, essentially treating the human body as a black box where the only variables of significance are energy input and energy expenditure. However, recent advancements in the field of chrononutrition have introduced a critical third dimension: temporal alignment. The science of chrononutrition posits that the physiological impact of a meal is dictated not only by its caloric and macronutrient composition but also by the specific biological time at which it is consumed. This paradigm shift is rooted in the understanding that our metabolism is governed by a complex hierarchy of internal clocks that synchronize physiological processes with the external environment. This report provides a comprehensive validation of the mechanisms underlying circadian rhythmicity, the metabolic switch, and the systemic benefits of Early Time-Restricted Eating (eTRE), synthesized for the professional and research community.
                    </p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The Architecture of Time: The Master Clock and Peripheral Oscillators</h2>
                    <p className="text-gray-700 mb-4">
                      The human circadian system is organized as a multi-layered hierarchy designed to maintain internal temporal order. At the apex of this hierarchy is the suprachiasmatic nucleus (SCN), located within the hypothalamus. This "Master Clock" consists of approximately 20,000 neurons that generate a self-sustained rhythm of approximately twenty-four hours.1 The SCN acts as the central pacemaker, primarily entrained by the light-dark cycle via the retino-hypothalamic tract. This photosensitive pathway utilizes intrinsically photosensitive retinal ganglion cells to relay information about environmental light to the SCN, allowing it to synchronize the body's internal state with the solar day.1
                    </p>
                    <p className="text-gray-700 mb-4">
                      However, the SCN does not act alone. Every cell in the body contains an intrinsic molecular clock mechanism, consisting of a transcriptional-translational feedback loop (TTFL). This loop involves core clock genes such as <em>CLOCK</em>, <em>BMAL1</em>, <em>PER</em>, and <em>CRY</em>.3 These peripheral clocks are located in almost all tissues, including the liver, skeletal muscle, pancreas, and adipose tissue, and they regulate organ-specific functions such as nutrient metabolism, hormone secretion, and cellular repair.1 While the SCN provides a central time signal through neural and hormonal pathways—notably via the diurnal patterns of melatonin and cortisol—the peripheral clocks possess a significant degree of autonomy.1
                    </p>
                    <p className="text-gray-700 mb-4">
                      A critical distinction arises in how these clocks are "reset" or entrained. While light is the primary zeitgeber (time-giver) for the SCN, food intake is the dominant zeitgeber for peripheral clocks, particularly in the liver.1 Under optimal conditions, the SCN and peripheral clocks are in perfect alignment: light during the day signals wakefulness and activity, while food intake during the same period signals nutrient processing. When these signals diverge—such as when a person eats late into the biological night—a state of internal desynchrony occurs, which will be explored in detail in the following sections.
                    </p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The Factory Shift: Circadian Insulin Sensitivity and Pancreatic Governance</h2>
                    <p className="text-gray-700 mb-4">
                      The metabolism of glucose is perhaps the most visible manifestation of circadian rhythmicity. To explain the variance in glucose tolerance across the day, it is instructive to utilize the "Factory Shift" analogy. In this model, the pancreas is viewed as a manufacturing plant responsible for producing insulin. During the biological morning, this factory is fully staffed, operating at maximum efficiency, and prepared for the high volume of work that comes with daily feeding. This period represents the "Day Shift".9
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The Pancreas on a Schedule: GSIS and Chronotype</h3>
                    <p className="text-gray-700 mb-4">
                      In healthy, metabolically normal individuals, the pancreatic β-cells exhibit a robust circadian rhythm in their capacity for Glucose-Stimulated Insulin Secretion (GSIS). Studies comparing the metabolic response to identical meals have demonstrated that glucose tolerance is significantly higher in the morning (at 8:00 AM) than in the evening (at 8:00 PM).11 This morning peak is not merely a consequence of the overnight fast but is driven by the endogenous circadian system.12
                    </p>
                    <p className="text-gray-700 mb-4">
                      When an identical caloric load or glucose bolus is administered at 8:00 PM, the Glucose Area Under the Curve (AUC) is found to be significantly higher, often by 15% to 20%, compared to the same load at 8:00 AM.14 This exaggerated postprandial glucose response is primarily attributed to a decline in pancreatic β-cell responsiveness. Specifically, the early-phase insulin response—the rapid burst of insulin release that occurs within the first thirty minutes of glucose ingestion is reduced by approximately 27% in the evening.14 In the factory analogy, the evening represents the transition to the "Skeleton Crew." The pancreas is biologically programmed to suppress its insulin output in anticipation of the biological night, a period when insulin levels must remain low to permit the mobilization of fat stores.10
                    </p>

                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Metabolic Parameter</th>
                            <th className="px-4 py-2">Morning (8:00 AM)</th>
                            <th className="px-4 py-2">Evening (8:00 PM)</th>
                            <th className="px-4 py-2">Circadian Variation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Glucose Tolerance</td><td className="px-4 py-2">Peak Efficiency</td><td className="px-4 py-2">Significant Trough</td><td className="px-4 py-2">~18% higher glucose spikes at night 14</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Early-Phase Insulin Secretion</td><td className="px-4 py-2">Maximal Response</td><td className="px-4 py-2">Suppressed</td><td className="px-4 py-2">~27% lower in the biological evening 14</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Pancreatic β-cell Function</td><td className="px-4 py-2">"Full Staffing"</td><td className="px-4 py-2">"Skeleton Crew"</td><td className="px-4 py-2">Actively suppressed during inactive phase 10</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Whole-Body Insulin Sensitivity</td><td className="px-4 py-2">High</td><td className="px-4 py-2">Lower</td><td className="px-4 py-2">Declines as the day progresses 11</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <p className="text-gray-700 mb-4">
                      This circadian variation in β-cell function is further influenced by an individual's chronotype. Individuals with a "Morning Chronotype" (early birds) typically exhibit higher metabolic insulin sensitivity and superior pancreatic β-cell function compared to those with an "Intermediate" or "Evening Chronotype" (night owls).9 Night owls often experience a blunted diurnal pattern of insulin secretion, which increases their baseline risk for developing Type 2 Diabetes.9 Furthermore, the incretin hormones GLP-1 and GIP, which amplify insulin secretion after a meal, also exhibit circadian patterns that are more favorable in the morning for early chronotypes.9
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The Consequences of "Overworking the Skeleton Crew"</h3>
                    <p className="text-gray-700 mb-4">
                      Eating late in the evening forces the pancreatic "Skeleton Crew" to perform the workload intended for the "Full Day Shift." Because the β-cells are in a state of suppressed responsiveness, they cannot produce the requisite insulin at the speed required to manage a large glucose load.10 This results in prolonged hyperglycemia and hyperinsulinemia. Over time, this daily mismatch between workload and capacity leads to the "errors" seen in chronic metabolic disease: persistent insulin resistance, β-cell exhaustion, and elevated systemic inflammation.1
                    </p>
                    <p className="text-gray-700 mb-4">
                      The impact of this circadian mismatch is exacerbated by lifestyle factors such as sleep deprivation. Research has shown that even four consecutive nights of restricted sleep (e.g., 4 hours instead of 8 hours) can reduce insulin sensitivity by 16% in young, healthy adults.16 In this scenario, the skeleton crew is not only understaffed but also exhausted, further increasing the risk of metabolic failure.
                    </p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Metabolic Jet Lag: The Mechanism of Clock Desynchrony</h2>
                    <p className="text-gray-700 mb-4">
                      The term "Metabolic Jet Lag" is used to describe the physiological state of "internal desynchrony" that occurs when the central SCN clock and the peripheral metabolic clocks are no longer in phase with one another. This is most commonly caused by eating late at night or during shift work.1
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The SCN-Liver Misalignment</h3>
                    <p className="text-gray-700 mb-4">
                      As established, the SCN is primarily entrained by light, while the liver clock is entrained by food. When an individual consumes food late in the evening, they are effectively sending a "start of the day" signal to their liver, even though the SCN is signaling "middle of the night" to the rest of the body.2 This creates a situation analogous to sending your liver to a different time zone than your brain.
                    </p>
                    <p className="text-gray-700 mb-4">
                      In the liver, this desynchrony disrupts the expression of thousands of genes that control nutrient metabolism, detoxification, and energy storage.5 Under normal conditions, the SCN coordinates peripheral clocks via the autonomic nervous system and the rhythmic secretion of glucocorticoids and melatonin.1 Melatonin, in particular, rise in the evening and has a suppressive effect on insulin secretion; late eating occurs during this melatonin peak, further impairing the body's ability to handle glucose.6
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Systemic Confusion and Health Implications</h3>
                    <p className="text-gray-700 mb-4">
                      The liver acts as the primary metabolic hub, and when its clock is misaligned, the ripple effects are systemic. Desynchrony between the SCN and hepatic clocks has been identified as a critical driver of Metabolic-Associated Steatotic Liver Disease (MASLD). In mouse models, the loss of synchrony between these clocks, mediated by the <em>PPARα</em> nuclear receptors, exacerbates diet-induced obesity and hepatosteatosis.4 Conversely, restoring synchrony between the liver and SCN clocks has been shown to improve metabolic outcomes, even in environments that remain desynchronous with the external 24-hour cycle.4
                    </p>
                    <p className="text-gray-700 mb-4">
                      In humans, this "Jet Lag" effect manifests as impaired carbohydrate digestion and elevated 24-hour glucose levels.14 Shift workers, who chronically experience this misalignment, have a significantly increased risk of obesity and Type 2 Diabetes.12 Studies have shown that even a short-term, 12-hour inversion of the behavioral cycle (eating and sleeping at the wrong times) increases postprandial glucose by approximately 17% and shifts the timing of peak melatonin and cortisol, leading to a blunted circadian rhythm that further impairs metabolic efficiency.14
                    </p>

                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Clock Component</th>
                            <th className="px-4 py-2">Primary Entrainment Signal</th>
                            <th className="px-4 py-2">Biological Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Suprachiasmatic Nucleus (SCN)</td><td className="px-4 py-2">Light / Dark Cycle</td><td className="px-4 py-2">Master Pacemaker; coordinates systemic rhythms 1</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Liver Clock</td><td className="px-4 py-2">Fasting / Feeding Cycle</td><td className="px-4 py-2">Regulates gluconeogenesis, lipogenesis, and detoxification 5</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Muscle Clock</td><td className="px-4 py-2">Feeding and Activity</td><td className="px-4 py-2">Controls glucose uptake and insulin-stimulated disposal 1</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Pancreatic Clock</td><td className="px-4 py-2">Feeding / Incretins</td><td className="px-4 py-2">Governs insulin biosynthesis and rhythmic GSIS 3</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The Metabolic Switch: Hepatic Glycogen and the 14-Hour Threshold</h2>
                    <p className="text-gray-700 mb-4">
                      A central tenet of chrononutrition is the achievement of the "Metabolic Switch." This switch represents the transition from a state of glucose utilization and storage to a state of fatty acid oxidation and ketone production.20 Understanding the mechanics of this switch requires a deep look into the timeline of hepatic glycogen depletion.
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Emptying the Primary Tank: Glycogen Dynamics</h3>
                    <p className="text-gray-700 mb-4">
                      The human body operates on two primary fuel tanks. The first is the glucose/glycogen tank, located primarily in the liver and skeletal muscle. The liver contains approximately 100 to 120 grams of glycogen, which is the body's primary source of glucose during periods of fasting.24 Before the body can tap into the "reserve tank"—the adipose tissue containing body fat—the liver's glycogen stores must be significantly reduced.
                    </p>
                    <p className="text-gray-700 mb-4">
                      In the resting human, liver glycogen is disassembled via glycogenolysis to maintain blood glucose levels.23 The rate of depletion is determined by the individual's metabolic rate and activity level. While complete depletion of hepatic glycogen can take between 24 and 48 hours in a sedentary state, the "Metabolic Switch" does not require complete exhaustion of these stores.23
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The 12-14 Hour Threshold</h3>
                    <p className="text-gray-700 mb-4">
                      Research indicates that the metabolic pivot toward fat oxidation typically begins to accelerate between 12 and 16 hours after the last meal.20
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700 mb-6">
                        <li><strong>0-12 Hours:</strong> The body remains in the post-absorptive state, relying on circulating glucose and initial glycogen breakdown.21</li>
                        <li><strong>12-14 Hours:</strong> This is often cited as the "Sweet Spot." At this point, insulin levels have dropped sufficiently to disinhibit lipolysis, and liver glycogen stores have decreased to a level that triggers the hepatic production of ketone bodies, specifically β-hydroxybutyrate (BHB).20</li>
                        <li><strong>16-18 Hours:</strong> The body enters a more robust state of ketosis, where BHB levels in the blood begin to rise from low micromolar concentrations to several hundred micromolar (0.2 to 0.5 mM).27</li>
                    </ul>
                    <p className="text-gray-700 mb-4">
                      While deeper ketosis (1.0 - 3.0 mM) typically requires fasts of 48 hours or longer, the initial signaling benefits of ketones occur at the 14-hour mark, supporting the efficacy of the 16:8 or 14:10 fasting protocols.28
                    </p>

                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Fasting Stage</th>
                            <th className="px-4 py-2">Duration</th>
                            <th className="px-4 py-2">Primary Fuel Source</th>
                            <th className="px-4 py-2">Metabolic Signaling Markers</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2">Fed State</td><td className="px-4 py-2">0-4 Hours</td><td className="px-4 py-2">Dietary Glucose</td><td className="px-4 py-2">High insulin; glycogen synthesis 26</td></tr>
                          <tr><td className="px-4 py-2">Early Fasting</td><td className="px-4 py-2">4-12 Hours</td><td className="px-4 py-2">Hepatic Glycogen</td><td className="px-4 py-2">Declining insulin; rising glucagon 27</td></tr>
                          <tr><td className="px-4 py-2 font-bold text-sync-blue">The Switch</td><td className="px-4 py-2 font-bold text-sync-blue">12-16 Hours</td><td className="px-4 py-2">Fatty Acids / Initial Ketones</td><td className="px-4 py-2">Low insulin; onset of BHB signaling 20</td></tr>
                          <tr><td className="px-4 py-2">Early Ketosis</td><td className="px-4 py-2">18-24 Hours</td><td className="px-4 py-2">Ketones / Fat Stores</td><td className="px-4 py-2">BHB levels {'>'} 0.2 mM; glycogen low 27</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The "Cleaning Crew": Ketones, BDNF, and Inflammation</h2>
                    <p className="text-gray-700 mb-4">
                      The importance of the metabolic switch extends beyond energy management; it activates what can be described as the cellular "Cleaning Crew." When digestion ceases, the body shifts its resources from growth and storage to maintenance, renovation, and repair. This is mediated largely by the signaling properties of β-hydroxybutyrate (BHB).
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Ketones as Signaling Molecules: Upregulating BDNF</h3>
                    <p className="text-gray-700 mb-4">
                      For decades, ketones were viewed solely as backup fuel. However, research over the last ten years has revealed that BHB acts as a potent signaling molecule that can cross the blood-brain barrier.22 One of its most profound effects is the upregulation of Brain-Derived Neurotrophic Factor (BDNF).22
                    </p>
                    <p className="text-gray-700 mb-4">
                      BDNF is a member of the nerve growth factor family and is essential for maintaining neuronal survival, synaptic plasticity, and hippocampal neurogenesis.23 It is often referred to as "fertilizer for the brain." BHB increases BDNF expression through several molecular pathways:
                    </p>
                    <ol className="list-decimal pl-5 space-y-2 text-gray-700 mb-6">
                       <li><strong>HDAC Inhibition:</strong> BHB is a natural inhibitor of Class I histone deacetylases (HDACs). By inhibiting HDACs, BHB effectively "unlocks" the <em>BDNF</em> gene promoter, allowing for increased transcription.23</li>
                       <li><strong>Epigenetic Remodeling:</strong> BHB exposure has been shown to increase <em>H3K9ac</em> (an activation mark) and decrease <em>H3K27me3</em> (a repression mark) on the BDNF promoters I, II, IV, and VI in hippocampal neurons.31</li>
                       <li><strong><em>CREB</em> Activation:</strong> In neurons, BHB can induce the transcription of <em>CREB</em>, which in turn upregulates <em>BDNF</em>.23</li>
                    </ol>
                    <p className="text-gray-700 mb-4">
                      These mechanisms explain why short-term fasting and time-restricted eating are frequently associated with improved cognitive function, reduced "brain fog," and enhanced resistance to neuronal stress.21
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Suppressing the NLRP3 Inflammasome: Reducing Inflammation</h3>
                    <p className="text-gray-700 mb-4">
                      In addition to its neurotrophic effects, BHB serves as a critical anti-inflammatory agent. It has been shown to specifically suppress the activation of the NLRP3 inflammasome, a multi-protein complex that triggers the release of pro-inflammatory cytokines like <em>IL-1β</em> and <em>IL-18</em>.32
                    </p>
                    <p className="text-gray-700 mb-4">
                      Mechanistically, BHB inhibits the NLRP3 inflammasome by:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700 mb-6">
                        <li>Preventing potassium (K+) efflux from the cell, which is a key trigger for inflammasome assembly.32</li>
                        <li>Reducing <em>ASC</em> oligomerization and the formation of <em>ASC</em> "specks," which are essential for the activation of caspase-1.32</li>
                    </ul>
                    <p className="text-gray-700 mb-4">
                      This anti-inflammatory effect occurs at sub-millimolar concentrations of BHB (0.2 to 0.5 mM)—levels that are reliably achieved after 14 to 16 hours of fasting in humans.28 This confirms that the "regenerative" benefits of fasting—reduced systemic inflammation and cellular cleaning—begin much earlier than previously thought, making daily time-restricted eating a viable strategy for chronic disease prevention.32
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Renovating the Temple: The Onset of Autophagy</h3>
                    <p className="text-gray-700 mb-4">
                      The term "renovation" is perhaps most accurately applied to autophagy—the process by which cells degrade and recycle their own damaged components, such as misfolded proteins and dysfunctional mitochondria.21
                    </p>
                    
                    <h4 className="text-lg font-bold text-gray-700 mt-4 mb-2">Autophagy Timing in Humans</h4>
                    <p className="text-gray-700 mb-4">
                      While autophagy is a fundamental cellular process, its upregulation during fasting is time-dependent. In human studies, the data on the exact onset of autophagy varies depending on whether researchers are looking at gene expression or functional flux.
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700 mb-6">
                        <li><strong>Gene Expression:</strong> Significant upregulation of autophagy-related genes (e.g., <em>LC3B</em>, <em>ATG5</em>, <em>ATG7</em>, <em>p62</em>) has been observed in blood samples after 14 to 18 hours of daily fasting (e.g., during the Ramadan protocol).30</li>
                        <li><strong>Functional Flux:</strong> Direct measurements of "autophagic flux"—the actual rate of cellular recycling—suggest that more robust activation occurs after 18 to 24 hours of fasting.30</li>
                    </ul>
                    <p className="text-gray-700 mb-4">
                      However, even the 14-hour fast associated with eTRE provides a meaningful stimulatory effect. By consistently entering a state of nutrient deprivation each day, the body can clear out damaged proteins that are linked to neurodegenerative diseases.21 This daily "housekeeping" prevents the accumulation of cellular "junk" that would otherwise lead to cellular senescence and tissue aging.35
                    </p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The Battle of the Windows: eTRE vs. Late TRE Clinical Analysis</h2>
                    <p className="text-gray-700 mb-4">
                      One of the most pressing questions in chrononutrition is whether it matters which part of the day we choose for our fasting window. The two most common protocols are Early Time-Restricted Eating (eTRE), which typically involves skipping dinner, and Late Time-Restricted Eating (lTRE), which typically involves skipping breakfast.
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Is eTRE Superior for Metabolic Health?</h3>
                    <p className="text-gray-700 mb-4">
                      Clinical data increasingly suggests that eTRE provides superior benefits for insulin sensitivity and cardiovascular health. This is because eTRE aligns the eating window with the period of maximal insulin sensitivity and pancreatic responsiveness (the "Full Day Shift").29
                    </p>
                    <p className="text-gray-700 mb-4">
                      A landmark five-week crossover trial in men with prediabetes found that eTRE (6-hour window, with dinner before 3:00 PM) significantly improved insulin sensitivity, β-cell responsiveness, and blood pressure compared to a 12-hour control window.39 Crucially, these benefits were observed even without weight loss, suggesting that the timing itself, rather than caloric restriction, was the primary driver of health improvements.29
                    </p>
                    <p className="text-gray-700 mb-4">
                      Meta-analyses comparing eTRE and lTRE have found the following:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700 mb-6">
                        <li><strong>Insulin Resistance:</strong> eTRE is significantly more effective than lTRE in reducing HOMA-IR (a measure of insulin resistance).40</li>
                        <li><strong>Blood Pressure:</strong> eTRE has been shown to provide significant benefits in blood pressure (both systolic and diastolic) compared to non-TRE controls, a result that is often not achieved with lTRE in isocaloric settings.39</li>
                        <li><strong>Fat Mass and Fasting Glucose:</strong> In 3-month randomized trials, eTRE resulted in greater improvements in fat mass (-1.0 kg) and fasting glucose levels compared to lTRE and energy restriction alone.42</li>
                        <li><strong>Appetite Regulation:</strong> eTRE has been shown to decrease mean ghrelin levels and make hunger more "even-keeled" throughout the day, whereas skipping breakfast can sometimes lead to compensatory overeating later in the evening.29</li>
                    </ul>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The Circadian Penalty of Late TRE</h3>
                    <p className="text-gray-700 mb-4">
                      Late TRE, while still effective for weight loss if it leads to caloric restriction, essentially requires the body to process a large meal during the biological evening—a time when the SCN is signaling the body to transition to sleep and the liver and pancreas are already entering their "Skeleton Crew" phase.10 This mismatch can delay the internal circadian phase (e.g., delaying sleep midpoint and monocyte rhythms) and results in higher glucose spikes than if the same meal were eaten earlier.14
                    </p>

                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Outcome Measure</th>
                            <th className="px-4 py-2">Early TRE (e.g., 8am-2pm)</th>
                            <th className="px-4 py-2">Late TRE (e.g., 1pm-8pm)</th>
                            <th className="px-4 py-2">Key Research Finding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2">Insulin Sensitivity</td><td className="px-4 py-2 text-green-700">Strong Improvement</td><td className="px-4 py-2">Moderate Improvement</td><td className="px-4 py-2">eTRE is ~0.44 HOMA-IR points superior 40</td></tr>
                          <tr><td className="px-4 py-2">Blood Pressure</td><td className="px-4 py-2 text-green-700">Significant Reduction</td><td className="px-4 py-2">Inconsistent Results</td><td className="px-4 py-2">eTRE improves SBP/DBP without weight loss 39</td></tr>
                          <tr><td className="px-4 py-2">Weight/Fat Loss</td><td className="px-4 py-2">Moderate to Strong</td><td className="px-4 py-2">Moderate</td><td className="px-4 py-2">eTRE leads to greater fat mass reduction 42</td></tr>
                          <tr><td className="px-4 py-2">Circadian Alignment</td><td className="px-4 py-2 text-green-700">High (Synchronous)</td><td className="px-4 py-2 text-red-600">Low (Misaligned)</td><td className="px-4 py-2">lTRE delays sleep and clock phase 14</td></tr>
                          <tr><td className="px-4 py-2">Appetite Control</td><td className="px-4 py-2">Ghrelin Suppression</td><td className="px-4 py-2">Potential Evening Hunger</td><td className="px-4 py-2">eTRE makes hunger more "even-keeled" 29</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Synthesized Conclusions and Actionable Recommendations</h2>
                    <p className="text-gray-700 mb-4">
                      The integration of circadian biology and metabolic research reveals a clear, scientifically validated directive for optimal health: the body is not designed to be metabolically active 24 hours a day. The synchronization of our feeding patterns with our internal biological clocks is essential for maintaining metabolic flexibility and preventing chronic disease.
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Key Conclusions</h3>
                    <p className="text-gray-700 mb-4">
                      The metabolic impact of a meal is significantly influenced by the time of day, with the biological morning representing the peak of pancreatic efficiency and muscle sensitivity. Consuming the majority of calories during this "Full Day Shift" prevents the hyperglycemic excursions seen with evening eating. Eating late at night creates "Metabolic Jet Lag," a state of internal desynchrony between the SCN (light-driven) and the liver (food-driven), which is a primary driver of hepatosteatosis and systemic insulin resistance.
                    </p>
                    <p className="text-gray-700 mb-4">
                      The "Metabolic Switch" initiates across a range of 12–36 hours of fasting, depending on pre-fast meal composition, glycogen stores, and physical activity (Anton et al., 2018). As the body shifts from glucose utilization to fatty acids and ketones, it activates critical signaling pathways. β-hydroxybutyrate (BHB), produced in the early phases of this transition (often by 14 hours or later depending on the individual), acts as a potent messenger that upregulates BDNF for brain health and suppresses the NLRP3 inflammasome to reduce inflammation. This signifies that "regenerative" benefits are not limited to extended fasts but are achievable through daily time-restricted eating. Early Time-Restricted Eating (eTRE) is clinically superior to Late Time-Restricted Eating (lTRE) for managing insulin resistance and blood pressure, as it leverages the natural circadian peak of metabolic efficiency.
                    </p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Actionable Framework for Practitioners</h3>
                    <p className="text-gray-700 mb-4">
                      Based on this evidence, a "Chrononutrition Framework" can be proposed. Aim for an eating window of 6 to 10 hours, aligning with the "Full Day Shift" (e.g., 8:00 AM to 6:00 PM or 9:00 AM to 7:00 PM). This ensures the majority of nutrient processing occurs when insulin sensitivity is at its circadian peak. Maintain a consistent fasting window of at least 14 to 16 hours daily to initiate the transition toward the metabolic switch and the accompanying BHB-mediated benefits for the brain and immune system. Avoid caloric intake during the "Skeleton Crew" period (late evening and biological night) to prevent metabolic desynchrony and internal jet lag.
                    </p>
                    <p className="text-gray-700 mb-4">
                      By respecting the "Clock in Your Liver," individuals can transition from a state of metabolic dissonance to one of temporal harmony. The benefits—ranging from enhanced cognitive clarity and reduced inflammation to superior glycemic control—demonstrate that when we eat is just as fundamental to our health as what we eat.
                    </p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Works Cited</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
                        <li>Glucose & Insulin Dynamics: The Powerful Influence of Circadian Rhythms - NDNR</li>
                        <li>Peripheral clocks and systemic zeitgeber interactions - Frontiers</li>
                        <li>Clock genes, pancreatic function, and diabetes - PMC</li>
                        <li>Genetic synchronization of the brain and liver molecular clocks defend against chrono-metabolic disease - PMC</li>
                        <li>How Liver Disease Disrupts the Body's Internal Clock - EMJ</li>
                        <li>The Suprachiasmatic Nucleus, Circadian Clocks, and the Liver - PMC</li>
                        <li>Insulin Sensitivity Has a Bedtime - American Council on Science and Health</li>
                        <li>The liver-clock coordinates rhythmicity of peripheral tissues - PMC</li>
                        <li>Pancreatic β‐cell Function is Higher in Morning Versus Intermediate Chronotypes - PMC</li>
                        <li>Circadian Regulation of the Pancreatic Beta Cell - PMC</li>
                        <li>Syncing Exercise with Meals and Circadian Clocks - PMC</li>
                        <li>Differential effects of the circadian system and circadian misalignment on insulin sensitivity - PMC</li>
                        <li>Metabolic state switches between morning and evening - PMC</li>
                        <li>Endogenous circadian system and circadian misalignment impact glucose tolerance - PMC</li>
                        <li>The effect of meal timing on postprandial glucose metabolism - ResearchGate</li>
                        <li>Why does the same meal produce different glucose responses? - Levels Health</li>
                        <li>Pancreatic β‐cell Function is Higher in Morning Versus Intermediate Chronotypes - ResearchGate</li>
                        <li>Sleep Deprivation Can Lead to Impaired Insulin Response in Fat Cells - YouTube</li>
                        <li>Circadian Regulation of Glucose, Lipid, and Energy Metabolism - PMC</li>
                        <li>Flipping the Metabolic Switch: Understanding and Applying Health Benefits of Fasting - PMC</li>
                        <li>Unlocking the 3 Day Fast Benefits - Hirschfeld Oncology</li>
                        <li>Intermittent metabolic switching, neuroplasticity and brain health - PMC</li>
                        <li>Effects of Intermittent Fasting on Brain Metabolism - PMC</li>
                        <li>Physiology, Fasting - StatPearls</li>
                        <li>How long must a human fast to deplete liver glycogen? - ResearchGate</li>
                        <li>The Complete Guide to Fasting - Action Medicine</li>
                        <li>What Are the Different Stages of Intermittent Fasting? - Healthline</li>
                        <li>β-Hydroxybutyrate: A Signaling Metabolite - PMC</li>
                        <li>Early Time-Restricted Feeding Reduces Appetite and Increases Fat Oxidation - PMC</li>
                        <li>Autophagy Onset During Fasting - Consensus</li>
                        <li>Beta-Hydroxybutyrate Enhances BDNF Expression - Frontiers</li>
                        <li>The ketone metabolite β-hydroxybutyrate blocks NLRP3 inflammasome - Experts@Minnesota</li>
                        <li>Beta-hydroxybutyrate ... dampens inflammation via blocking of the NLRP3 inflammasome - FoundMyFitness</li>
                        <li>Ketone body β-hydroxybutyrate blocks the NLRP3 inflammasome - PMC</li>
                        <li>Study Details | Time Course for Fasting-induced Autophagy in Humans - ClinicalTrials.gov</li>
                        <li>Short-term fasting induces profound neuronal autophagy - PMC</li>
                        <li>6 Signs And Symptoms of Autophagy - Healthline</li>
                        <li>The Beneficial and Adverse Effects of Autophagic Response - PMC</li>
                        <li>Early Time-Restricted Feeding Improves Insulin Sensitivity, Blood Pressure... - PMC</li>
                        <li>Effect of Early Time-Restricted Eating vs Later Time-Restricted Eating - JCEM</li>
                        <li>The Effect of Early Time-Restricted Eating vs Later Time-Restricted - PubMed</li>
                        <li>Early time-restricted eating with energy restriction has a better effect - PubMed</li>
                        <li>Effects of time-restricted eating without caloric restriction - PMC</li>
                        <li>Early time-restricted eating with energy restriction has a better effect... - ResearchGate</li>
                        <li>Effects of Isocaloric Early vs. Late Time-Restricted Eating - medRxiv</li>
                    </ol>
                  </div>
                   <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                      <button onClick={() => setIsArticleOpen(false)} className="text-sm font-bold text-gray-500 hover:text-sync-blue px-4 py-2">Close</button>
                      <button onClick={() => window.print()} className="ml-4 bg-sync-blue text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-sync-dark">Print Report</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Chrononutrition;