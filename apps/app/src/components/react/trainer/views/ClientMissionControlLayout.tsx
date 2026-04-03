/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared shell for View Stats + Performance Lab under roster/:userId.
 */

import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Video } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trainerLiveParticipantStorageKey } from '@/lib/trainer-live/storage';

const ClientMissionControlLayout: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isTrainer } = useAppContext();
  const [header, setHeader] = useState<{ name: string; email: string | null } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveErr, setLiveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/mission-control/profile/${encodeURIComponent(userId)}`, {
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('profile');
        return r.json() as Promise<{ full_name?: string | null; email?: string | null }>;
      })
      .then((p) => {
        if (cancelled) return;
        setHeader({
          name: (p.full_name?.trim() || p.email?.trim() || 'Client') as string,
          email: p.email ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setHeader({ name: 'Client', email: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const startLiveForClient = async () => {
    if (!userId) return;
    setLiveErr(null);
    setLiveBusy(true);
    try {
      const { data, error } = await supabase.rpc('trainer_live_create_session', {
        p_shell: 'video_only',
        p_invited_client_user_id: userId,
      });
      if (error) {
        setLiveErr(error.message);
        return;
      }
      const row = data as { session_id?: string; participant_id?: string } | null;
      const sid = row?.session_id;
      const pid = row?.participant_id;
      if (!sid || !pid) {
        setLiveErr('Could not start live session');
        return;
      }
      sessionStorage.setItem(trainerLiveParticipantStorageKey(sid), pid);
      navigate(`/live/${sid}`);
    } finally {
      setLiveBusy(false);
    }
  };

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
      isActive
        ? 'border-white/15 bg-white/10 text-orange-light'
        : 'border-transparent text-white/60 hover:text-white'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Roster
          </button>
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold">
              {header ? header.name : <span className="text-white/40">Loading…</span>}
            </h1>
            {header?.email ? <p className="mt-1 text-white/60">{header.email}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <NavLink to="." end className={tabClass}>
              View Stats
            </NavLink>
            <NavLink to="lab" className={tabClass}>
              Performance Lab
            </NavLink>
          </div>
          {isTrainer ? (
            <button
              type="button"
              disabled={liveBusy || !userId}
              onClick={() => void startLiveForClient()}
              className="border-orange-light/40 bg-orange-light/10 hover:bg-orange-light/20 ml-auto flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-orange-light transition-colors disabled:opacity-50 md:ml-0"
            >
              <Video className="h-4 w-4" />
              {liveBusy ? 'Starting…' : 'Live video'}
            </button>
          ) : null}
        </div>
        {liveErr ? (
          <p className="text-sm text-red-300" role="alert">
            {liveErr}
          </p>
        ) : null}
      </div>

      <Outlet />
    </div>
  );
};

export default ClientMissionControlLayout;
