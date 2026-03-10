import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../../contexts/AppContext';
import { adminPaths } from '@/lib/admin/config';
import type { AppUser } from '@/contexts/AppContext';

interface TrainerDashboardProps {
  /** Optional profile from parent (e.g. TrainerGuard) for display. */
  profile?: AppUser | null;
}

const TrainerDashboard: React.FC<TrainerDashboardProps> = ({ profile: profileProp }) => {
  const navigate = useNavigate();
  const { profile: contextProfile } = useAppContext();
  const profile = profileProp ?? contextProfile;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-12">
        <h1 className="mb-2 text-4xl font-black uppercase tracking-tight">Mission Control</h1>
        <p className="font-mono text-sm uppercase tracking-widest text-white/60">
          Welcome back, {profile?.displayName ?? profile?.email ?? 'Commander'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="hover:border-orange-light/50 group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors">
          <h2 className="mb-2 text-2xl font-bold">Roster</h2>
          <p className="mb-6 text-white/60">Manage active cadets and assignments.</p>
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold uppercase transition-colors hover:bg-orange-light hover:text-black"
          >
            View Clients
          </button>
        </div>

        <div className="hover:border-orange-light/50 group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors">
          <h2 className="mb-2 text-2xl font-bold">Programming</h2>
          <p className="mb-6 text-white/60">Design workouts and training blocks.</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = adminPaths.root;
            }}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold uppercase transition-colors hover:bg-orange-light hover:text-black"
          >
            Open Builder
          </button>
        </div>

        <div className="hover:border-orange-light/50 group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 transition-colors">
          <h2 className="mb-2 text-2xl font-bold">Intel</h2>
          <p className="mb-6 text-white/60">Review performance metrics and compliance.</p>
          <button
            type="button"
            onClick={() => navigate('/intel')}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold uppercase transition-colors hover:bg-orange-light hover:text-black"
          >
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainerDashboard;
