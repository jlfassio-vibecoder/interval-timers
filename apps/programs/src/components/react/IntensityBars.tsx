/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface IntensityBarsProps {
  level: number;
}

const IntensityBars: React.FC<IntensityBarsProps> = ({ level }) => {
  const scale = [
    'bg-orange-100',
    'bg-orange-300',
    'bg-orange-500',
    'bg-orange-700',
    'bg-orange-900',
  ];

  return (
    <div className="flex h-4 items-end gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2 rounded-sm transition-all duration-500 ${i <= level ? scale[i - 1] : 'bg-white/10'}`}
          style={{ height: `${(i / 5) * 100}%` }}
        />
      ))}
    </div>
  );
};

export default IntensityBars;
