/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Performance Lab P0: enrollments, recommended active program, end enrollment, Builder links.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, FlaskConical } from 'lucide-react';
import { adminPaths } from '@/lib/admin/config';

interface EnrollmentRow {
  programId: string;
  title: string;
  status: string;
  startDate: string | null;
  source: string | null;
  isRecommended: boolean;
}

interface EnrollmentsResponse {
  recommendedProgramId: string | null;
  enrollments: EnrollmentRow[];
}

const PerformanceLabView: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<EnrollmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/clients/${encodeURIComponent(userId)}/enrollments`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to load enrollments');
        setData(null);
        return;
      }
      setData(body as EnrollmentsResponse);
    } catch {
      setError('Failed to load enrollments');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRecommended = async (programId: string | null) => {
    if (!userId) return;
    setBusy(programId ? `rec:${programId}` : 'rec:clear');
    try {
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/active-program`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programId }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not update');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const endEnrollment = async (programId: string) => {
    if (!userId) return;
    if (!window.confirm('End this program for the client? They will keep history but enrollment becomes completed.')) {
      return;
    }
    setBusy(`end:${programId}`);
    try {
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/enrollments/${encodeURIComponent(programId)}/end`,
        { method: 'POST', credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not end enrollment');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        <span className="ml-3 text-white/60">Loading Performance Lab…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const enrollments = data?.enrollments ?? [];
  const hasRec = !!data?.recommendedProgramId;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
        <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-orange-light" />
        <div>
          <h2 className="font-heading text-xl font-bold">Programs & enrollments</h2>
          <p className="mt-1 text-sm text-white/60">
            Set the client&apos;s recommended active program (shown in their HUD when valid). End
            enrollments when they should no longer run the program. Edit templates in the Builder.
          </p>
          {hasRec && (
            <button
              type="button"
              disabled={busy === 'rec:clear'}
              onClick={() => void setRecommended(null)}
              className="mt-3 text-sm font-medium text-orange-light underline decoration-orange-light/50 hover:decoration-orange-light disabled:opacity-40"
            >
              Clear recommended active program
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-black/30">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Program</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Start</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Source</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-white/80">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-white/60">
                  No program enrollments for this client on your programs.
                </td>
              </tr>
            ) : (
              enrollments.map((row) => {
                const rowBusyEnd = busy === `end:${row.programId}`;
                const rowBusyRec = busy === `rec:${row.programId}`;
                // user_programs.status is only active|completed (00005_user_programs.sql); no paused/cancelled until schema changes.
                const canSetActive = row.status === 'active';
                return (
                  <tr key={row.programId} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="font-medium">{row.title}</div>
                      {row.isRecommended && (
                        <span className="mt-1 inline-block rounded bg-orange-light/20 px-2 py-0.5 text-xs font-bold uppercase text-orange-light">
                          Recommended active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white/70">{row.status}</td>
                    <td className="px-6 py-4 text-white/70">{formatDate(row.startDate)}</td>
                    <td className="px-6 py-4 text-white/70">{row.source ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canSetActive && !row.isRecommended && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void setRecommended(row.programId)}
                            className="rounded-lg border border-orange-light/40 px-3 py-1.5 text-xs font-bold uppercase text-orange-light hover:bg-orange-light/10 disabled:opacity-40"
                          >
                            {rowBusyRec ? '…' : 'Set active'}
                          </button>
                        )}
                        {canSetActive && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void endEnrollment(row.programId)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-40"
                          >
                            {rowBusyEnd ? '…' : 'End'}
                          </button>
                        )}
                        <a
                          href={`${adminPaths.root}/programs/${row.programId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
                        >
                          Builder
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/50">Coming soon</p>
        <ul className="mt-2 list-inside list-disc text-sm text-white/45">
          <li>Assignments (programs, challenges, workouts)</li>
          <li>Calendar</li>
          <li>Message board</li>
          <li>Weekly activity board</li>
        </ul>
      </div>
    </div>
  );
};

export default PerformanceLabView;
