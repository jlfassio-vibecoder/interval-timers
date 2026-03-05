import React, { useState, useEffect } from 'react';
import { BASE } from '../constants';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

const BiologyPrecision: React.FC = () => {
  const [isArticleOpen, setIsArticleOpen] = useState(false);

  // --- SECTION 1: MATH PROBLEM LOGIC ---
  const [age, setAge] = useState(40);
  const [mathData, setMathData] = useState<any[]>([]);

  useEffect(() => {
    const data = [20, 30, 40, 50, 60, 70, 80].map(a => {
      const standard = 220 - a;
      return {
        age: a,
        standard: standard,
        upper: Math.round(standard * 1.29),
        lower: Math.round(standard * 0.71),
        userPoint: a === age ? standard : null 
      };
    });
    setMathData(data);
  }, [age]);

  const calculateUserValues = () => {
    const standard = 220 - age;
    const lower = Math.round(standard * 0.71);
    const upper = Math.round(standard * 1.29);
    return { standard, lower, upper };
  };
  const userVals = calculateUserValues();

  // --- SECTION 2: GREY ZONE LOGIC ---
  const [activeZone, setActiveZone] = useState<'zone2' | 'zone3'>('zone2');
  const fuelData = [
    { name: 'Fat', value: activeZone === 'zone2' ? 85 : 30, fill: '#E06C3E' }, // Orange for Fat
    { name: 'Sugar', value: activeZone === 'zone2' ? 15 : 70, fill: '#2B4C59' }  // Blue for Sugar
  ];

  // --- SECTION 3: VT1 GAUGE LOGIC ---
  const [effort, setEffort] = useState(30);
  const gaugeData = [
    { name: 'Zone 1', value: 25, fill: '#A6B08F' }, // Sage
    { name: 'Zone 2 (VT1)', value: 25, fill: '#2B4C59' }, // Blue (Target)
    { name: 'Grey Zone', value: 25, fill: '#FBBF24' }, // Yellow/Warning
    { name: 'Red Zone', value: 25, fill: '#E06C3E' } // Orange/Red
  ];

  const getGaugeFeedback = (val: number) => {
    if (val < 25) return { 
      title: "Recovery / Warm-up", 
      text: "\"I can sing a song while doing this.\" (Too easy for adaptations)",
      bg: "bg-sync-accent/20 border-sync-accent"
    };
    if (val <= 55) return { 
      title: "Zone 2: Bio-Sync60 (VT1)", 
      text: "\"I can speak in full sentences, but I can't sing.\" (PERFECT)",
      bg: "bg-sync-blue text-white border-sync-blue"
    };
    if (val <= 80) return { 
      title: "Zone 3: Grey Zone", 
      text: "\"I can only say a few words at a time.\" (Too hard!)",
      bg: "bg-yellow-100 text-yellow-800 border-yellow-300"
    };
    return { 
      title: "Zone 4/5: Red Zone", 
      text: "\"I cannot speak.\" (Anaerobic)",
      bg: "bg-sync-orange text-white border-sync-orange"
    };
  };
  const feedback = getGaugeFeedback(effort);

  // --- SECTION 4: ADAPTATION DATA ---
  const adaptationData = [
    { name: 'Mito Density', sync: 95, grey: 30 },
    { name: 'Fat Burn', sync: 90, grey: 25 },
    { name: 'Lactate Clear', sync: 85, grey: 40 },
  ];

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Bio-Sync60 <span className="text-gray-400 font-normal">| Biology of Precision</span></span>
           </div>
           <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Home
           </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-16 pb-20 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-display font-bold text-sync-blue mb-6 leading-tight">
           Why Your Heart Rate Monitor <br/> Might Be <span className="text-sync-orange">Lying to You</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
           Legacy fitness formulas are statistical abstractions that fail the individual. Discover the biology of <span className="font-bold text-sync-blue">VT1 Calibration</span> and why listening to your breath is more precise than a mathematical equation.
        </p>
      </header>

      {/* SECTION 1: THE MATH PROBLEM */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100">
           <div className="mb-10 max-w-2xl">
             <h2 className="text-3xl font-display font-bold text-sync-blue mb-4">1. The "220-Minus-Age" Fallacy</h2>
             <p className="text-gray-600">
               Current research demonstrates that the standard error of prediction for the 220-age formula is ±7–12 bpm, and the coefficient of variation for Zone 2 boundaries can reach up to 29%, rendering formula-based zone training unreliable.
             </p>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
             {/* Controls */}
             <div className="bg-sync-base rounded-2xl p-6 border border-sync-blue/10">
               <label className="block text-xs font-bold uppercase text-gray-500 mb-4">Enter Your Age</label>
               <input 
                 type="range" 
                 min="20" max="80" 
                 value={age} 
                 onChange={(e) => setAge(parseInt(e.target.value))}
                 className="w-full mb-6 accent-sync-orange"
               />
               <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
                 <span className="text-4xl font-display font-bold text-sync-blue">{age}</span>
                 <span className="text-sm text-gray-400">Years Old</span>
               </div>
               
               <div className="space-y-4 text-sm">
                 <div className="flex justify-between">
                   <span className="text-gray-500">Formula HRmax:</span>
                   <span className="font-mono font-bold">{userVals.standard} bpm</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-500">Real Bio Range:</span>
                   <span className="font-mono font-bold text-sync-orange">{userVals.lower} - {userVals.upper} bpm</span>
                 </div>
                 <p className="text-xs text-gray-400 mt-2 italic">*Based on 29% variance. You could be training in the wrong zone entirely.</p>
               </div>
             </div>

             {/* Chart */}
             <div className="lg:col-span-2 h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={mathData} margin={{top: 20, right: 30, left: 0, bottom: 0}}>
                   <XAxis dataKey="age" />
                   <YAxis domain={[100, 260]} />
                   <Tooltip />
                   <Line type="monotone" dataKey="upper" stroke="#CBD5E1" strokeDasharray="5 5" dot={false} strokeWidth={2} name="Upper Bound" />
                   <Line type="monotone" dataKey="standard" stroke="#2B4C59" strokeWidth={3} dot={false} name="Standard Formula" />
                   <Line type="monotone" dataKey="lower" stroke="#CBD5E1" strokeDasharray="5 5" dot={false} strokeWidth={2} name="Lower Bound" />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      </section>

      {/* SECTION 2: THE GREY ZONE */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
         <div className="mb-10 max-w-2xl">
             <h2 className="text-3xl font-display font-bold text-sync-blue mb-4">2. The Metabolic Cost</h2>
             <p className="text-gray-600 mb-6">
                When calculations fail, you enter <strong>"Zone 3"</strong>—metabolic limbo.
             </p>
             <div className="inline-flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
               <button 
                 onClick={() => setActiveZone('zone2')}
                 className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeZone === 'zone2' ? 'bg-sync-blue text-white shadow-md' : 'text-gray-500 hover:text-sync-blue'}`}
               >
                 Zone 2 (Sync)
               </button>
               <button 
                 onClick={() => setActiveZone('zone3')}
                 className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeZone === 'zone3' ? 'bg-sync-orange text-white shadow-md' : 'text-gray-500 hover:text-sync-orange'}`}
               >
                 Zone 3 (Grey)
               </button>
             </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Info Card */}
            <div className={`rounded-3xl p-8 border transition-colors duration-300 ${activeZone === 'zone2' ? 'bg-white border-sync-blue/10' : 'bg-orange-50 border-orange-100'}`}>
                <h3 className={`text-2xl font-bold mb-6 ${activeZone === 'zone2' ? 'text-sync-blue' : 'text-sync-orange'}`}>
                  {activeZone === 'zone2' ? 'Bio-Sync60 State' : 'The Grey Zone'}
                </h3>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="text-2xl">{activeZone === 'zone2' ? '🌿' : '⚡'}</div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">Nervous System</h4>
                      <p className="text-sm text-gray-600">{activeZone === 'zone2' ? 'Parasympathetic. Rest & Repair.' : 'Sympathetic Activation. Higher Cortisol Cost.'}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-2xl">{activeZone === 'zone2' ? '🔥' : '🍬'}</div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">Primary Fuel</h4>
                      <p className="text-sm text-gray-600">{activeZone === 'zone2' ? 'FatMax. Burning stored body fat.' : 'Glycolytic. Burning sugar/muscle glycogen.'}</p>
                    </div>
                  </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 flex flex-col items-center justify-center">
               <h4 className="text-xs font-bold uppercase text-gray-400 mb-6">Fuel Source Composition</h4>
               <div className="w-full h-[200px] max-w-xs">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fuelData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 12}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                        {fuelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               </div>
               <p className="text-center text-xs text-gray-500 mt-4">
                 {activeZone === 'zone2' ? 'Fat provides ~85% of energy needs.' : 'Body shifts to burning precious glycogen.'}
               </p>
            </div>
         </div>
      </section>

      {/* SECTION 3: VT1 SOLUTION */}
      <section className="bg-sync-dark text-white py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
           <div>
             <div className="inline-block bg-sync-blue text-white border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">The Bio-Sync60 Solution</div>
             <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Precision via VT1 & The "Talk Test"</h2>
             <p className="text-gray-400 leading-relaxed mb-8">
               Instead of generic formulas, Bio-Sync60 uses <strong>Ventilatory Threshold 1 (VT1)</strong>. This is the physiological tipping point where your breathing shifts. Subjectively, this correlates perfectly with the "Talk Test."
             </p>
             
             <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
               <label className="block text-sm font-bold text-sync-orange mb-4">Adjust Intensity Level:</label>
               <input 
                 type="range" 
                 min="0" max="100" 
                 value={effort} 
                 onChange={(e) => setEffort(parseInt(e.target.value))}
                 className="w-full mb-2 accent-sync-orange" 
               />
               <div className="flex justify-between text-xs text-gray-500 uppercase font-bold">
                 <span>Rest</span>
                 <span>Max Effort</span>
               </div>
             </div>
           </div>

           <div className="bg-white/5 rounded-3xl p-8 border border-white/10 text-center relative overflow-hidden">
              <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-8">Physiological Feedback Loop</h3>
              
              <div className="h-[200px] w-full flex justify-center relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={gaugeData}
                       cx="50%"
                       cy="100%"
                       startAngle={180}
                       endAngle={0}
                       innerRadius={60}
                       outerRadius={90}
                       paddingAngle={2}
                       dataKey="value"
                       stroke="none"
                     >
                       {gaugeData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.fill} />
                       ))}
                     </Pie>
                   </PieChart>
                 </ResponsiveContainer>
                 {/* Needle Simulation */}
                 <div 
                   className="absolute bottom-0 w-1 h-[90px] bg-white origin-bottom transition-transform duration-300 ease-out"
                   style={{ 
                     left: '50%', 
                     transform: `translateX(-50%) rotate(${(effort / 100) * 180 - 90}deg)` 
                   }}
                 ></div>
                 <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full"></div>
              </div>

              <div className={`mt-8 p-6 rounded-xl border transition-colors duration-300 ${feedback.bg}`}>
                <h4 className="text-xl font-bold mb-2">{feedback.title}</h4>
                <p className="text-sm opacity-90">{feedback.text}</p>
              </div>
           </div>
        </div>
      </section>

      {/* SECTION 4: CELLULAR MAGIC */}
      <section className="max-w-6xl mx-auto px-4 py-24">
         <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold text-sync-blue mb-4">4. The Cellular Magic: PGC-1α</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
               Why slow down? Because training immediately below VT1 provides a sustained, repeatable stimulus for <strong>Mitochondrial Biogenesis</strong>.
            </p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
               <div className="w-12 h-12 bg-sync-base rounded-xl flex items-center justify-center text-2xl mb-6">🧬</div>
               <h3 className="text-xl font-bold text-sync-blue mb-3">The "Master Switch"</h3>
               <p className="text-gray-600 text-sm leading-relaxed mb-4">
                 Both VT1 and HIIT activate PGC-1α via different dominant pathways. VT1 preferentially engages the calcium/CaMK cascade—sustained mitochondrial biogenesis with minimal recovery cost. HIIT preferentially engages AMPK-mediated signals—powerful but recovery-demanding.
               </p>
               <ul className="space-y-2 text-sm text-gray-600">
                 <li className="flex items-center"><span className="w-2 h-2 bg-sync-blue rounded-full mr-3"></span>Increases fat oxidation capacity</li>
                 <li className="flex items-center"><span className="w-2 h-2 bg-sync-blue rounded-full mr-3"></span>Improves metabolic flexibility</li>
               </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-sync-orange text-white text-xs font-bold px-3 py-1 rounded-bl-xl">Critical for GLP-1</div>
               <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl mb-6">⚖️</div>
               <h3 className="text-xl font-bold text-sync-blue mb-3">Sarcopenia Defense</h3>
               <p className="text-gray-600 text-sm leading-relaxed">
                 For GLP-1 users, "Grey Zone" training adds cortisol stress to a caloric deficit, accelerating muscle loss. Bio-Sync60 stimulates health without catabolism.
               </p>
            </div>
         </div>

         <div className="bg-white rounded-3xl p-8 border border-gray-100 h-[350px]">
            <h3 className="text-center font-bold text-sync-blue mb-8">Long-term Adaptations (12 Weeks)</h3>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={adaptationData}>
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sync" name="Sync60" fill="#2B4C59" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grey" name="Grey Zone" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
         </div>
      </section>

      {/* READ FULL REPORT BUTTON */}
      <section className="max-w-4xl mx-auto px-4 mt-8 text-center pb-10">
         <div className="bg-sync-blue/5 rounded-3xl p-12 border border-sync-blue/10">
             <h3 className="text-2xl font-display font-bold text-sync-blue mb-4">Read the Full Clinical Report</h3>
             <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                 Dive deeper into the physiological mechanisms, citation analysis, and the complete "Biology of Precision" white paper.
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
                      <h3 className="text-xl font-display font-bold text-sync-blue">The Biology of Precision</h3>
                      <button onClick={() => setIsArticleOpen(false)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors text-gray-600 font-bold">&times;</button>
                  </div>
                  <div className="overflow-y-auto p-8 md:p-12 prose prose-slate max-w-none">
                    
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-sync-blue mb-6">The Biology of Precision: Why Your Heart Rate Monitor Might Be Lying to You</h1>
                    
                    <p className="text-lg text-gray-700 leading-relaxed mb-6">
                        The modern fitness landscape is characterized by an over-reliance on digital abstractions, where sleek wearable devices often prioritize convenience over biological reality. For the majority of health-conscious individuals, the primary tool for navigating cardiovascular health is the heart rate monitor, a device that calculates intensity based on generic mathematical models. However, when these models are scrutinized through the lens of metabolic biology, a profound discrepancy emerges.
                    </p>

                    <div className="bg-blue-50 p-6 rounded-xl border-l-4 border-sync-blue my-8 not-prose">
                        <h4 className="text-sync-blue font-bold uppercase tracking-widest text-xs mb-3">Executive Summary</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            Standardized exercise protocols frequently rely on the "220-minus-age" formula to estimate maximum heart rate, yet contemporary research reveals this calculation is a statistical abstraction with a coefficient of variation (CV) reaching up to 29% when defining zone boundaries. Such a high margin of error often misleads individuals into the "Grey Zone"—a state of metabolic limbo where intensity is too high to maximize fat oxidation but too low to trigger high-intensity anaerobic adaptations. The Bio-Sync60 solution advocates for calibration based on Ventilatory Threshold 1 (VT1), identified via the "Talk Test," which serves as a reliable surrogate for the physiological inflection point where the body maximizes fat oxidation (FatMax) and mitochondrial renewal via the PGC-1α pathway.
                        </p>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Section 1: The Math Problem: The Fallacy of "220-Minus-Age"</h2>
                    <p className="text-gray-700 mb-4">The cornerstone of modern exercise prescription is the estimation of an individual's maximal heart rate. For decades, the primary tool for this estimation has been the "Fox and Haskell" formula, more commonly known as 220-age. Despite its ubiquitous presence in gym environments, medical textbooks, and wearable technology, the formula lacks a foundation in rigorous, peer-reviewed scientific research.</p>
                    
                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Equation Name</th>
                            <th className="px-4 py-2">Formula</th>
                            <th className="px-4 py-2">Standard Error (SEE)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2">Fox & Haskell</td><td className="px-4 py-2 font-mono">220-age</td><td className="px-4 py-2">7–12 bpm</td></tr>
                          <tr><td className="px-4 py-2">Tanaka</td><td className="px-4 py-2 font-mono">208 - (0.7 x age)</td><td className="px-4 py-2">~10 bpm</td></tr>
                          <tr><td className="px-4 py-2">Gulati</td><td className="px-4 py-2 font-mono">206 - (0.88 x age)</td><td className="px-4 py-2">14.77 bpm</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The "40-Year-Old" Error Case</h3>
                    <p className="text-gray-700">Using the Fox formula, a 40-year-old individual is assigned a predicted max heart rate of 180 bpm. Applying the reported 29% coefficient of variation for zone boundaries reveals a potential physiological reality where that individual's true training targets could be drastically misaligned. If this person attempts to train in "Zone 2" (65% of 180 = 117 bpm), they may inadvertently be performing a high-intensity threshold workout if their true max is 140 bpm, or they may be doing little more than a slow walk if their true max is 220 bpm.</p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Section 2: The "Grey Zone" Trap: Navigating Metabolic Limbo</h2>
                    <p className="text-gray-700 mb-4">When a participant inadvertently exceeds their true Zone 2 intensity due to mathematical errors, they enter what exercise physiologists call the "Grey Zone," often corresponding to Zone 3 in a five-zone model. This intensity is characterized as "comfortably hard"—you are working hard enough to feel a sense of accomplishment and "justified fatigue," but you are not pushing into the high-intensity anaerobic stimulus required for peak performance.</p>
                    
                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Metabolic State</th>
                            <th className="px-4 py-2">Zone 2 (Precision)</th>
                            <th className="px-4 py-2">Zone 3 (Grey Zone)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Primary Fuel</td><td className="px-4 py-2 text-sync-blue font-bold">Fatty Acids (Lipolysis)</td><td className="px-4 py-2 text-orange-600">Glucose (Glycolysis)</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Autonomic NS</td><td className="px-4 py-2 text-sync-blue">Parasympathetic</td><td className="px-4 py-2 text-orange-600">Sympathetic Activation</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Cellular Signal</td><td className="px-4 py-2 text-sync-blue">Mitochondrial Biogenesis</td><td className="px-4 py-2 text-orange-600">"Junk" Fatigue</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Autonomic Impact</h3>
                    <p className="text-gray-700">For the high-allostatic-load individual (chronic work stress, poor sleep, caloric restriction) who is <em>also</em> training predominantly in the Grey Zone, the cumulative autonomic cost accelerates the path toward sympathetic overdrive and hormonal dysregulation. This compounding effect is what makes Zone 3 particularly problematic for Bio-Sync60's target population — not because Zone 3 is <em>inherently dangerous</em>, but because it adds sympathetic load to a system already in deficit.</p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Section 3: The Power of VT1: The Bio-Sync60 Solution</h2>
                    <p className="text-gray-700 mb-4">To avoid the pitfalls of the Grey Zone, the Bio-Sync60 methodology mandates calibration based on Ventilatory Threshold 1 (VT1). Unlike a heart rate formula, VT1 is a "hard" physiological marker that reflects what is happening inside the lungs and cells in real-time.</p>
                    
                    <div className="bg-gray-50 p-6 rounded-lg my-6 border border-gray-200">
                        <h4 className="font-bold text-sync-blue mb-2">The "Talk Test": A Laboratory in Your Lungs</h4>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                            <li><strong>The Baseline:</strong> At rest, you can speak in long, fluid paragraphs.</li>
                            <li><strong>The Threshold (VT1):</strong> As you reach VT1, you can still maintain a conversation, but it requires a noticeable effort. You may feel the need to take a quick breath between shorter sentences.</li>
                            <li><strong>The Inflection (Beyond VT1):</strong> Once you cross into the Grey Zone, conversation becomes "choppy." You can only speak in short bursts of 3-4 words before needing to gasp for air.</li>
                        </ul>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Section 4: The Cellular Magic: Mitochondria and PGC-1α</h2>
                    <p className="text-gray-700 mb-4">The ultimate goal of Bio-Sync60 is "Mitochondrial Biogenesis"—the birth of new energy-producing organelles within the muscle cells.</p>
                    <p className="text-gray-700 mb-4">Both low- and high-intensity exercise activate PGC-1α through parallel signaling cascades including Ca²⁺/CaMKII, AMPK, and p38 MAPK, but through different dominant pathways. Low-intensity training at VT1 preferentially engages the calcium/CaMK signaling cascade, which promotes sustained mitochondrial biogenesis compatible with daily training. HIIT preferentially triggers PGC-1α through AMPK-mediated energy-depletion signals, producing powerful but recovery-demanding adaptations. Bio-Sync60 builds the mitochondrial "engine" primarily through sustainable volume below VT1.</p>
                    <p className="text-gray-700 mb-4">Training at VT1 intensity produces significantly less oxidative stress than high-intensity training. The lower electron transport chain flux rate at moderate intensity results in fewer reactive oxygen species (ROS) and less mitochondrial membrane damage. This is why VT1 sessions can be performed daily without accumulating the oxidative repair burden associated with HIIT.</p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Section 5: The GLP-1 Connection: Sarcopenia and Safety</h2>
                    <p className="text-gray-700 mb-4">The rise of GLP-1 receptor agonists (such as Semaglutide and Tirzepatide) has introduced a new urgency to the field of exercise precision. These medications are incredibly effective for weight loss, but they come with a significant biological cost: the potential for rapid and excessive loss of skeletal muscle mass.</p>
                    
                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Exercise Type</th>
                            <th className="px-4 py-2">Effect on GLP-1 User</th>
                            <th className="px-4 py-2">Recommendation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Grey Zone (Z3)</td><td className="px-4 py-2 text-orange-600">High cortisol cost; risks muscle catabolism</td><td className="px-4 py-2">Avoid during active weight loss</td></tr>
                          <tr><td className="px-4 py-2 font-bold">HIIT (Z5)</td><td className="px-4 py-2 text-orange-600">High metabolic stress; difficult to recover</td><td className="px-4 py-2">Use sparingly</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Sync60 (VT1)</td><td className="px-4 py-2 text-sync-blue font-bold">Low stress; preserves muscle; builds base</td><td className="px-4 py-2">150 min/week as foundation</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Conclusion: The New Paradigm of Movement</h2>
                    <p className="text-gray-700 mb-6">The validation of the Bio-Sync60 methodology against current literature confirms that the future of fitness lies not in generic math, but in physiological precision. The reliance on heart rate formulas is a legacy of an era before we could accurately measure the metabolic and ventilatory inflection points of the individual. By shifting our focus to the first ventilatory threshold (VT1) and the "Talk Test," we align our training with the cellular mechanisms that drive longevity and metabolic health.</p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Works Cited</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
                        <li>Accuracy of Commonly Used Age-Predicted Maximal Heart Rate Equations - PMC</li>
                        <li>What is Zone 2 training? - Dr.Oracle</li>
                        <li>How to make Zone Cardio work for you - Moms Into Fitness</li>
                        <li>Training in the Grey Zone Explained | ROUVY</li>
                        <li>ACE - Certified™: Research Special Issue 2018 - Validity of the Talk Test</li>
                        <li>A Critical Comparison of Individual Variability in ... - AIR Unimi</li>
                        <li>Zone 2: the “ideal” intensity? Myth or scientific reality - Sci-Sport</li>
                        <li>GLP-1 medications and muscle mass preservation - ukactive</li>
                        <li>How to Prevent Muscle Loss on Ozempic & GLP-1 Medications | Expert Tips - Self London</li>
                        <li>Preservation of lean soft tissue during weight loss induced by GLP-1...</li>
                        <li>The surprising history of the "HRmax=220-age" equation - ResearchGate</li>
                        <li>Measured Maximal Heart Rates Compared to Commonly Used Age-Based Prediction Equations - PMC</li>
                        <li>[Ultimate Guide] Zone 3 Training: Sweet Spot or Grey Zone? - INSCYD</li>
                        <li>Salivary cortisol response to post-exercise infrared sauna declines over time - PMC</li>
                        <li>The Female Athlete: Looking After Your Hormones While Training - TrainingPeaks</li>
                        <li>The Relationship Between Lactate and Ventilatory Thresholds in Runners - Frontiers</li>
                        <li>High intensity interval training alters gene expression linked to mitochondrial biogenesis - PMC</li>
                        <li>GLP-1 medications and protein: How to prevent muscle loss and stay strong - SimplyProtein</li>
                        <li>GLP-1 agonists and exercise: the future of lifestyle prioritization - PMC</li>
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

export default BiologyPrecision;