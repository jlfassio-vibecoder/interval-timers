-- P4: Weekly activity Kanban (trainer–client, program roster scope in APIs).

CREATE TABLE IF NOT EXISTS public.client_weekly_activity_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_weekly_activity_boards_week_unique UNIQUE (trainer_user_id, client_user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS client_weekly_activity_boards_client_idx
  ON public.client_weekly_activity_boards (client_user_id);

COMMENT ON TABLE public.client_weekly_activity_boards IS
  'P4 Performance Lab: one board per trainer–client–week (week_start_date = Monday). Mutations via service-role APIs.';

CREATE TABLE IF NOT EXISTS public.client_weekly_activity_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.client_weekly_activity_boards (id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  activity_type text NOT NULL DEFAULT 'activity',
  duration_minutes int CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  notes text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'skipped')),
  source_assignment_id uuid,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_weekly_activity_cards_board_idx
  ON public.client_weekly_activity_cards (board_id, scheduled_date, sort_order);

COMMENT ON TABLE public.client_weekly_activity_cards IS
  'P4: Activity card on a weekly board; scheduled_date must fall in the board week (enforced in app).';

ALTER TABLE public.client_weekly_activity_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_weekly_activity_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cwa_boards_select_as_client" ON public.client_weekly_activity_boards;
DROP POLICY IF EXISTS "cwa_boards_select_as_trainer_mc" ON public.client_weekly_activity_boards;

CREATE POLICY "cwa_boards_select_as_client"
  ON public.client_weekly_activity_boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

CREATE POLICY "cwa_boards_select_as_trainer_mc"
  ON public.client_weekly_activity_boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_user_id AND public.is_mission_control_staff());

DROP POLICY IF EXISTS "cwa_cards_select_as_client" ON public.client_weekly_activity_cards;
DROP POLICY IF EXISTS "cwa_cards_select_as_trainer_mc" ON public.client_weekly_activity_cards;

CREATE POLICY "cwa_cards_select_as_client"
  ON public.client_weekly_activity_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_weekly_activity_boards b
      WHERE b.id = board_id
        AND b.client_user_id = auth.uid()
    )
  );

CREATE POLICY "cwa_cards_select_as_trainer_mc"
  ON public.client_weekly_activity_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_weekly_activity_boards b
      WHERE b.id = board_id
        AND b.trainer_user_id = auth.uid()
        AND public.is_mission_control_staff()
    )
  );
