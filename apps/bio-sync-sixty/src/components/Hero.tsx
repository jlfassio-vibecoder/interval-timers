import React from 'react';
import { BASE } from '../constants';

const Hero: React.FC = () => {
  return (
    <header className="text-center space-y-6">
      <div className="space-y-2">
        <div className="inline-block px-3 py-1 bg-sync-blue/5 text-sync-blue rounded-full text-xs font-bold uppercase tracking-widest">
          Protocol Version 2.0.26
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold text-sync-blue tracking-tight leading-tight">
        Hard is Over. <br className="hidden md:block" />
        <span className="text-sync-orange">Sync60 has begun.</span>
        </h1>
      </div>
      <div className="flex justify-center">
        <img
          src={`${BASE}/images/bio-sync60x512.png`}
          alt="Bio-Sync60"
          className="block h-[11.72rem] w-[11.72rem] md:h-[15.625rem] md:w-[15.625rem] object-contain"
          style={{
            filter: 'drop-shadow(0 0 40px rgba(224,108,62,0.455)) drop-shadow(0 0 70px rgba(224,108,62,0.26))',
          }}
        />
      </div>
      <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 leading-relaxed">
        We are transitioning from the era of attrition to the age of alignment.
        <span className="block mt-2">Sync-60 is a 3-stage daily routine that aligns your workouts, meals, and sleep with your body's natural clock so you can achieve peak fitness without the burnout.</span>
        <span className="block mt-4 mb-2 font-medium text-sync-orange">From Sufferer to Synchronizer.</span>
      </p>
    </header>
  );
};

export default Hero;
