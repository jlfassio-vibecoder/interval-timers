import React, { useState } from 'react';
import { BASE } from '../constants';

const PillarsIndex: React.FC = () => {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5>(1);

  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      
      {/* Header */}
      <header className="mb-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors mb-4">
             ← Back to Home
        </a>
        <h1 className="text-3xl md:text-5xl font-display font-bold text-sync-blue mb-2">
          The 5 Pillars of Sync
        </h1>
        <p className="text-gray-600">The operational protocols for biological alignment.</p>
      </header>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
            {[1, 2, 3, 4, 5].map((num) => (
            <button
                key={num}
                onClick={() => setActiveTab(num as 1 | 2 | 3 | 4 | 5)}
                className={`px-6 py-3 text-sm font-bold transition-all border-b-4 ${
                activeTab === num
                    ? 'border-sync-orange text-sync-orange'
                    : 'border-transparent text-gray-400 hover:text-sync-blue'
                }`}
            >
                Pillar {num}
            </button>
            ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
        
        {activeTab === 1 && (
          <article className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <h1 className="text-3xl font-display font-bold text-sync-blue mb-2">Pillar 1: The 90/90/1 Protocol: A Biopsychological Manual for Circadian Alignment and High-Performance Neurobiology</h1>
            <p>The human biological system operates through a complex hierarchy of oscillators, governed by the master pacemaker in the suprachiasmatic nucleus (SCN) of the hypothalamus. This central clock synchronizes peripheral oscillators in every organ and tissue, ensuring that metabolic, endocrine, and cognitive processes occur in a precise temporal sequence. The 90/90/1 Protocol, derived from the Bio-Sync60 framework, constitutes a systematic biological investment designed to optimize the "boot-up sequence" of the human brain and body during the first 90 minutes of the waking day.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-8 mb-4">Pillar 1: The 90/90/1 Protocol – The Biological Investment</h2>
            <p>The first 90 minutes of wakefulness are disproportionately influential on the subsequent sixteen hours of cognitive performance. This period represents a "critical window" for neuroendocrine signaling, where the brain transitions from the high-adenosine, melatonin-dominant state of sleep to the high-cortisol, catecholamine-active state of peak alertness.</p>
            
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">The Science of the Sunrise Reset: The Cortisol Awakening Response (CAR)</h3>
            <p>The Cortisol Awakening Response is a distinct physiological phenomenon characterized by a rapid increase in systemic cortisol levels, typically reaching a peak 30 to 45 minutes after the moment of awakening. This surge serves as the brain’s internal "boot-up sequence," facilitating glucose mobilization and activating prospective memory.</p>
            
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Melatonin Suppression and SCN Activation</h3>
            <p>Parallel to the rise of cortisol, the SCN must signal the cessation of melatonin production. The suppression of melatonin is mediated by ipRGCs in the retina, which are maximally sensitive to short-wavelength "blueish-greenish" light. Activating these cells via sunlight halts melatonin synthesis and signals the start of the biological day.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Actionable Protocol</h2>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>Light (0-30m):</strong> 10-30 minutes of outdoor light exposure to trigger CAR and suppress melatonin.</li>
                <li><strong>Cold (30-60m):</strong> Facial cold immersion to trigger the Vagal Brake and improve autonomic tone.</li>
                <li><strong>Movement (60-90m):</strong> Low-intensity movement to clear adenosine and sync peripheral clocks.</li>
            </ul>
          </article>
        )}

        {activeTab === 2 && (
          <article className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <h1 className="text-3xl font-display font-bold text-sync-blue mb-2">Pillar 2: The 30g Protein Anchor – The Anabolic Switch</h1>
            <p>Metabolic health is governed by the specific biochemical signaling initiated during the first feeding opportunity. The 30g Protein Anchor transitions the body from catabolism to anabolism via the leucine-triggered activation of mTORC1 and the secretion of satiety peptides.</p>

            <h2 className="text-2xl font-bold text-sync-blue mt-8 mb-4">The Science of the Anabolic Switch: The Leucine Trigger</h2>
            <p>The "Leucine Threshold" hypothesis posits that a specific concentration of leucine (~2.5-3g) is required to initiate muscle protein synthesis. 30g of high-quality protein ensures this threshold is met, flipping the metabolic switch to "build and repair."</p>

            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Nature’s Ozempic: Satiety Hormones</h3>
            <p>Protein intake stimulates the release of PYY and GLP-1, hormones that signal fullness and reduce cravings. This "anchor" stabilizes appetite for the remainder of the day, preventing energy crashes and snacking.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Protocol Implementation</h2>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>Threshold:</strong> Minimum 30g protein within the first meal.</li>
                <li><strong>Sources:</strong> Eggs, Greek Yogurt, Whey Isolate, or Lean Meats.</li>
                <li><strong>Timing:</strong> Consumed after the 90/90/1 window to allow for hydration and movement first.</li>
            </ul>
          </article>
        )}

        {activeTab === 3 && (
          <article className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <h1 className="text-3xl font-display font-bold text-sync-blue mb-2">Pillar 3: The Conductive Medium – Hydration as Fuel</h1>
            <p>The human physiological architecture operates as a sophisticated electrochemical system. Pillar 3 validates the "1-Gallon" standard, viewing hydration as the conductive medium for the biological battery.</p>

            <h2 className="text-2xl font-bold text-sync-blue mt-8 mb-4">The Science of the Conductive Medium</h2>
            <p>Water and electrolytes facilitate the transmission of electrical signals (action potentials). A deficiency in this medium leads to "neural noise" and decreased signal fidelity. The "2% Threshold" indicates that a 2% loss in body fluid results in significant cognitive and physical decline.</p>

            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Mitochondrial Respiration</h3>
            <p>Dehydration leads to hypovolemia (reduced blood volume), increasing blood viscosity and reducing oxygen delivery. Since the mitochondrial electron transport chain (ETC) requires molecular oxygen (O2) as the final electron acceptor to produce ATP, maintaining hydration is critical for cellular energy production.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Protocol</h2>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>Morning Bolus:</strong> 24-32oz water + electrolytes immediately upon waking (after light/cold).</li>
                <li><strong>Daily Target:</strong> ~1 Gallon (adjusted for weight/activity) to maintain the conductive medium.</li>
                <li><strong>Electrolytes:</strong> Sodium and Potassium are essential for the "battery" voltage; water alone is insufficient.</li>
            </ul>
          </article>
        )}

        {activeTab === 4 && (
          <article className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <h1 className="text-3xl font-display font-bold text-sync-blue mb-2">Pillar 4: The Movement Anchor</h1>
            <p>The "Japanese Walk" (Interval Walking Training) serves as the daily movement anchor. It combines high-intensity intervals with mindful recovery to maximize VO2 peak and autonomic balance.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-8 mb-4">The Protocol</h2>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>Structure:</strong> 5 sets of [3 minutes Fast / 3 minutes Slow].</li>
                <li><strong>Intensity:</strong> Fast interval at {'>'}70% VO2 peak (somewhat hard). Slow interval at 40% (easy). Bio-Sync60 uses VT1 (or individualized calibration) rather than 220-age formulas.</li>
                <li><strong>Volume:</strong> 30 minutes total duration.</li>
                <li><strong>Mindfulness:</strong> Use the "Slow" interval for breath-work and grounding, not just rest.</li>
            </ul>
            
            <p className="mt-6 italic text-gray-500">For the full interactive guide and simulator, please visit the "Mindful Walking" section.</p>
          </article>
        )}

        {activeTab === 5 && (
          <article className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
            <h1 className="text-3xl font-display font-bold text-sync-blue mb-2">Pillar 5: The Digital Sunset</h1>
            <p>Sleep is a biological cleaning process driven by the glymphatic system. The Digital Sunset protects the onset of melatonin and allows the brain to enter the deep sleep stages required for waste clearance.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-8 mb-4">The Mechanism</h2>
            <p>Blue light (460-480nm) suppresses melatonin and keeps the SCN in "day mode." The Digital Sunset removes this stimulus 60-90 minutes before bed to allow natural hormonal transitions.</p>
            
            <h2 className="text-2xl font-bold text-sync-blue mt-10 mb-4">Protocol</h2>
            <ul className="list-disc pl-5 space-y-2">
                <li><strong>Timing:</strong> 1 hour before sleep.</li>
                <li><strong>Action:</strong> No screens (phone, TV, computer). Phone in another room or Airplane Mode.</li>
                <li><strong>Environment:</strong> Dim overhead lights; use warm/red lighting.</li>
            </ul>
            
            <p className="mt-6 italic text-gray-500">For the full interactive guide and light spectrum analysis, please visit the "Digital Sunset" section.</p>
          </article>
        )}

        </div>
      </div>
    </div>
  );
};

export default PillarsIndex;