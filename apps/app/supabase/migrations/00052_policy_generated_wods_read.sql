CREATE POLICY "Authenticated can read generated_wods" ON public.generated_wods FOR SELECT USING (auth.uid() IS NOT NULL);
