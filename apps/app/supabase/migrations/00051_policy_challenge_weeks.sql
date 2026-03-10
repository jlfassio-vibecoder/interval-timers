CREATE POLICY "Authors can manage challenge_weeks" ON public.challenge_weeks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.author_id = auth.uid())
);
