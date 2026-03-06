import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BASE, CHART_DATA } from '../constants';
import NeuroResetSection from './NeuroResetSection';

const ScienceSection: React.FC = () => {
  return (
    <section id="science" className="scroll-mt-24">
      <div className="border-l-4 border-sync-orange pl-6 mb-10">
        <h2 className="text-3xl font-display font-bold text-sync-blue">The Science of Sync</h2>
        <p className="text-gray-500 mt-2">Why legacy "intensity" fails and biological precision and environmental synchronization win.</p>
      </div>

      <div className="space-y-10">
        {/* Mitochondrial Health (VT1) - full width */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-xl text-sync-blue">Mitochondrial Calibration</h3>
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Standard heart rate formulas (220-age) fail 29% of the population, leading to "Metabolic Inflexibility". Bio-Sync60 uses <strong>VT1 (Ventilatory Threshold 1)</strong> as the anchor for true mitochondrial efficiency. Training just below VT1 is the primary driver for mitochondrial biogenesis and lactate clearance.
          </p>
          <div className="w-full h-[300px] md:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHART_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis unit="%" />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {CHART_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-between text-xs text-gray-400 font-mono">
            <span>Generic Formula Risk</span>
            <span>Bio-Sync60 Precision</span>
          </div>
          <a
            href={BASE + '/mitochondrial'}
            className="mt-8 w-full bg-sync-blue text-white font-bold py-3 rounded-lg text-sm hover:bg-sync-dark transition-all shadow-sm flex items-center justify-center gap-2 block text-center"
          >
            <span>⚡</span>
            <span>Deep Dive: The Mitochondrial Calibration</span>
          </a>
        </div>

        {/* Neuro-Reset section - full width below */}
        <NeuroResetSection />
      </div>

      {/* CHRONONUTRITION BANNER */}
      <div className="mt-10 bg-sync-blue text-white rounded-2xl p-8 relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-2xl font-display font-bold">Chrononutrition: The Metabolic Switch</h3>
            <p className="text-gray-300 leading-relaxed">
              Bio-Sync60 employs <strong>Early Time-Restricted Eating (eTRE)</strong>. By aligning food intake with daylight, we significantly reduce the Glycemic Area Under Curve (AUC), forcing the body to burn fat for fuel during the "Digital Sunset."
            </p>
            <div className="inline-flex items-center bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10">
              <span className="text-sync-orange font-bold mr-2">The Rule:</span>
              <span className="text-sm">10-Hour Metabolic Window (e.g., 8am - 6pm)</span>
            </div>
            <a
              href={BASE + '/master-clock'}
              className="inline-flex items-center justify-center gap-2 bg-white text-sync-blue font-bold py-3 px-5 rounded-lg text-sm hover:bg-sync-orange hover:text-white transition-all shadow-lg"
            >
              <span>🕐</span>
              <span>Set Your Metabolic Window (Master Clock)</span>
            </a>
          </div>
          {/* Clock Visual */}
          <div className="flex flex-col items-center gap-6">
            <div className="w-32 h-32 rounded-full border-4 border-white/20 relative flex items-center justify-center bg-sync-blue">
              <div className="absolute inset-0 rounded-full border-4 border-sync-orange" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%, 0 100%, 0 40%)', transform: 'rotate(45deg)' }}></div>
              <div className="text-center z-10">
                <div className="text-xs text-gray-400 uppercase">Metabolic</div>
                <div className="font-bold text-xl">10h</div>
              </div>
            </div>
            
            <a
              href={BASE + '/chrono'}
              className="w-full bg-white text-sync-blue font-bold py-3 rounded-lg text-sm hover:bg-sync-orange hover:text-white transition-all shadow-lg flex items-center justify-center gap-2 block text-center"
            >
              <span>⏰</span>
              <span>Deep Dive: The Liver Clock</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScienceSection;
