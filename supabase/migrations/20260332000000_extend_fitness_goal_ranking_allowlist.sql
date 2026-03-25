-- Extend fitness_goal_ranking allowlist to 10 canonical goal ids (app + alignment scorer).

COMMENT ON COLUMN public.profiles.fitness_goal_ranking IS
  'Ordered fitness goal ids (max 3): first element = priority 1. Allowlist: fat_loss, cardiovascular_endurance, muscle_hypertrophy, longevity, athletic_performance, functional_strength, mobility_flexibility, stress_management, weight_maintenance, power_speed.';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_fitness_goal_ranking_allowlist;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_fitness_goal_ranking_allowlist
  CHECK (
    fitness_goal_ranking <@ ARRAY[
      'fat_loss',
      'cardiovascular_endurance',
      'muscle_hypertrophy',
      'longevity',
      'athletic_performance',
      'functional_strength',
      'mobility_flexibility',
      'stress_management',
      'weight_maintenance',
      'power_speed'
    ]::text[]
  );
