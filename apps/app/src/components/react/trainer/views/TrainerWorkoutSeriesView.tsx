/**
 * Mission Control — one generated program (linked sessions + unparsed snapshot).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { WorkoutInSet, WorkoutSetTemplate } from '@/types/ai-workout';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import WorkoutSessionPreviewContent from '@/components/react/trainer/WorkoutSessionPreviewContent';

type SeriesApiPayload = {
  id: string;
  title: string;
  description: string | null;
  rawWorkoutSet: unknown;
  sessions: Array<{ id: string; title: string; sessionIndex: number | null }>;
};

const TrainerWorkoutSeriesView: React.FC = () => {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SeriesApiPayload | null>(null);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(`/api/trainer/workout-series/${encodeURIComponent(seriesId)}`, {
        credentials: 'include',
        headers: { ...auth },
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof raw.error === 'string' ? raw.error : 'Could not load series');
      }
      setData(raw as SeriesApiPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rawSet = data?.rawWorkoutSet as WorkoutSetTemplate | undefined;
  const workouts = rawSet?.workouts ?? [];

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
      </div>
    );
  }

  if (error || !seriesId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/workouts')}
          className="flex items-center gap-2 text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workouts
        </button>
        <p className="text-red-300">{error ?? 'Missing series id'}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/workouts')}
            className="rounded-full bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{data.title}</h1>
            {data.description ? (
              <p className="mt-1 text-sm text-white/55">{data.description}</p>
            ) : null}
            {rawSet?.difficulty ? (
              <p className="mt-1 text-xs text-white/45">
                {workouts.length} workout(s) · {rawSet.difficulty}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Sessions</h2>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-white/50">No sessions linked.</p>
        ) : (
          <ul className="space-y-4">
            {data.sessions.map((s) => {
              const idx =
                typeof s.sessionIndex === 'number' && s.sessionIndex >= 0 ? s.sessionIndex : 0;
              const rawSession =
                workouts.length > idx ? (workouts[idx] as WorkoutInSet | undefined) : undefined;
              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-white">{s.title}</span>
                    <NavLink
                      to={`/workouts/${encodeURIComponent(s.id)}/edit`}
                      className="hover:bg-orange-light/20 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:text-orange-light"
                    >
                      Edit session
                    </NavLink>
                  </div>
                  {rawSession ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <WorkoutSessionPreviewContent w={rawSession} headingLevel="h4" />
                    </div>
                  ) : (
                    <p className="text-xs text-white/45">
                      Preview unavailable — open the session to edit saved blocks.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TrainerWorkoutSeriesView;
