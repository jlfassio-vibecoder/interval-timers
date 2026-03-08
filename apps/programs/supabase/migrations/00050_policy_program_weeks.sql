CREATE POLICY "Trainers can manage program_weeks" ON public.program_weeks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.trainer_id = auth.uid())
);
