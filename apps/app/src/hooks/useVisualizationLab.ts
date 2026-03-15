/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared hook for Visualization Lab: form state, reference image, and generation logic.
 * Implemented using useContentGenerationLab with exercise-specific options.
 * Used by ExerciseImageGenerator (tab) and ExerciseVisualizationLabModal.
 */

import React, { useState, useEffect } from 'react';
import { useContentGenerationLab } from '@interval-timers/content-generation-lab';
import { supabase } from '@/lib/supabase/client';
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

function buildRequestBody(
  form: {
    exerciseTopic: string;
    complexityLevel: string;
    visualStyle: string;
    outputMode: 'single' | 'sequence';
    demographics: string;
    movementPhase: string;
    bodySide: string;
    bodySideStart: string;
    bodySideEnd: string;
    formCuesToEmphasize: string;
    misrenderingsToAvoid: string;
    domainContext: string;
  },
  referenceImageData: string | null,
  researchOnly: boolean
): Record<string, unknown> {
  return {
    exerciseTopic: form.exerciseTopic,
    complexityLevel: form.complexityLevel,
    visualStyle: form.visualStyle,
    outputMode: form.outputMode,
    demographics: form.demographics || undefined,
    movementPhase: form.movementPhase || undefined,
    ...(form.outputMode === 'sequence'
      ? {
          bodySideStart: form.bodySideStart || undefined,
          bodySideEnd: form.bodySideEnd || undefined,
        }
      : { bodySide: form.bodySide || undefined }),
    formCuesToEmphasize: form.formCuesToEmphasize.trim() || undefined,
    misrenderingsToAvoid: form.misrenderingsToAvoid.trim() || undefined,
    domainContext: form.domainContext.trim() || undefined,
    referenceImage: referenceImageData || undefined,
    researchOnly,
  };
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
  const [reviewPromptsBeforeGenerate, setReviewPromptsBeforeGenerate] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  const formState = {
    exerciseTopic,
    complexityLevel,
    visualStyle,
    outputMode,
    demographics,
    movementPhase,
    bodySide,
    bodySideStart,
    bodySideEnd,
    formCuesToEmphasize,
    misrenderingsToAvoid,
    domainContext,
  };

  const { generation: rawGeneration, reference } = useContentGenerationLab<
    BiomechanicalPoints,
    ResearchOnlyResult
  >({
    apiEndpoint: '/api/generate-exercise-image',
    useReference: true,
    proxyPath: '/api/load-reference-image',
    buildBody: (ref) => buildRequestBody(formState, ref?.referenceImageData ?? null, false),
    parseResponse: (data) => data as BiomechanicalPoints,
    twoPhase: {
      supportsPromptReview: true,
      buildResearchBody: (ref) =>
        buildRequestBody(formState, ref?.referenceImageData ?? null, true),
      parseResearchResponse: (data) => data as ResearchOnlyResult,
      buildGenerateBody: (researchResult, prompts, ref) => {
        const body: Record<string, unknown> = {
          exerciseTopic: formState.exerciseTopic,
          outputMode: formState.outputMode,
          generateFromPrompts: true,
          biomechanicalPoints: researchResult.biomechanicalPoints,
          searchResults: researchResult.searchResults ?? [],
          referenceImage: ref?.referenceImageData ?? undefined,
        };
        if (formState.outputMode === 'sequence' && prompts.imagePrompts) {
          body.imagePrompts = prompts.imagePrompts;
        } else {
          body.imagePrompt = prompts.imagePrompt ?? researchResult.imagePrompt;
        }
        return body;
      },
    },
    reviewPromptsBeforeGenerate,
  });

  const generation = rawGeneration as {
    loading: boolean;
    result: BiomechanicalPoints | null;
    error: string | null;
    submit: () => Promise<void>;
    clearResult: () => void;
    researchResult: ResearchOnlyResult | null;
    promptStep: 'idle' | 'research' | 'review' | 'generating';
    submitFromPrompts: (prompts: {
      imagePrompt?: string;
      imagePrompts?: string[];
    }) => Promise<void>;
    cancelPromptReview: () => void;
  };

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

  const clearResultRef = React.useRef(generation.clearResult);
  const cancelPromptReviewRef = React.useRef(generation.cancelPromptReview);
  clearResultRef.current = generation.clearResult;
  cancelPromptReviewRef.current = generation.cancelPromptReview;

  useEffect(() => {
    if (topicKey !== undefined) {
      setExerciseTopic(initialTopic);
      if (initialExercise) {
        setComplexityLevel(initialExercise.complexityLevel ?? 'intermediate');
        setVisualStyle(initialExercise.visualStyle ?? 'photorealistic');
      }
      clearResultRef.current();
      reference?.clearReferenceImage();
      setFormCuesToEmphasize('');
      setMisrenderingsToAvoid('');
      setDomainContext('');
      setMovementPhase('');
      setBodySide('');
      setBodySideStart('');
      setBodySideEnd('');
    }
  }, [topicKey, initialTopic, initialExercise]);

  useEffect(() => {
    if (outputMode === 'sequence') {
      setBodySide('');
    } else {
      setBodySideStart('');
      setBodySideEnd('');
    }
    cancelPromptReviewRef.current?.();
  }, [outputMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await generation.submit();
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
      referenceImageUrl: reference!.referenceImageUrl,
      setReferenceImageUrl: reference!.setReferenceImageUrl,
      referenceImageData: reference!.referenceImageData,
      loadingReference: reference!.loadingReference,
      referenceError: reference!.referenceError,
      loadReferenceImage: reference!.loadReferenceImage,
      loadReferenceFromUrl: reference!.loadReferenceFromUrl,
      setReferenceFromDataUrl: reference!.setReferenceFromDataUrl,
      clearReferenceImage: reference!.clearReferenceImage,
    },
    generation: {
      loading: generation.loading,
      result: generation.result,
      error: generation.error,
      handleSubmit,
      clearResult: generation.clearResult,
      reviewPromptsBeforeGenerate,
      setReviewPromptsBeforeGenerate,
      researchResult: generation.researchResult ?? null,
      promptStep: generation.promptStep ?? 'idle',
      handleGenerateFromPrompts: generation.submitFromPrompts,
      cancelPromptReview: generation.cancelPromptReview ?? (() => {}),
    },
    user,
  };
}
