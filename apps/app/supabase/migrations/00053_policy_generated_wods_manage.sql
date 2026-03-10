CREATE POLICY "Authenticated can manage own generated_wods" ON public.generated_wods FOR ALL USING (auth.uid() = author_id);
