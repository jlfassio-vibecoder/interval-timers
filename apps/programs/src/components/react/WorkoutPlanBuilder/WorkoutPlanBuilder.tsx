import { useState, useCallback, useEffect } from 'react';
import { CreditCard, Lock, RefreshCw } from 'lucide-react';
import type {
  WebsiteOnboardingData,
  FitnessGoal,
  FitnessLevel,
  ActivityLevel,
  EquipmentAccess,
  Gender,
  PreferredUnits,
} from '@/types/onboarding';
import { DEFAULT_ONBOARDING_DATA } from '@/types/onboarding';
import {
  parseOnboardingFromSearchParams,
  onboardingToSearchParams,
  equipmentAccessToArray,
} from '@/lib/urlOnboarding';
import { buildSignupUrl } from '@/lib/buildSignupUrl';
import { IntroScreen } from './IntroScreen';
import { StepOne } from './StepOne';
import { StepTwo } from './StepTwo';
import { PlanPreview } from './PlanPreview';

type FormErrors = Record<string, string>;

export interface WorkoutPlanBuilderProps {
  skipIntro?: boolean;
}

function mergeWithDefaults(partial: Partial<WebsiteOnboardingData>): WebsiteOnboardingData {
  const base = { ...DEFAULT_ONBOARDING_DATA };
  if (partial.fitness_level) base.fitness_level = partial.fitness_level;
  if (partial.current_activity_level) base.current_activity_level = partial.current_activity_level;
  if (partial.fitness_goals?.length) base.fitness_goals = partial.fitness_goals;
  if (partial.equipment_access?.length) base.equipment_access = partial.equipment_access;
  if (partial.preferred_units)
    base.preferred_units = { ...base.preferred_units, ...partial.preferred_units };
  if (partial.gender !== undefined) base.gender = partial.gender;
  if (partial.age !== undefined && partial.age !== null) base.age = partial.age;
  return base;
}

export function WorkoutPlanBuilder({ skipIntro = false }: WorkoutPlanBuilderProps = {}) {
  const [showIntro, setShowIntro] = useState(() => !skipIntro);
  // Always start with defaults so server and client match (avoids hydration mismatch)
  const [formData, setFormData] = useState<WebsiteOnboardingData>(DEFAULT_ONBOARDING_DATA);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const pushStateFromForm = useCallback((data: WebsiteOnboardingData) => {
    if (typeof window === 'undefined') return;
    const params = onboardingToSearchParams(data);
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, '', url.toString());
  }, []);

  // After mount, sync form from URL (client-only) so server and first client paint match
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const partial = parseOnboardingFromSearchParams(params);
    if (Object.keys(partial).length > 0) {
      setFormData(mergeWithDefaults(partial));
    }
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const partial = parseOnboardingFromSearchParams(params);
      if (Object.keys(partial).length > 0) {
        setFormData(mergeWithDefaults(partial));
      }
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const updateFormAndUrl = useCallback(
    (updater: (prev: WebsiteOnboardingData) => WebsiteOnboardingData) => {
      setFormData((prev) => {
        const next = updater(prev);
        pushStateFromForm(next);
        return next;
      });
    },
    [pushStateFromForm]
  );

  const validateStepOne = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (formData.fitness_goals.length === 0)
      newErrors.fitness_goals = 'Please select at least one fitness goal';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.fitness_goals]);

  const validateStepTwo = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (formData.age !== undefined) {
      if (!Number.isInteger(formData.age) || formData.age < 13 || formData.age > 120) {
        newErrors.age = 'Age must be between 13 and 120';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.age]);

  const handleGoalsChange = useCallback(
    (goals: FitnessGoal[]) => updateFormAndUrl((prev) => ({ ...prev, fitness_goals: goals })),
    [updateFormAndUrl]
  );
  const handleLevelChange = useCallback(
    (level: FitnessLevel) => updateFormAndUrl((prev) => ({ ...prev, fitness_level: level })),
    [updateFormAndUrl]
  );
  const handleEquipmentChange = useCallback(
    (equipment: EquipmentAccess) =>
      updateFormAndUrl((prev) => ({
        ...prev,
        equipment_access: equipmentAccessToArray(equipment),
      })),
    [updateFormAndUrl]
  );
  const handleContinue = useCallback(() => {
    if (validateStepOne()) setCurrentStep(2);
  }, [validateStepOne]);

  const handleActivityChange = useCallback(
    (level: ActivityLevel) =>
      updateFormAndUrl((prev) => ({ ...prev, current_activity_level: level })),
    [updateFormAndUrl]
  );
  const handleGenderChange = useCallback(
    (gender: Gender | undefined) => updateFormAndUrl((prev) => ({ ...prev, gender })),
    [updateFormAndUrl]
  );
  const handleAgeChange = useCallback(
    (age: number | undefined) => updateFormAndUrl((prev) => ({ ...prev, age })),
    [updateFormAndUrl]
  );
  const handleUnitsChange = useCallback(
    (units: Partial<PreferredUnits>) =>
      updateFormAndUrl((prev) => ({
        ...prev,
        preferred_units: { ...prev.preferred_units, ...units },
      })),
    [updateFormAndUrl]
  );
  const handleBack = useCallback(() => {
    setCurrentStep(1);
    setErrors({});
  }, []);
  const handleSubmit = useCallback(() => {
    if (validateStepTwo()) setShowPreview(true);
  }, [validateStepTwo]);
  const handleEdit = useCallback(() => {
    setShowPreview(false);
    setCurrentStep(1);
  }, []);

  const handleCreateAccount = useCallback(() => {
    const signupUrl = buildSignupUrl(formData);
    window.location.href = signupUrl;
  }, [formData]);

  const equipmentAccess: EquipmentAccess =
    formData.equipment_access.includes('cardio') && formData.equipment_access.length >= 4
      ? 'full_gym'
      : formData.equipment_access.includes('functional') && formData.equipment_access.length >= 3
        ? 'home'
        : formData.equipment_access.length >= 2
          ? 'minimal'
          : 'none';

  return (
    <section id="workout-builder" className="relative py-16 md:py-24">
      <div className="relative z-10 mx-auto max-w-[720px] px-4 md:px-6">
        {showIntro ? (
          <IntroScreen onComplete={() => setShowIntro(false)} />
        ) : (
          <>
            <div className="mb-12 text-center">
              <span className="text-sm font-bold uppercase tracking-wider text-orange-light">
                Workout Plan Builder
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-white md:text-4xl">
                Build your AI workout plan{' '}
                <span className="bg-gradient-to-r from-orange-light to-orange-medium bg-clip-text text-transparent">
                  in 2 minutes
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-[560px] text-lg text-white/80">
                Choose your goal, fitness level, activity, and equipment. Then create your account
                to generate and save your personalized workout.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl md:p-8">
              {!showPreview && (
                <div className="mb-6">
                  <span className="mb-1 block text-sm text-white/60">Step {currentStep} of 2</span>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-light to-orange-medium transition-all duration-300"
                      style={{ width: currentStep === 1 ? '50%' : '100%' }}
                    />
                  </div>
                </div>
              )}

              {showPreview ? (
                <PlanPreview
                  data={formData}
                  onEdit={handleEdit}
                  onCreateAccount={handleCreateAccount}
                />
              ) : currentStep === 1 ? (
                <StepOne
                  fitnessGoals={formData.fitness_goals}
                  fitnessLevel={formData.fitness_level}
                  equipmentAccess={equipmentAccess}
                  errors={errors}
                  onGoalsChange={handleGoalsChange}
                  onLevelChange={handleLevelChange}
                  onEquipmentChange={handleEquipmentChange}
                  onContinue={handleContinue}
                />
              ) : (
                <StepTwo
                  activityLevel={formData.current_activity_level}
                  gender={formData.gender}
                  age={formData.age}
                  preferredUnits={formData.preferred_units}
                  errors={errors}
                  onActivityChange={handleActivityChange}
                  onGenderChange={handleGenderChange}
                  onAgeChange={handleAgeChange}
                  onUnitsChange={handleUnitsChange}
                  onBack={handleBack}
                  onSubmit={handleSubmit}
                />
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-white/60 md:gap-6">
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-orange-light" />
                No credit card required
              </span>
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4 text-orange-light" />
                We don&apos;t store answers until you create an account
              </span>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-orange-light" />
                Edit anytime
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
