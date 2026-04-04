/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Opens a coach-assigned resource from /workout/assigned?assignmentId=…
 * (program, workout/WOD, exercise, or challenge — payload decides).
 */

import React, { useEffect, useState } from 'react';
import type { Artist } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import WorkoutDetailModal from '@/components/react/WorkoutDetailModal';

function ProgramAssignRedirect({ programId }: { programId: string }) {
  const { setActiveProgramId } = useAppContext();
  useEffect(() => {
    setActiveProgramId(programId);
    window.location.replace('/#program-sidebar');
  }, [programId, setActiveProgramId]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center text-white">
      <p className="text-white/80">Switching to your assigned program…</p>
    </div>
  );
}

function HrefAssignRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center text-white">
      <p className="text-white/80">Opening your assignment…</p>
    </div>
  );
}

const AssignedCoachWorkoutPage: React.FC = () => {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [programPayload, setProgramPayload] = useState<{ programId: string } | null>(null);
  const [hrefRedirect, setHrefRedirect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('assignmentId');
    if (!id?.trim()) {
      setError('Missing assignment.');
      setLoading(false);
      return;
    }
    setAssignmentId(id.trim());
    let cancelled = false;
    fetch(`/api/me/coach-assignments/${encodeURIComponent(id.trim())}/payload`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body.error === 'string' ? body.error : 'Could not load assignment'
          );
        }
        if (cancelled) return;
        if (body.assignmentType === 'program' && typeof body.programId === 'string') {
          setProgramPayload({ programId: body.programId });
        } else if (
          (body.assignmentType === 'exercise' || body.assignmentType === 'challenge') &&
          typeof body.href === 'string' &&
          body.href.trim()
        ) {
          setHrefRedirect(body.href.trim());
        } else if (body.artist && typeof body.artist === 'object') {
          setArtist(body.artist as Artist);
        } else {
          throw new Error('Unexpected response');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load assignment');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        <span className="ml-3 text-white/60">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-300">{error}</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg border border-white/20 px-4 py-2 text-white/90 hover:bg-white/10"
        >
          Back home
        </a>
      </div>
    );
  }

  if (programPayload) {
    return <ProgramAssignRedirect programId={programPayload.programId} />;
  }

  if (hrefRedirect) {
    return <HrefAssignRedirect href={hrefRedirect} />;
  }

  if (!artist) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-dark px-4 py-10">
      <WorkoutDetailModal
        workout={artist}
        onClose={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.assign('/');
        }}
        onLogWorkout={() => {
          const aid = assignmentId?.trim();
          if (aid) {
            window.location.assign(
              `/workout/log-pasted?coachAssignmentId=${encodeURIComponent(aid)}`
            );
          } else {
            window.location.assign('/workout/log-pasted');
          }
        }}
      />
    </div>
  );
};

export default AssignedCoachWorkoutPage;
