/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared hook for Visualization Lab: form state, reference image, and generation logic.
 * Used by ExerciseImageGenerator (tab) and ExerciseVisualizationLabModal.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import type { BiomechanicalPoints, ResearchOnlyResult } from '@/lib/visualization-lab/types';

export interface InitialExerciseForLab {
  exerciseName: string;
  visualStyle?: string;
  complexityLevel?: string;
}

export interface UseVisualizationLabOptions {
  /** Initial exercise topic (modal pre-fill). Default ''. */
  initialTopic?: string;
  /** When this changes, topic is reset to initialTopic (modal: exerciseName when isOpen). */
  topicKey?: string;
  /** When provided (e.g. edit mode), initializes topic, visualStyle, complexityLevel from existing exercise. */
  initialExercise?: InitialExerciseForLab | null;
}

export interface UseVisualizationLabReturn {
  form: {
    exerciseTopic: string;
    setExerciseTopic: (v: string) => void;
    complexityLevel: string;
    setComplexityLevel: (v: string) => void;
    visualStyle: string;
    setVisualStyle: (v: string) => void;
    outputMode: 'single' | 'sequence';
    setOutputMode: (v: 'single' | 'sequence') => void;
    demographics: string;
    setDemographics: (v: string) => void;
    movementPhase: string;
    setMovementPhase: (v: string) => void;
    bodySide: string;
    setBodySide: (v: string) => void;
    bodySideStart: string;
    setBodySideStart: (v: string) => void;
    bodySideEnd: string;
    setBodySideEnd: (v: string) => void;
    formCuesToEmphasize: string;
    setFormCuesToEmphasize: (v: string) => void;
    misrenderingsToAvoid: string;
    setMisrenderingsToAvoid: (v: string) => void;
    domainContext: string;
    setDomainContext: (v: string) => void;
  };
  reference: {
    referenceImageUrl: string;
    setReferenceImageUrl: (v: string) => void;
    referenceImageData: string | null;
    loadingReference: boolean;
    referenceError: string | null;
    loadReferenceImage: () => Promise<void>;
    loadReferenceFromUrl: (url: string) => Promise<void>;
    setReferenceFromDataUrl: (dataUrl: string) => void;
    clearReferenceImage: () => void;
  };
  generation: {
    loading: boolean;
    result: BiomechanicalPoints | null;
    error: string | null;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    clearResult: () => void;
    reviewPromptsBeforeGenerate: boolean;
    setReviewPromptsBeforeGenerate: (v: boolean) => void;
    researchResult: ResearchOnlyResult | null;
    promptStep: 'idle' | 'research' | 'review' | 'generating';
    handleGenerateFromPrompts: (prompts: {
      imagePrompt?: string;
      imagePrompts?: string[];
    }) => Promise<void>;
    cancelPromptReview: () => void;
  };
  /** Current user (Supabase session); use user.id for createdBy, etc. */
  user: { id: string; email?: string } | null;
}

export function useVisualizationLab(
  options: UseVisualizationLabOptions = {}
): UseVisualizationLabReturn {
  const { initialTopic = '', topicKey, initialExercise } = options;

  const [exerciseTopic, setExerciseTopic] = useState(initialExercise?.exerciseName ?? initialTopic);
  const [complexityLevel, setComplexityLevel] = useState(
    initialExercise?.complexityLevel ?? 'intermediate'
  );
  const [visualStyle, setVisualStyle] = useState(initialExercise?.visualStyle ?? 'photorealistic');
  const [outputMode, setOutputMode] = useState<'single' | 'sequence'>('single');
  const [demographics, setDemographics] = useState('');
  const [movementPhase, setMovementPhase] = useState('');
  const [bodySide, setBodySide] = useState('');
  const [bodySideStart, setBodySideStart] = useState('');
  const [bodySideEnd, setBodySideEnd] = useState('');
  const [formCuesToEmphasize, setFormCuesToEmphasize] = useState('');
  const [misrenderingsToAvoid, setMisrenderingsToAvoid] = useState('');
  const [domainContext, setDomainContext] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BiomechanicalPoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [reviewPromptsBeforeGenerate, setReviewPromptsBeforeGenerate] = useState(false);
  const [researchResult, setResearchResult] = useState<ResearchOnlyResult | null>(null);
  const [promptStep, setPromptStep] = useState<'idle' | 'research' | 'review' | 'generating'>(
    'idle'
  );

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted)
        setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted)
        setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Reset form when topic/slug context changes. Runs when topicKey goes undefined too (e.g. navigate
  // from /exercise-image-gen?slug=foo back to /exercise-image-gen) so the form is not stuck on the previous exercise.
  useEffect(() => {
    const topic = initialExercise?.exerciseName ?? initialTopic;
    setExerciseTopic(topic);
    if (initialExercise) {
      setComplexityLevel(initialExercise.complexityLevel ?? 'intermediate');
      setVisualStyle(initialExercise.visualStyle ?? 'photorealistic');
    }
    setResult(null);
    setError(null);
    setResearchResult(null);
    setPromptStep('idle');
    setReferenceImageData(null);
    setReferenceImageUrl('');
    setReferenceError(null);
    // Reset exercise-specific context; keep complexityLevel, visualStyle, demographics as user preferences
    setFormCuesToEmphasize('');
    setMisrenderingsToAvoid('');
    setDomainContext('');
    setMovementPhase('');
    setBodySide('');
    setBodySideStart('');
    setBodySideEnd('');
  }, [topicKey, initialTopic, initialExercise]);

  useEffect(() => {
    // Changing output mode invalidates any previously researched prompts (single vs sequence mismatch).
    setResearchResult(null);
    setPromptStep('idle');
    if (outputMode === 'sequence') {
      setBodySide('');
    } else {
      setBodySideStart('');
      setBodySideEnd('');
    }
  }, [outputMode]);

  const loadReferenceImage = async () => {
    if (!referenceImageUrl.trim()) {
      setReferenceImageData(null);
      setReferenceError(null);
      return;
    }
    setLoadingReference(true);
    setReferenceError(null);
    try {
      const proxyUrl = `/api/load-reference-image?url=${encodeURIComponent(referenceImageUrl.trim())}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load image');
      }
      if (data.base64) {
        setReferenceImageData(data.base64);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setReferenceError(err instanceof Error ? err.message : 'Failed to load reference image');
      setReferenceImageData(null);
    } finally {
      setLoadingReference(false);
    }
  };

  const clearReferenceImage = () => {
    setReferenceImageUrl('');
    setReferenceImageData(null);
    setReferenceError(null);
  };

  const loadReferenceFromUrl = async (url: string) => {
    if (!url.trim()) return;
    setLoadingReference(true);
    setReferenceError(null);
    try {
      const proxyUrl = `/api/load-reference-image?url=${encodeURIComponent(url.trim())}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load image');
      }
      if (data.base64) {
        setReferenceImageData(data.base64);
        setReferenceImageUrl(url.trim());
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setReferenceError(err instanceof Error ? err.message : 'Failed to load reference image');
      setReferenceImageData(null);
    } finally {
      setLoadingReference(false);
    }
  };

  const setReferenceFromDataUrl = (dataUrl: string) => {
    setReferenceImageData(dataUrl);
    setReferenceImageUrl('');
    setReferenceError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    if (reviewPromptsBeforeGenerate) {
      setPromptStep('research');
    }
    try {
      const response = await fetch('/api/generate-exercise-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTopic,
          complexityLevel,
          visualStyle,
          outputMode,
          demographics,
          movementPhase: movementPhase || undefined,
          ...(outputMode === 'sequence'
            ? {
                bodySideStart: bodySideStart || undefined,
                bodySideEnd: bodySideEnd || undefined,
              }
            : { bodySide: bodySide || undefined }),
          formCuesToEmphasize: formCuesToEmphasize.trim() || undefined,
          misrenderingsToAvoid: misrenderingsToAvoid.trim() || undefined,
          domainContext: domainContext.trim() || undefined,
          referenceImage: referenceImageData || undefined,
          researchOnly: reviewPromptsBeforeGenerate,
        }),
      });
      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        console.error('generate-exercise-image error', response.status, errData.error ?? errData);
        throw new Error(errData.error || 'Failed to generate image');
      }
      const data = await response.json();
      if (reviewPromptsBeforeGenerate) {
        setResearchResult(data);
        setPromptStep('review');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setPromptStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromPrompts = async (prompts: {
    imagePrompt?: string;
    imagePrompts?: string[];
  }) => {
    if (!researchResult) return;
    setLoading(true);
    setError(null);
    setPromptStep('generating');
    try {
      const body: Record<string, unknown> = {
        exerciseTopic,
        outputMode,
        generateFromPrompts: true,
        biomechanicalPoints: researchResult.biomechanicalPoints,
        searchResults: researchResult.searchResults ?? [],
        referenceImage: referenceImageData || undefined,
      };
      if (outputMode === 'sequence' && prompts.imagePrompts) {
        body.imagePrompts = prompts.imagePrompts;
      } else {
        body.imagePrompt = prompts.imagePrompt ?? researchResult.imagePrompt;
      }
      const response = await fetch('/api/generate-exercise-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'Failed to generate image');
      }
      const data = await response.json();
      setResult(data);
      setResearchResult(null);
      setPromptStep('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
      setPromptStep('review');
    } finally {
      setLoading(false);
    }
  };

  const cancelPromptReview = () => {
    setResearchResult(null);
    setPromptStep('idle');
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
    setResearchResult(null);
    setPromptStep('idle');
  };

  return {
    form: {
      exerciseTopic,
      setExerciseTopic,
      complexityLevel,
      setComplexityLevel,
      visualStyle,
      setVisualStyle,
      outputMode,
      setOutputMode,
      demographics,
      setDemographics,
      movementPhase,
      setMovementPhase,
      bodySide,
      setBodySide,
      bodySideStart,
      setBodySideStart,
      bodySideEnd,
      setBodySideEnd,
      formCuesToEmphasize,
      setFormCuesToEmphasize,
      misrenderingsToAvoid,
      setMisrenderingsToAvoid,
      domainContext,
      setDomainContext,
    },
    reference: {
      referenceImageUrl,
      setReferenceImageUrl,
      referenceImageData,
      loadingReference,
      referenceError,
      loadReferenceImage,
      loadReferenceFromUrl,
      setReferenceFromDataUrl,
      clearReferenceImage,
    },
    generation: {
      loading,
      result,
      error,
      handleSubmit,
      clearResult,
      reviewPromptsBeforeGenerate,
      setReviewPromptsBeforeGenerate,
      researchResult,
      promptStep,
      handleGenerateFromPrompts,
      cancelPromptReview,
    },
    user,
  };
}
