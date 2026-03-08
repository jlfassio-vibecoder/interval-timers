/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trainer card for Program Sidebar: avatar + name + "Your coach" label. Phase 0: static only.
 */

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

const TrainerCard: React.FC = () => {
  const { trainerProfile } = useAppContext();

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
        Your coach
      </p>
      {trainerProfile ? (
        <div className="flex items-center gap-3">
          {trainerProfile.avatarUrl ? (
            <img
              src={trainerProfile.avatarUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="bg-orange-light/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold uppercase text-orange-light">
              {getInitials(trainerProfile.displayName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-bold text-white">
              {trainerProfile.displayName}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm italic text-white/40">
          No coach assigned. Join a program to see your coach here.
        </p>
      )}
    </div>
  );
};

export default TrainerCard;
