/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import { fetchProgram, updateProgram } from '@/lib/supabase/admin/programs';
import { useAppContext } from '@/contexts/AppContext';
import ScheduleBuilder from '../ScheduleBuilder';

// Simple types for the initial refactor
interface ProgramData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  durationWeeks: number;
}

const ProgramEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppContext();

  const [program, setProgram] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [durationWeeks, setDurationWeeks] = useState(4);

  useEffect(() => {
    if (id) {
      loadProgram();
    }
  }, [id]);

  const loadProgram = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProgram(id!);
      setProgram({
        id: data.id,
        title: data.title,
        description: data.description ?? '',
        difficulty: data.difficulty,
        durationWeeks: data.durationWeeks,
      });

      // Populate form
      setTitle(data.title);
      setDescription(data.description ?? '');
      setDifficulty(data.difficulty || 'intermediate');
      setDurationWeeks(data.durationWeeks || 4);
    } catch (err) {
      console.error('[ProgramEditor] Failed to load:', err);
      setError('Failed to load program. It may not exist or you lack permission.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !user) return;
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      await updateProgram(id, {
        title,
        description,
        difficulty,
        durationWeeks,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[ProgramEditor] Save failed:', err);
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
        <span className="ml-3 text-white/60">Loading Program...</span>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/programs')}
          className="flex items-center gap-2 text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          <h2 className="mb-2 text-lg font-bold">Error</h2>
          <p>{error || 'Program not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/programs')}
            className="rounded-full bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Program</h1>
            <p className="text-sm text-white/40">ID: {program.id}</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2.5 font-bold text-black transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-400">
          Program saved successfully!
        </div>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left Column: Core Meta & Schedule */}
        <div className="space-y-6 md:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-6 backdrop-blur-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Info className="h-4 w-4 text-orange-light" />
              Basic Info
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Program Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none transition-colors"
                  placeholder="e.g. Hypertrophy Phase 1"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="focus:border-orange-light/50 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none transition-colors"
                  placeholder="Describe the goals and methodology..."
                />
              </div>
            </div>
          </div>

          {/* Schedule Builder */}
          <ScheduleBuilder programId={program.id} durationWeeks={durationWeeks} />
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-bold">Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/40">
                  Duration (Weeks)
                </label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 4)}
                  className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramEditor;
