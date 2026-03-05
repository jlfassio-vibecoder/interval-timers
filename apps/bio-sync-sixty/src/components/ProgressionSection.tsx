import React, { useState } from 'react';
import { LEVELS } from '../constants';

const ProgressionSection: React.FC = () => {
  const [activeLevel, setActiveLevel] = useState<'novice' | 'inter' | 'master'>('inter');
  const levelData = LEVELS[activeLevel];

  return (
    <section id="progression" className="scroll-mt-24">
      <div className="border-l-4 border-sync-orange pl-6 mb-10">
        <h2 className="text-3xl font-display font-bold text-sync-blue">Safety & Refinement</h2>
        <p className="text-gray-500 mt-2">Adjust the protocol to your biological reality.</p>
      </div>

      {/* Toggles for Levels */}
      <div className="flex justify-center space-x-4 mb-8">
        <button 
          onClick={() => setActiveLevel('novice')} 
          className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
            activeLevel === 'novice' 
            ? 'bg-sync-blue text-white shadow-md border-transparent' 
            : 'border-gray-300 text-gray-500 hover:border-sync-blue hover:text-sync-blue'
          }`}
        >
          Novice
        </button>
        <button 
          onClick={() => setActiveLevel('inter')} 
          className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
            activeLevel === 'inter' 
            ? 'bg-sync-blue text-white shadow-md border-transparent' 
            : 'border-gray-300 text-gray-500 hover:border-sync-blue hover:text-sync-blue'
          }`}
        >
          Intermediate
        </button>
        <button 
          onClick={() => setActiveLevel('master')} 
          className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
            activeLevel === 'master' 
            ? 'bg-sync-blue text-white shadow-md border-transparent' 
            : 'border-gray-300 text-gray-500 hover:border-sync-orange hover:text-sync-orange'
          }`}
        >
          Mastery
        </button>
      </div>

      {/* Dynamic Level Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center max-w-3xl mx-auto shadow-sm">
        <h3 className="font-display font-bold text-xl text-sync-blue mb-4">{levelData.title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Cold Exposure</div>
            <div className="font-bold text-gray-800">{levelData.cold}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Movement</div>
            <div className="font-bold text-gray-800">{levelData.move}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Resistance</div>
            <div className="font-bold text-gray-800">{levelData.lift}</div>
          </div>
        </div>
      </div>

      {/* GLP-1 Alert Box */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-white border-l-4 border-sync-blue p-6 rounded-r-xl max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-2xl mt-1">💊</span>
          <div>
            <h4 className="font-bold text-sync-blue text-lg">GLP-1 Context (Semaglutide/Tirzepatide)</h4>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
              For users on pharmacotherapy, Sync-60 shifts from "Optimization" to <strong>"Lean Mass Defense."</strong> 
              You are at high risk of sarcopenic obesity. The <strong>30g Protein Anchor</strong> (within 30m of waking) and <strong>Resistance Training (3x/week)</strong> are mandatory to prevent muscle catabolism.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProgressionSection;
