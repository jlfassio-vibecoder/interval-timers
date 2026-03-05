import React from 'react';

const TrendsSection: React.FC = () => {
  return (
    <section id="trends" className="bg-sync-dark text-white rounded-3xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] rounded-full bg-sync-blue blur-3xl"></div>
        <div className="absolute bottom-[-50%] right-[-20%] w-[800px] h-[800px] rounded-full bg-sync-orange blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <h2 className="text-3xl font-display font-bold mb-4">The New Social Currency</h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-10">
          The "sweaty selfie" is obsolete. In 2026, status is defined by data-driven resilience.
        </p>

        <div className="inline-flex flex-col items-center">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" r="88" stroke="#333" strokeWidth="12" fill="none" />
              <circle 
                cx="96" 
                cy="96" 
                r="88" 
                stroke="#E06C3E" 
                strokeWidth="12" 
                fill="none" 
                strokeDasharray="552" 
                strokeDashoffset="100" 
                className="transition-all duration-1000 ease-out" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold font-display">92</span>
              <span className="text-xs uppercase tracking-widest text-gray-400 mt-1">Sync Score</span>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 text-left w-full max-w-xs">
            <div className="bg-white/10 p-3 rounded text-xs">
              <div className="text-gray-400">Sleep Regularity</div>
              <div className="font-bold text-sync-orange">98%</div>
            </div>
            <div className="bg-white/10 p-3 rounded text-xs">
              <div className="text-gray-400">HRV Baseline</div>
              <div className="font-bold text-sync-orange">65ms</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendsSection;
