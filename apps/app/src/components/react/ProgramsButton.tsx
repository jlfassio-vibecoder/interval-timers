/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play } from 'lucide-react';

const ProgramsButton: React.FC = () => {
  return (
    <a
      href="/programs"
      className="relative z-20 flex transform items-center gap-2 rounded-full bg-orange-light px-6 py-3 text-xs font-bold uppercase tracking-widest text-black shadow-xl transition-all hover:scale-105 hover:bg-white md:text-sm"
      data-hover="true"
    >
      Review Programs <Play className="h-4 w-4 fill-current" />
    </a>
  );
};

export default ProgramsButton;
