CREATE POLICY "Trainers can manage own programs" ON public.programs FOR ALL USING (auth.uid() = trainer_id);
