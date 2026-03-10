CREATE POLICY "Authors can manage own challenges" ON public.challenges FOR ALL USING (auth.uid() = author_id);
