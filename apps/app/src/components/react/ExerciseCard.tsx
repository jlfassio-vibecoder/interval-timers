/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ExerciseCardProps {
  exerciseName: string;
  index: number;
  onClick?: () => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exerciseName, index, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:border-orange-light/30 group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 text-left text-sm text-white/80 transition-all"
    >
      <span className="font-mono text-[10px] text-white/20">
        {(index + 1).toString().padStart(2, '0')}
      </span>
      <span className="font-bold uppercase tracking-widest transition-colors group-hover:text-orange-light">
        {exerciseName}
      </span>
    </button>
  );
};

export default ExerciseCard;
