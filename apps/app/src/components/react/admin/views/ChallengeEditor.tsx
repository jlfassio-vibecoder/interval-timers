/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-page challenge editor. Uses shared primitives (EditorHeader, StatusMessage,
 * EditorMetaForm, ScheduleViewer) and ChallengeGeneratorModal for AI regeneration.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { ChallengeTemplate, ChallengeConfig } from '@/types/ai-challenge';
import type { PromptChainMetadata } from '@/types/ai-program';
import {
  fetchFullChallenge,
  fetchChallengeMetadata,
  updateChallenge,
} from '@/lib/supabase/client/challenge-persistence';
import { supabase } from '@/lib/supabase/client';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import EditorHeader from '../EditorHeader';
import StatusMessage from '../StatusMessage';
import EditorMetaForm from '../EditorMetaForm';
import ScheduleViewer from '../ScheduleViewer';
import ChallengeGeneratorModal from '../ChallengeGeneratorModal';

const ChallengeEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeTemplate | null>(null);
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig | null>(null);
  const [chainMetadata, setChainMetadata] = useState<PromptChainMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    durationWeeks: 0,
    theme: '',
  });

  useEffect(() => {
    if (id) {
      fetchChallenge();
    } else {
      setError('No challenge ID provided');
      setLoading(false);
    }
  }, [id]);

  const fetchChallenge = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const fullChallenge = await fetchFullChallenge(id);
      setChallenge(fullChallenge);
      setFormData({
        title: fullChallenge.title || '',
        description: fullChallenge.description || '',
        difficulty: fullChallenge.difficulty || 'beginner',
        durationWeeks: fullChallenge.durationWeeks || 0,
        theme: fullChallenge.theme || '',
      });

      try {
        const metadata = await fetchChallengeMetadata(id);
        const config: ChallengeConfig = {
          challengeInfo: {
            title: fullChallenge.title || '',
            description: fullChallenge.description || '',
          },
          targetAudience: metadata.targetAudience || {
            ageRange: '26-35',
            sex: 'Male',
            weight: 180,
            experienceLevel: fullChallenge.difficulty || 'intermediate',
          },
          requirements: {
            durationWeeks: metadata.durationWeeks as 2 | 3 | 4 | 5 | 6,
            theme: fullChallenge.theme,
          },
          medicalContext: { includeInjuries: false, includeConditions: false },
          goals: metadata.goals ?? { primary: 'Muscle Gain', secondary: 'Strength' },
          zoneId: metadata.equipmentProfile?.zoneId,
          selectedEquipmentIds: metadata.equipmentProfile?.equipmentIds,
        };
        setChallengeConfig(config);
        setChainMetadata(metadata.chain_metadata ?? null);
      } catch (metaErr) {
        console.warn('[ChallengeEditor] Metadata fetch failed, using fallback config', metaErr);
        setChallengeConfig({
          challengeInfo: {
            title: fullChallenge.title || '',
            description: fullChallenge.description || '',
          },
          targetAudience: {
            ageRange: '26-35',
            sex: 'Male',
            weight: 180,
            experienceLevel: fullChallenge.difficulty || 'intermediate',
          },
          requirements: {
            durationWeeks: (fullChallenge.durationWeeks ?? 4) as 2 | 3 | 4 | 5 | 6,
            theme: fullChallenge.theme || '',
          },
          goals: { primary: 'Muscle Gain', secondary: 'Strength' },
        });
        setChainMetadata(null);
      }
    } catch (err) {
      console.error('[ChallengeEditor] Error fetching challenge', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch challenge');
      setChallenge(null);
      setChallengeConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !challenge || !challengeConfig) return;
    if (!formData.title.trim()) {
      setError('Challenge title is required');
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setError('You must be signed in to save');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const challengeData: ChallengeTemplate = {
        ...challenge,
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: formData.difficulty,
        durationWeeks: formData.durationWeeks,
        theme: formData.theme.trim() || undefined,
      };

      const config: ChallengeConfig = {
        ...challengeConfig,
        challengeInfo: { title: challengeData.title, description: challengeData.description },
        requirements: { ...challengeConfig.requirements, theme: formData.theme },
      };

      await updateChallenge(id, challengeData, config);

      setSaveSuccess(true);
      await fetchChallenge();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save challenge');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/challenges')}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to List</span>
          </button>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
          <p className="text-white/60">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (error && !challenge) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/challenges')}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to List</span>
          </button>
        </div>
        <StatusMessage type="error" message={error} />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="space-y-6">
        <EditorHeader title="Edit Challenge" backPath="/challenges" />
        <StatusMessage type="error" message="Challenge not found" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-challenge-editor>
      <EditorHeader
        title="Edit Challenge"
        backPath="/challenges"
        actions={
          <button
            onClick={() => setShowGeneratorModal(true)}
            disabled={!challengeConfig}
            className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5" />
            <span>Edit schedule with AI</span>
          </button>
        }
      />

      {error != null && error.trim() !== '' && (
        <StatusMessage type="error" message={error} onDismiss={() => setError(null)} />
      )}
      {saveSuccess && (
        <StatusMessage
          type="success"
          message="Challenge saved successfully!"
          onDismiss={() => setSaveSuccess(false)}
        />
      )}

      <EditorMetaForm
        formData={{
          ...formData,
          durationWeeks: formData.durationWeeks,
        }}
        onChange={(data) =>
          setFormData({
            ...formData,
            title: data.title,
            description: data.description,
            difficulty: data.difficulty,
            durationWeeks: data.durationWeeks ?? formData.durationWeeks,
            theme: formData.theme,
          })
        }
        onSubmit={handleSave}
        saving={saving}
        sectionTitle="Challenge Information"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Theme</label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
            placeholder="e.g. Strength Builder, Fat Loss"
            disabled={saving}
          />
        </div>
      </EditorMetaForm>

      <ScheduleViewer
        schedule={challenge.schedule ?? []}
        getExercisesFromWorkout={getExercisesFromWorkout}
        emptyState={
          <div className="rounded-lg border-2 border-dashed border-white/20 bg-black/10 p-24 text-center backdrop-blur-sm">
            <p className="text-xl font-medium text-white/60">No schedule yet</p>
            <p className="mt-2 text-sm text-white/40">
              Use &quot;Edit schedule with AI&quot; to create a challenge schedule
            </p>
          </div>
        }
      />

      {challenge.milestones && challenge.milestones.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <h2 className="mb-4 font-heading text-xl font-bold">Milestones</h2>
          <ul className="space-y-2">
            {challenge.milestones.map((m, i) => (
              <li key={i} className="flex items-center gap-3 text-white/80">
                <span className="bg-orange-light/20 rounded-full px-2 py-1 text-xs text-orange-light">
                  Week {m.week}
                </span>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ChallengeGeneratorModal
        isOpen={showGeneratorModal}
        onClose={() => setShowGeneratorModal(false)}
        onGenerate={async () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 5000);
          await fetchChallenge();
        }}
        existingChallenge={challenge}
        challengeConfig={challengeConfig ?? undefined}
        editingChallengeId={id ?? undefined}
        editingChainMetadata={chainMetadata ?? undefined}
      />
    </div>
  );
};

export default ChallengeEditor;
