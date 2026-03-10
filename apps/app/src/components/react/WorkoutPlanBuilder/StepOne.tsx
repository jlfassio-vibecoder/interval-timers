import { Check } from 'lucide-react';
import type { FitnessGoal, FitnessLevel, EquipmentAccess } from '@/types/onboarding';
import {
  fitnessGoalOptions,
  fitnessLevelOptions,
  equipmentAccessOptions,
} from '@/data/onboarding-options';

interface StepOneProps {
  fitnessGoals: FitnessGoal[];
  fitnessLevel: FitnessLevel;
  equipmentAccess: EquipmentAccess;
  errors: Record<string, string>;
  onGoalsChange: (goals: FitnessGoal[]) => void;
  onLevelChange: (level: FitnessLevel) => void;
  onEquipmentChange: (equipment: EquipmentAccess) => void;
  onContinue: () => void;
}

const inputBase =
  'min-h-[48px] w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white focus:border-orange-light focus:outline-none focus:ring-2 focus:ring-orange-light/20';
const chipBase =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all';
const chipDefault =
  'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10';
const chipSelected = 'border-orange-light bg-orange-light/15 text-orange-light';

export function StepOne({
  fitnessGoals,
  fitnessLevel,
  equipmentAccess,
  errors,
  onGoalsChange,
  onLevelChange,
  onEquipmentChange,
  onContinue,
}: StepOneProps) {
  const toggleGoal = (goal: FitnessGoal) => {
    if (fitnessGoals.includes(goal)) {
      onGoalsChange(fitnessGoals.filter((g) => g !== goal));
    } else {
      onGoalsChange([...fitnessGoals, goal]);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="mb-1 block text-base font-medium text-white">
          What are your fitness goals? <span className="text-orange-light">*</span>
        </label>
        <p className="mb-2 text-sm text-white/60">Select all that apply</p>
        <div className="flex flex-wrap gap-2">
          {fitnessGoalOptions.map((option) => {
            const isSelected = fitnessGoals.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`${chipBase} ${isSelected ? chipSelected : chipDefault}`}
                onClick={() => toggleGoal(option.value)}
                aria-pressed={isSelected}
              >
                {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        {errors.fitness_goals && (
          <p className="mt-1 text-sm text-red-500">{errors.fitness_goals}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="builder-fitness-level"
          className="mb-1 block text-base font-medium text-white"
        >
          What&apos;s your current fitness level? <span className="text-orange-light">*</span>
        </label>
        <select
          id="builder-fitness-level"
          className={inputBase}
          value={fitnessLevel}
          onChange={(e) => onLevelChange(e.target.value as FitnessLevel)}
        >
          {fitnessLevelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.fitness_level && (
          <p className="mt-1 text-sm text-red-500">{errors.fitness_level}</p>
        )}
      </div>

      <div>
        <label htmlFor="builder-equipment" className="mb-1 block text-base font-medium text-white">
          What equipment do you have access to? <span className="text-orange-light">*</span>
        </label>
        <select
          id="builder-equipment"
          className={inputBase}
          value={equipmentAccess}
          onChange={(e) => onEquipmentChange(e.target.value as EquipmentAccess)}
        >
          {equipmentAccessOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.equipment_access && (
          <p className="mt-1 text-sm text-red-500">{errors.equipment_access}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onContinue}
          className="hover:bg-orange-light/90 min-w-[140px] rounded-xl bg-orange-light px-6 py-3 font-semibold text-bg-dark transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
