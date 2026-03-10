CREATE POLICY "Anyone can read public programs" ON public.programs FOR SELECT USING (is_public = true);
