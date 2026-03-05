import React, { useState } from 'react';
import { PHASE_CONTENT } from '../constants';

const ProtocolSection: React.FC = () => {
  const [activePhase, setActivePhase] = useState<1 | 2 | 3>(1);
  const [animating, setAnimating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePhaseChange = (phase: 1 | 2 | 3) => {
    if (phase === activePhase) return;
    setAnimating(true);
    setTimeout(() => {
      setActivePhase(phase);
      setAnimating(false);
    }, 200);
  };

  const currentData = PHASE_CONTENT[activePhase];

  const renderModalContent = () => {
    if (activePhase === 1) {
      return (
        <>
          <p className="font-bold text-sync-orange uppercase tracking-wide text-xs mb-4">Focus: Autonomic Alignment (Days 1-20)</p>
          
          <h4 className="font-bold text-sync-blue text-lg mt-4">🌅 Morning Anchors (0-90 Mins)</h4>
          <ul className="list-disc pl-5 space-y-2">
              <li><strong>Face Immersion:</strong> Fill a basin with ice water. Hold breath and submerge face for 30–60 seconds. (Triggers Mammalian Diving Reflex).</li>
              <li><strong>Hydration:</strong> 1 Liter water + electrolytes immediately.</li>
              <li><strong>Protein Anchor:</strong> 30g protein within 30 mins of waking (e.g., 4 eggs or 150g chicken).</li>
              <li><strong>90/90/1 Rule:</strong> No phone and no caffeine for the first 90 minutes.</li>
          </ul>

          <h4 className="font-bold text-sync-blue text-lg mt-6">🚶 Mid-Day: The Japanese Walk</h4>
          <p className="mb-2">Target: 30 Minutes Total Zone 2.</p>
          <div className="bg-gray-100 p-3 rounded text-sm font-mono border border-gray-200">
              Cycle 5x:<br/>
              [3 Mins] Brisk Pace (Can talk, prefer not to)<br/>
              [3 Mins] Strolling Pace (Nasal breathing)
          </div>

          <h4 className="font-bold text-sync-blue text-lg mt-6">🌙 Evening Anchors</h4>
          <ul className="list-disc pl-5 space-y-2">
              <li><strong>Digital Sunset:</strong> Screens off 1 hour before bed.</li>
              <li><strong>Brain Dump:</strong> Write 3 tasks for tomorrow to offload working memory.</li>
          </ul>

          <h4 className="font-bold text-sync-blue text-lg mt-6">⚠️ Phase 1 "No-Go" List</h4>
          <ul className="list-disc pl-5 space-y-2 text-red-600">
              <li>NO HIIT / Crossfit (Keep HR &lt; Zone 3).</li>
              <li>NO Fasting &gt; 12 Hours (Need safety signals).</li>
              <li>NO Alcohol (Destroys HRV).</li>
          </ul>
        </>
      );
    } else if (activePhase === 2) {
      return (
        <>
          <p className="font-bold text-sync-orange uppercase tracking-wide text-xs mb-4">Focus: Metabolic Flexibility (Days 21-40)</p>
          <p className="text-sm text-gray-600 mb-4">This phase benefits from VT1-calibrated Zone 2 (or individualized zones) for true mitochondrial efficiency.</p>

          <h4 className="font-bold text-sync-blue text-lg mt-4">🌅 Morning Updates</h4>
          <ul className="list-disc pl-5 space-y-2">
              <li><strong>Protein Anchor:</strong> Continues (30g within 30 mins). This opens your feeding window.</li>
              <li><strong>Cold Shower Finisher:</strong> Turn handle to coldest setting for final 2 minutes. Force slow exhale.</li>
          </ul>

          <h4 className="font-bold text-sync-blue text-lg mt-6">🎒 Rucking (3-4x Week)</h4>
          <p className="mb-2">Load 15-20lbs. 30-45 mins. Posture upright. Nasal breathing.</p>

          <h4 className="font-bold text-sync-blue text-lg mt-6">🍽️ Nutrition: eTRE</h4>
          <ul className="list-disc pl-5 space-y-2">
              <li><strong>10-Hour Window:</strong> If breakfast is 8am, dinner ends by 6pm.</li>
              <li><strong>The Fast:</strong> Water/Black Coffee only outside window.</li>
          </ul>

          <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-red-800 text-xs font-bold mt-4">
              ⚠️ Do NOT run with the Ruck. No snacking between meals.
          </div>
        </>
      );
    } else if (activePhase === 3) {
      return (
        <>
          <p className="font-bold text-sync-orange uppercase tracking-wide text-xs mb-4">Focus: Peak Functional Force (Days 41-60)</p>

          <h4 className="font-bold text-sync-blue text-lg mt-4">🧊 Peak Recovery</h4>
          <ul className="list-disc pl-5 space-y-2">
              <li><strong>Full Cold Plunge:</strong> 3-5 minutes at 45-50°F. Full submersion to neck. (Tier 3 Vagal).</li>
              <li><strong>Heat Exposure:</strong> Sauna 20 mins (optional) post-workout.</li>
          </ul>

          <h4 className="font-bold text-sync-blue text-lg mt-6">🏋️ Functional Force</h4>
          <p className="mb-2">Target: 3x Week Heavy Lifting.</p>
          <ul className="list-disc pl-5 space-y-2">
              <li><strong>Compound Lifts:</strong> Deadlifts, Squats, Overhead Press.</li>
              <li><strong>Rep Range:</strong> 3-5 reps for strength, 8-12 for hypertrophy.</li>
          </ul>

          <h4 className="font-bold text-sync-blue text-lg mt-6">🏃 Zone 2 Endurance</h4>
          <p className="mb-2">1x Week Long Run or Heavy Ruck (45-60 mins). Keep HR strictly in Zone 2.</p>

          <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-red-800 text-xs font-bold mt-4">
              ⚠️ Prioritize sleep (8h) to support heavy neural load. No missing Protein Anchors.
          </div>
        </>
      );
    }
    return null;
  };

  const getResourceDescription = () => {
    switch(activePhase) {
      case 1: return 'Includes the Weekly Tracker and "No-Go" list.';
      case 2: return 'Includes Rucking Guide and eTRE schedule.';
      case 3: return 'Includes Hypertrophy Split and Plunge Safety Guide.';
      default: return '';
    }
  };

  return (
    <section id="protocol" className="scroll-mt-24 relative">
      <div className="border-l-4 border-sync-orange pl-6 mb-10">
        <h2 className="text-3xl font-display font-bold text-sync-blue">The 60-Day Roadmap</h2>
        <p className="text-gray-500 mt-2">A phased architecture to layer biological adaptations.</p>
      </div>

      {/* Timeline Visual */}
      <div className="relative mb-12 px-4">
        <div className="absolute top-[18px] left-0 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
        <div className="flex justify-between max-w-3xl mx-auto">
          {[1, 2, 3].map((phaseNum) => {
             const isActive = activePhase === phaseNum;
             return (
               <button
                 key={phaseNum}
                 type="button"
                 className="flex flex-col items-center cursor-pointer group border-0 bg-transparent p-0"
                 onClick={() => handlePhaseChange(phaseNum as 1 | 2 | 3)}
                 aria-pressed={isActive}
                 aria-label={`Phase ${phaseNum}, ${phaseNum === 1 ? 'Days 1-20' : phaseNum === 2 ? 'Days 21-40' : 'Days 41-60'}`}
               >
                 <div 
                   className={`w-9 h-9 rounded-full border-4 mb-2 transition-all duration-300 
                     ${isActive 
                       ? 'border-sync-orange bg-sync-orange scale-110' 
                       : 'border-gray-300 bg-white group-hover:border-sync-blue'}`}
                 />
                 <span className={`text-xs font-bold transition-colors ${isActive ? 'text-sync-blue' : 'text-gray-500 group-hover:text-sync-blue'}`}>
                   Phase {phaseNum}
                 </span>
                 <span className="text-[10px] text-gray-500">
                   {phaseNum === 1 ? 'Days 1-20' : phaseNum === 2 ? 'Days 21-40' : 'Days 41-60'}
                 </span>
               </button>
             )
          })}
        </div>
      </div>

      {/* Dynamic Dashboard */}
      <div 
        className={`bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 transition-opacity duration-200 ${animating ? 'opacity-50' : 'opacity-100'}`}
      >
        {/* Header */}
        <div className="bg-sync-blue p-6 md:p-8 text-white flex justify-between items-center">
          <div>
            <div className="inline-block px-2 py-1 bg-white/10 rounded text-[10px] uppercase tracking-wider mb-2">
              {currentData.badge}
            </div>
            <h3 className="text-2xl md:text-3xl font-display font-bold">
              {currentData.title}
            </h3>
            <p className="text-gray-300 mt-1">
              {currentData.subtitle}
            </p>
          </div>
          <div className="text-5xl opacity-20 hidden md:block">🏗️</div>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left: Daily Checklist */}
          <div className="md:col-span-5 space-y-6">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <span className="text-sync-orange font-bold text-lg">Daily Requirements</span>
            </div>
            <ul className="space-y-4">
              {currentData.checklist.map((item, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-sync-orange font-bold mr-2">✓</span>
                  <span className="text-gray-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
            
            {/* Phase Resources */}
            {(activePhase === 1 || activePhase === 2 || activePhase === 3) && (
              <div className="mt-8 p-4 bg-sync-base rounded-xl border border-sync-blue/10 animate-in fade-in slide-in-from-bottom-2">
                <h5 className="font-bold text-sync-blue text-sm mb-1">Resource Pack</h5>
                <p className="text-xs text-gray-500 mb-3">
                  {getResourceDescription()}
                </p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full bg-white border border-gray-200 text-sync-blue font-bold py-2 rounded-lg text-sm hover:bg-sync-blue hover:text-white transition-colors shadow-sm"
                >
                  View Phase Checklist
                </button>
              </div>
            )}
          </div>

          {/* Right: Focus Cards */}
          <div className="md:col-span-7 grid grid-cols-1 gap-4">
            
            {/* 90/90/1 Visual */}
            <div className="bg-sync-base rounded-xl p-4 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sync-blue text-sm">Rule 90/90/1</h4>
                <p className="text-xs text-gray-500">Morning Anchor</p>
              </div>
              <div className="flex space-x-3 text-center">
                <div className="bg-white px-2 py-1 rounded shadow-sm">
                  <div className="font-bold text-sync-orange">90m</div>
                  <div className="text-[9px] uppercase">No Phone</div>
                </div>
                <div className="bg-white px-2 py-1 rounded shadow-sm">
                  <div className="font-bold text-sync-orange">90m</div>
                  <div className="text-[9px] uppercase">No Caff</div>
                </div>
                <div className="bg-white px-2 py-1 rounded shadow-sm">
                  <div className="font-bold text-sync-orange">1g</div>
                  <div className="text-[9px] uppercase">Water</div>
                </div>
              </div>
            </div>

            {/* Dynamic Protocol Box: Movement */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h4 className="font-bold text-sync-blue text-sm flex items-center mb-2">
                <span className="mr-2 text-lg">🏃</span> Movement Anchor
              </h4>
              <p className="text-sm text-gray-700">
                <strong>{currentData.move.title}:</strong> {currentData.move.desc}
                <span className="block text-xs text-gray-500 mt-1 italic">Why: {currentData.move.why}</span>
              </p>
            </div>

            {/* Dynamic Protocol Box: Vagal */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <h4 className="font-bold text-gray-700 text-sm flex items-center mb-2">
                <span className="mr-2 text-lg">❄️</span> Vagal Protocol
              </h4>
              <p className="text-sm text-gray-700">
                <strong>{currentData.vagal.title}:</strong> {currentData.vagal.desc}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* MODAL (CHECKLIST) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-2xl font-display font-bold text-sync-blue">Phase {activePhase} Checklist</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-sync-orange text-2xl transition-colors">&times;</button>
                </div>
                <div className="prose prose-sm text-gray-600">
                    {renderModalContent()}
                </div>
                <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
                    <button onClick={() => window.print()} className="bg-sync-blue text-white px-4 py-2 rounded-lg font-bold hover:bg-sync-dark transition-colors shadow-sm">Print Checklist</button>
                </div>
            </div>
        </div>
      )}
    </section>
  );
};

export default ProtocolSection;
