import React, { useState } from 'react';
import { BASE } from '../constants';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const NeuroReset: React.FC = () => {
  const [isArticleOpen, setIsArticleOpen] = useState(false);

  // --- SECTION 1: ALLOSTATIC LOAD LOGIC ---
  const [stressLoad, setStressLoad] = useState(50);

  const getLoadStatus = (load: number) => {
    if (load > 90) return { text: "⚠️ CRITICAL: BURNOUT IMMINENT", color: "text-sync-orange", bg: "bg-sync-orange" };
    if (load > 70) return { text: "System Strained - Recovery Required", color: "text-yellow-600", bg: "bg-yellow-500" };
    return { text: "System Stable - Ready for Output", color: "text-sync-blue", bg: "bg-sync-blue" };
  };

  const status = getLoadStatus(stressLoad);

  // --- SECTION 2: PATHWAY LOGIC ---
  const [activeNode, setActiveNode] = useState<1 | 2 | 3 | 4 | null>(null);
  
  const nodeData = {
    1: { title: "Stimulus", text: "Cold (50-59°F) contacts V1 (Ophthalmic) & V2 (Maxillary) zones. Triggers thermoreceptors." },
    2: { title: "Brainstem Relay", text: "Afferent signals bypass the conscious brain, routing directly to the Spinal Trigeminal Nucleus." },
    3: { title: "Modulation", text: "Signal integrated and routed to the Nucleus Ambiguus (cardiac vagal efferent)." },
    4: { title: "The Brake", text: "Vagal nerve fires at the SA node. Acetylcholine released. Heart rate drops instantly." }
  };

  // --- SECTION 3: CHARTS DATA ---
  const dopamineData = [
    { time: '0m', cold: 100, caff: 100 },
    { time: '30m', cold: 250, caff: 180 },
    { time: '60m', cold: 240, caff: 120 },
    { time: '90m', cold: 220, caff: 80 },
    { time: '120m', cold: 200, caff: 90 },
    { time: '180m', cold: 180, caff: 95 },
  ];

  const comparisonData = [
    { name: 'Cortisol', face: 10, body: 85 },
    { name: 'HRV Spike', face: 95, body: 60 },
    { name: 'Dopamine', face: 20, body: 100 },
  ];

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Sync-60 <span className="text-gray-400 font-normal">| The Neuro-Reset</span></span>
           </div>
           <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Home
           </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-16 pb-16 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-display font-bold text-sync-blue mb-4">
           The Trigeminal-Vagal Axis
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
           Most fitness programs fail due to <strong>biological bankruptcy</strong>. 
           We use the Mammalian Diving Reflex to reverse "retention failure" via autonomic regulation.
        </p>
      </header>

      {/* SECTION 1: ALLOSTATIC LOAD */}
      <section className="max-w-6xl mx-auto px-4 mb-20">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 grid md:grid-cols-2 gap-12 items-center">
          
          <div>
            <div className="inline-block px-3 py-1 bg-sync-orange/10 text-sync-orange rounded-full text-xs font-bold uppercase mb-4">Concept 1</div>
            <h2 className="text-3xl font-display font-bold text-sync-blue mb-4">Allostatic Load & Burnout</h2>
            <p className="text-gray-600 mb-6">
              Imagine your nervous system capacity as a cup. Work, sleep deprivation, and diet fill the cup. Adding a HIIT workout to a full cup doesn't build fitness; it causes an overflow (burnout).
            </p>
            <div className="bg-sync-base p-4 rounded-xl border-l-4 border-sync-blue mb-8">
              <p className="text-sm italic text-gray-700">"The Neuro-Reset empties the cup <em>before</em> you add the stressor of exercise."</p>
            </div>

            {/* Controls */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
               <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                  <span>Current Life Stress</span>
                  <span>{Math.min(stressLoad, 100)}%</span>
               </label>
               <input 
                 type="range" 
                 min="0" max="100" 
                 value={Math.min(stressLoad, 100)} 
                 onChange={(e) => setStressLoad(parseInt(e.target.value))}
                 className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-6 accent-sync-blue"
               />
               <div className="flex gap-3">
                 <button 
                   onClick={() => setStressLoad(prev => Math.min(prev + 30, 110))}
                   className="flex-1 py-3 px-4 bg-sync-dark text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                 >
                   + Add HIIT
                 </button>
                 <button 
                   onClick={() => setStressLoad(prev => Math.max(prev - 40, 10))}
                   className="flex-1 py-3 px-4 bg-sync-blue text-white rounded-xl font-bold text-sm hover:bg-sync-blue/90 transition-colors shadow-md"
                 >
                   Apply Reset
                 </button>
               </div>
               <div className={`mt-4 text-center text-xs font-bold py-2 rounded ${status.color}`}>
                 {status.text}
               </div>
            </div>
          </div>

          {/* Visual Cup */}
          <div className="flex justify-center py-8 bg-gray-50 rounded-3xl border border-gray-100">
             <div className="relative w-32 h-64 border-4 border-gray-300 border-t-0 rounded-b-3xl bg-white overflow-hidden shadow-inner">
               <div 
                 className={`absolute bottom-0 left-0 w-full transition-all duration-500 ease-out ${status.bg}`}
                 style={{ height: `${Math.min(stressLoad, 100)}%` }}
               ></div>
               {/* Overflow Line */}
               <div className="absolute top-0 w-full border-b-2 border-dashed border-sync-orange/50"></div>
               <div className="absolute top-2 w-full text-center text-[10px] text-sync-orange font-bold uppercase tracking-widest">Capacity Limit</div>
             </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: PATHWAY */}
      <section className="bg-sync-dark text-white py-20 px-4 mb-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
             <span className="px-3 py-1 bg-sync-blue text-white rounded-full text-xs font-bold uppercase">Mechanism</span>
             <h2 className="text-3xl font-display font-bold">The Vagal Brake: Anatomical Pathway</h2>
          </div>
          <p className="text-gray-400 max-w-2xl mb-12">
            The Mammalian Diving Reflex is not triggered by general cold, but specifically by cold receptors in the face (V1/V2). This acts as a hard-wired "Emergency Stop" for sympathetic arousal.
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((step) => (
              <div 
                key={step}
                onClick={() => setActiveNode(step as 1|2|3|4)}
                className={`cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 relative group
                  ${activeNode === step ? 'bg-white border-sync-blue' : 'bg-white/5 border-white/10 hover:border-sync-blue/50'}
                `}
              >
                <div className="text-3xl mb-4">{step === 1 ? '❄️' : step === 2 ? '🧠' : step === 3 ? '⚡' : '❤️'}</div>
                <h3 className={`font-bold text-lg mb-2 ${activeNode === step ? 'text-sync-blue' : 'text-gray-200'}`}>
                  {nodeData[step as 1|2|3|4].title}
                </h3>
                {step !== 4 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-gray-600 z-10">→</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 bg-white/10 rounded-xl p-8 text-center border border-white/5 min-h-[100px] flex items-center justify-center">
             {activeNode ? (
               <p className="text-lg text-white animate-in fade-in slide-in-from-bottom-2">
                 {nodeData[activeNode].text}
               </p>
             ) : (
               <p className="text-gray-500 text-sm uppercase tracking-widest">Select a stage above to trace the signal</p>
             )}
          </div>
        </div>
      </section>

      {/* SECTION 3: CHARTS */}
      <section className="max-w-6xl mx-auto px-4 mb-20 grid md:grid-cols-2 gap-8">
        
        {/* Chart 1 */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
           <h3 className="text-xl font-bold text-sync-blue mb-2">Neurochemical Cascade</h3>
           <p className="text-sm text-gray-500 mb-6">Dopamine Concentration (% Baseline)</p>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={dopamineData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                 <XAxis dataKey="time" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                 <YAxis axisLine={false} tickLine={false} domain={[0, 300]} />
                 <Tooltip />
                 <Line type="monotone" dataKey="cold" name="Systemic Cold (14°C)" stroke="#2B4C59" strokeWidth={3} dot={{r:4}} />
                 <Line type="monotone" dataKey="caff" name="Caffeine/Sugar" stroke="#E06C3E" strokeWidth={3} strokeDasharray="5 5" dot={{r:4}} />
               </LineChart>
             </ResponsiveContainer>
           </div>
           <div className="mt-4 bg-sync-base p-4 rounded-xl text-xs text-gray-600">
             <strong>Note:</strong> Prolonged full-body cold exposure (Tier 3) provides a sustained dopamine release (up to 250%) without the crash. Facial immersion (Tier 1) relies on Acetylcholine for calm.
           </div>
        </div>

        {/* Chart 2 */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
           <h3 className="text-xl font-bold text-sync-blue mb-2">Face vs. Body</h3>
           <p className="text-sm text-gray-500 mb-6">Autonomic Response Profile</p>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={comparisonData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                 <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                 <YAxis hide />
                 <Tooltip cursor={{fill: 'transparent'}} />
                 <Bar dataKey="face" name="Facial Immersion (Tier 1)" fill="#2B4C59" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="body" name="Full Ice Bath (Tier 3)" fill="#A6B08F" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
           <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
             <div className="bg-sync-blue/10 p-2 rounded text-sync-blue">
               <strong>Facial Immersion:</strong> High Vagal Tone (HRV), Low Cortisol. Pure calm.
             </div>
             <div className="bg-sync-accent/20 p-2 rounded text-gray-700">
               <strong>Full Ice Bath:</strong> High Metabolic Shock (Dopamine). Higher initial stress.
             </div>
           </div>
        </div>

      </section>

      {/* SECTION 4: SUMMARY */}
      <section className="max-w-4xl mx-auto px-4 mb-20">
        <div className="bg-gradient-to-br from-sync-blue to-sync-dark rounded-3xl p-8 md:p-12 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="md:w-2/3">
             <h2 className="text-3xl font-display font-bold mb-4">Engineering Willpower</h2>
             <p className="text-gray-300 mb-6 leading-relaxed">
               Sync-60 biochemically engineers the "drive" required for adherence. By placing the reset within the first window of the day, we leverage biology over psychology.
             </p>
             <ul className="space-y-3 text-sm">
               <li className="flex items-center gap-2">
                 <span className="text-sync-orange">✓</span> 90/90/1 Protocol: First 90 mins, 90s Vagal Reset.
               </li>
               <li className="flex items-center gap-2">
                 <span className="text-sync-orange">✓</span> Surplus vs Deficit: Start with high neuro-focus.
               </li>
             </ul>
           </div>
           <div className="md:w-1/3 flex justify-center">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl text-center">
                 <div className="text-4xl font-bold mb-1">2.5x</div>
                 <div className="text-xs uppercase tracking-widest text-gray-400 mb-4">Focus Duration</div>
                 <div className="text-4xl font-bold mb-1 text-sync-orange">⬇ HR</div>
                 <div className="text-xs uppercase tracking-widest text-gray-400">Instant Calm</div>
              </div>
           </div>
        </div>
      </section>

      {/* READ FULL REPORT BUTTON */}
      <section className="max-w-4xl mx-auto px-4 mt-8 text-center pb-10">
         <div className="bg-sync-blue/5 rounded-3xl p-12 border border-sync-blue/10">
             <h3 className="text-2xl font-display font-bold text-sync-blue mb-4">Read the Full Clinical Report</h3>
             <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                 Explore the neurobiological foundations of the Mammalian Diving Reflex, anatomical mapping, and allostatic load research.
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
                      <h3 className="text-xl font-display font-bold text-sync-blue">The Trigeminal-Vagal Axis</h3>
                      <button onClick={() => setIsArticleOpen(false)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors text-gray-600 font-bold">&times;</button>
                  </div>
                  <div className="overflow-y-auto p-8 md:p-12 prose prose-slate max-w-none">
                    
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-sync-blue mb-6">The Trigeminal-Vagal Axis: Neurobiological Foundations of the Mammalian Diving Reflex</h1>
                    
                    <p className="text-lg text-gray-700 leading-relaxed mb-6">
                        The mammalian diving reflex (MDR) is widely recognized as one of the most powerful and evolutionarily conserved autonomic responses in the vertebrate kingdom, often described as the "Master Switch of Life" for its capacity to override basic homeostatic reflexes during physiological crises. In humans, this reflex provides a specialized neural portal through the trigeminal-vagal axis, allowing for the mechanical and biochemical modulation of the autonomic nervous system (ANS).
                    </p>

                    <div className="bg-blue-50 p-6 rounded-xl border-l-4 border-sync-blue my-8 not-prose">
                        <h4 className="text-sync-blue font-bold uppercase tracking-widest text-xs mb-3">Executive Summary</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            This report serves to validate and nuance the neurobiological claims regarding the anatomical pathways, neurochemical cascades, and systemic impacts of cold-induced trigeminal stimulation, particularly in the context of allostatic load and human performance.
                        </p>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The Neuroanatomical Architecture: Decoding the Trigeminal-Vagal Arc</h2>
                    <p className="text-gray-700 mb-4">The initiation of the MDR is contingent upon the activation of sensory receptors located on the face, which are uniquely sensitive to thermal and mechanical changes. These receptors are primarily innervated by the trigeminal nerve (Cranial Nerve V), the largest cranial nerve, which serves as the primary conduit for facial sensation.</p>
                    
                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Primary Afferent Input: The Role of V1 and V2 Divisions</h3>
                    <p className="text-gray-700 mb-4">The trigeminal nerve is organized into three major divisions: the ophthalmic (V1), the maxillary (V2), and the mandibular (V3). While all three subserve facial sensation, the MDR is specifically triggered by the stimulation of cold-sensitive thermoreceptors in the areas supplied by the V1 and V2 branches, notably the forehead, orbits, and paranasal regions.</p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Central Integration and the Refinement of the Vagal Pathway</h3>
                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Neural Structure</th>
                            <th className="px-4 py-2">Functional Role</th>
                            <th className="px-4 py-2">Specific Findings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Spinal Trigeminal Nucleus</td><td className="px-4 py-2">Initial Brainstem Integration</td><td className="px-4 py-2">Medullary Dorsal Horn (MDH) acts as primary relay.</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Nucleus Ambiguus (NA)</td><td className="px-4 py-2 text-sync-blue font-bold">Primary Cardiac Vagal Efferent</td><td className="px-4 py-2 text-sync-blue font-bold">Dominant source of cardiovagal neurons for bradycardia.</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Nucleus Tractus Solitarius (NTS)</td><td className="px-4 py-2">Secondary / Modulatory Center</td><td className="px-4 py-2">Involved in baroreflex pathways.</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Dorsal Motor Nucleus (DMNV)</td><td className="px-4 py-2">Visceral / Metabolic Efferent</td><td className="px-4 py-2">Secondary role in the rapid "vagal brake".</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Physiological Manifestations: The Vagal Brake</h2>
                    <p className="text-gray-700 mb-4">The activation of the trigeminal-vagal axis precipitates a coordinated autonomic shift that prioritizes central perfusion. The most recognizable component is "diving bradycardia," a rapid, vagally-mediated reduction in heart rate. This response is temperature-dependent, with colder water eliciting a stronger vagal surge.</p>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Face vs. Body: The Efficiency of Isolated Trigeminal Stimulation</h2>
                    <p className="text-gray-700 mb-4">A common misconception in cold exposure therapy is that "more is always better." However, neurobiological research highlights a distinct difference between full-body cold immersion and isolated facial immersion. Isolated facial immersion specifically targets the trigeminal nerve endings in the face, triggering the diving reflex with minimal cold shock.</p>
                    
                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Condition</th>
                            <th className="px-4 py-2">Primary Pathway</th>
                            <th className="px-4 py-2">Neurochemical Profile</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2">Tier 1: Face Dip</td><td className="px-4 py-2">Trigeminal-Vagal (Parasympathetic)</td><td className="px-4 py-2">Acetylcholine, Norepinephrine</td></tr>
                          <tr><td className="px-4 py-2">Tier 3: Full Plunge</td><td className="px-4 py-2">SAM Axis (Sympathetic)</td><td className="px-4 py-2">Dopamine, Noradrenaline</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">The Neurochemical Cascade</h2>
                    <p className="text-gray-700 mb-4">Facial immersion initiates a highly valuable neurochemical profile. The primary neurotransmitter involved in the vagal portion is Acetylcholine, responsible for the "vagal brake". Simultaneously, the cold stimulus triggers a transient release of Norepinephrine, creating a state of "Sustained Alertness".</p>
                    <p className="text-gray-700 mb-4">
                      <strong>Correction on Dopamine:</strong> Full cold water immersion (7–10°C) activates the sympathetic-adrenal-medullary axis, which—based on research by Šrámek et al. (2000)—can elevate plasma dopamine by up to 250% and noradrenaline by 530%. This effect is specific to systemic cold stress and is distinct from the primarily parasympathetic response of facial immersion.
                    </p>

                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Neurochemical</th>
                            <th className="px-4 py-2">Primary Source</th>
                            <th className="px-4 py-2">Effect in the Neuro-Reset</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Acetylcholine</td><td className="px-4 py-2">Vagus Nerve</td><td className="px-4 py-2">Slows heart rate, enhances "calm focus".</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Norepinephrine</td><td className="px-4 py-2">Sympathetic</td><td className="px-4 py-2">Increases alertness without panic.</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Dopamine</td><td className="px-4 py-2">Systemic / SAM Axis</td><td className="px-4 py-2">Long-term motivation (requires systemic cold).</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Section 5: The Neuro-Reset – Engineering Willpower</h2>
                    <p className="text-gray-700 mb-4">To understand why a morning reset is necessary, we must look at the concept of Allostatic Load. Adding a high-intensity workout to a high-stress baseline is like pouring more water into an overflowing cup. The Neuro-Reset is designed to "empty the cup" first.</p>

                    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Synthesis of Evolutionary and Modern Autonomic Control</h3>
                    <div className="overflow-x-auto my-6 border rounded-lg border-gray-200">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                          <tr>
                            <th className="px-4 py-2">Feature</th>
                            <th className="px-4 py-2">Systemic Cold Plunge</th>
                            <th className="px-4 py-2">Facial Neuro-Reset</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="px-4 py-2 font-bold">Autonomic Strategy</td><td className="px-4 py-2 text-orange-600">Hormetic Stress (SAM-Axis)</td><td className="px-4 py-2 text-sync-blue">Vagal Reset (Diving Reflex)</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Key Metric</td><td className="px-4 py-2">Metabolic Rate, Mood</td><td className="px-4 py-2">HRV (RMSSD), Heart Rate</td></tr>
                          <tr><td className="px-4 py-2 font-bold">Allostatic Impact</td><td className="px-4 py-2">High stress / High reward</td><td className="px-4 py-2">Low stress / High recovery</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Works Cited</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
                        <li>Physiology, Diving Reflex - StatPearls</li>
                        <li>The Mammalian Diving Response: An Enigmatic Reflex to Preserve Life? - PMC</li>
                        <li>Cold Water, the Vagus Nerve, and the Autonomic Nervous System</li>
                        <li>The Trigeminal Nerve - Brigham and Women's Hospital</li>
                        <li>The Mammalian Diving Response: Inroads to Its Neural Control - Frontiers</li>
                        <li>Intranasal Trigeminal Perception | Ento Key</li>
                        <li>Autonomic Effects of Facial Immersion... - European Journal of Cardiovascular Medicine</li>
                        <li>Molecular Disambiguation of Heart Rate Control by the Nucleus Ambiguus - PMC</li>
                        <li>Trigeminal Cardiac Reflex... - PMC</li>
                        <li>Molecularly defined circuits for cardiovascular... - PMC</li>
                        <li>The vagus nerve: a cornerstone for mental health... - Frontiers</li>
                        <li>'Autonomic conflict': a different way to die during cold water immersion? - PMC</li>
                        <li>Effect of facial cooling and cold air inhalation... - ResearchGate</li>
                        <li>Effects of Adding Facial Immersion to Chest-Level Water Immersion - MDPI</li>
                        <li>Vagus activation by Cold Face Test reduces acute psychosocial stress responses - PMC</li>
                        <li>Human physiological responses to immersion... - PubMed</li>
                        <li>Health Benefits and Physiological Effects of Cold Water Immersion - UMK</li>
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

export default NeuroReset;