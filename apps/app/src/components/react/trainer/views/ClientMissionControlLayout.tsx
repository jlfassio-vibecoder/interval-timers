/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared shell for View Stats + Performance Lab under roster/:userId.
 */

import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ClientMissionControlLayout: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [header, setHeader] = useState<{ name: string; email: string | null } | null>(null);

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

        <div className="flex gap-1">
          <NavLink to="." end className={tabClass}>
            View Stats
          </NavLink>
          <NavLink to="lab" className={tabClass}>
            Performance Lab
          </NavLink>
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default ClientMissionControlLayout;
