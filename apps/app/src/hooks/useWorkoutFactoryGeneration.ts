import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';
import type { WorkoutChainMetadata, WorkoutSetTemplate } from '@/types/ai-workout';
import {
  postGenerateWorkoutChain,
  WORKOUT_FACTORY_CHAIN_MESSAGES,
} from '@/lib/workout-factory-client';

export interface UseWorkoutFactoryGenerationParams {
  /** Builds the JSON body for POST /api/ai/generate-workout-chain */
  buildRequestBody: () => Record<string, unknown>;
  onSuccess: (data: {
    workoutSet: WorkoutSetTemplate;
    chain_metadata: WorkoutChainMetadata;
  }) => void;
  /** Toast + copy after successful generation */
  successToast?: { title: string; description?: string };
}

export function useWorkoutFactoryGeneration({
  buildRequestBody,
  onSuccess,
  successToast = {
    title: 'Workout set generated',
    description: 'Review and save to library.',
  },
}: UseWorkoutFactoryGenerationParams) {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [chainStep, setChainStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Avoid leaking the step-progress interval if the host unmounts mid-generation (e.g. route change).
  useEffect(() => {
    return () => clearProgressInterval();
  }, [clearProgressInterval]);

  const handleGenerate = useCallback(
    async (e: SyntheticEvent, options?: { step1UserPromptOverride?: string }) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      setChainStep(0);
      setLoadingMessage(WORKOUT_FACTORY_CHAIN_MESSAGES[0]);
      clearProgressInterval();
      progressIntervalRef.current = setInterval(() => {
        setChainStep((prev) => {
          const maxIndex = WORKOUT_FACTORY_CHAIN_MESSAGES.length - 1;
          const next = Math.min(prev + 1, maxIndex);
          setLoadingMessage(WORKOUT_FACTORY_CHAIN_MESSAGES[next]);
          return next;
        });
      }, 4000);
      try {
        const base = buildRequestBody();
        const body: Record<string, unknown> = { ...base };
        if (options?.step1UserPromptOverride !== undefined) {
          const t = options.step1UserPromptOverride.trim();
          if (t.length > 0) body.step1UserPromptOverride = t;
        }
        const data = await postGenerateWorkoutChain(body);
        onSuccess({
          workoutSet: data.workoutSet,
          chain_metadata: data.chain_metadata,
        });
        setChainStep(4);
        toast.success(successToast.title, { description: successToast.description });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate workout';
        setError(msg);
        toast.error('Generation failed', { description: msg });
      } finally {
        clearProgressInterval();
        setLoading(false);
        setLoadingMessage('');
      }
    },
    [
      buildRequestBody,
      clearProgressInterval,
      onSuccess,
      successToast.description,
      successToast.title,
    ]
  );

  const resetGenerationState = useCallback(() => {
    clearProgressInterval();
    setChainStep(0);
    setLoadingMessage('');
    setError(null);
  }, [clearProgressInterval]);

  return {
    handleGenerate,
    loading,
    loadingMessage,
    chainStep,
    error,
    setError,
    resetGenerationState,
  };
}
