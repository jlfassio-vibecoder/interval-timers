import { ArrowRight, Edit3, Target, Dumbbell, Activity, Wrench } from 'lucide-react';
import type { WebsiteOnboardingData } from '@/types/onboarding';
import {
  fitnessLevelOptions,
  activityLevelOptions,
  equipmentAccessOptions,
} from '@/data/onboarding-options';
import { equipmentArrayToAccess } from '@/lib/urlOnboarding';

interface PlanPreviewProps {
  data: WebsiteOnboardingData;
  onEdit: () => void;
  onCreateAccount: () => void;
}

export function PlanPreview({ data, onEdit, onCreateAccount }: PlanPreviewProps) {
  const levelLabel =
    fitnessLevelOptions.find((o) => o.value === data.fitness_level)?.label ?? data.fitness_level;
  const activityLabel =
    activityLevelOptions.find((o) => o.value === data.current_activity_level)?.label ??
    data.current_activity_level;
  const equipmentAccess = equipmentArrayToAccess(data.equipment_access);
  const equipmentLabel =
    equipmentAccessOptions.find((o) => o.value === equipmentAccess)?.label ??
    data.equipment_access.join(', ');
  const goalsDisplay =
    data.fitness_goals.length === 0
      ? '—'
      : data.fitness_goals.length === 1
        ? data.fitness_goals[0]
        : data.fitness_goals.slice(0, -1).join(', ') +
          ' & ' +
          data.fitness_goals[data.fitness_goals.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="m-0 mb-1 text-2xl font-bold text-white">Let&apos;s Do This!</h3>
        <p className="m-0 text-base text-white/80">
          Here&apos;s your profile. Create your account and we&apos;ll generate your first workout.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-light" />
          <div>
            <span className="block text-sm font-medium text-white/60">Goals</span>
            <span className="text-white">{goalsDisplay}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Dumbbell className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-light" />
          <div>
            <span className="block text-sm font-medium text-white/60">Level</span>
            <span className="text-white">{levelLabel}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-light" />
          <div>
            <span className="block text-sm font-medium text-white/60">Activity</span>
            <span className="text-white">{activityLabel}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Wrench className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-light" />
          <div>
            <span className="block text-sm font-medium text-white/60">Equipment</span>
            <span className="text-white">{equipmentLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button type="button" onClick={onCreateAccount} className="cta-primary w-full">
          Create account to generate workout
          <ArrowRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 font-medium text-white transition-colors hover:bg-white/10"
        >
          <Edit3 className="h-4 w-4" />
          Edit answers
        </button>
      </div>
    </div>
  );
}
