import type { ChangeEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ActivityLevel, Gender, PreferredUnits } from '@/types/onboarding';
import {
  activityLevelOptions,
  genderOptions,
  weightUnitOptions,
  heightUnitOptions,
} from '@/data/onboarding-options';

interface StepTwoProps {
  activityLevel: ActivityLevel;
  gender?: Gender;
  age?: number;
  preferredUnits: PreferredUnits;
  errors: Record<string, string>;
  onActivityChange: (level: ActivityLevel) => void;
  onGenderChange: (gender: Gender | undefined) => void;
  onAgeChange: (age: number | undefined) => void;
  onUnitsChange: (units: Partial<PreferredUnits>) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const inputBase =
  'min-h-[48px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white focus:border-orange-light focus:outline-none focus:ring-2 focus:ring-orange-light/20';

export function StepTwo({
  activityLevel,
  gender,
  age,
  preferredUnits,
  errors,
  onActivityChange,
  onGenderChange,
  onAgeChange,
  onUnitsChange,
  onBack,
  onSubmit,
}: StepTwoProps) {
  const handleAgeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onAgeChange(undefined);
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) onAgeChange(parsed);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="builder-activity" className="mb-1 block text-base font-medium text-white">
          How active are you currently? <span className="text-orange-light">*</span>
        </label>
        <select
          id="builder-activity"
          className={inputBase}
          value={activityLevel}
          onChange={(e) => onActivityChange(e.target.value as ActivityLevel)}
        >
          {activityLevelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.activity_level && (
          <p className="mt-1 text-sm text-red-500">{errors.activity_level}</p>
        )}
      </div>

      <div>
        <label htmlFor="builder-gender" className="mb-1 block text-base font-medium text-white">
          Gender <span className="text-sm font-normal text-white/50">(optional)</span>
        </label>
        <select
          id="builder-gender"
          className={inputBase}
          value={gender ?? 'prefer_not_to_say'}
          onChange={(e) => onGenderChange(e.target.value as Gender)}
        >
          {genderOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="builder-age" className="mb-1 block text-base font-medium text-white">
          Age <span className="text-sm font-normal text-white/50">(optional)</span>
        </label>
        <input
          id="builder-age"
          type="number"
          className={inputBase}
          value={age ?? ''}
          onChange={handleAgeChange}
          min={13}
          max={120}
          placeholder="Enter your age"
        />
        {errors.age && <p className="mt-1 text-sm text-red-500">{errors.age}</p>}
      </div>

      <div>
        <label className="mb-2 block text-base font-medium text-white">Preferred units</label>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="min-w-[52px] text-sm text-white/70">Weight:</span>
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              {weightUnitOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`min-h-[36px] min-w-[44px] px-3 py-2 text-sm font-medium transition-colors ${
                    preferredUnits.weight === opt.value
                      ? 'bg-orange-light/20 text-orange-light'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={() => onUnitsChange({ weight: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-[52px] text-sm text-white/70">Height:</span>
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              {heightUnitOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`min-h-[36px] min-w-[44px] px-3 py-2 text-sm font-medium transition-colors ${
                    preferredUnits.height === opt.value
                      ? 'bg-orange-light/20 text-orange-light'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={() => onUnitsChange({ height: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="hover:bg-orange-light/90 min-w-[140px] rounded-xl bg-orange-light px-6 py-3 font-semibold text-bg-dark transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
