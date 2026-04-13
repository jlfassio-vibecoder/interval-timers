export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          updated_at: string | null;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          website: string | null;
          role: 'client' | 'host' | 'admin' | 'super_admin';
          date_of_birth?: string | null;
          biological_sex?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          activity_level_baseline?: string | null;
          lifestyle_baseline?: string | null;
          workout_routine?: string | null;
          total_active_multiplier?: number | null;
          primary_fitness_goal?: string | null;
          fitness_goal_ranking?: string[];
          preferred_hiit_style?: string | null;
          preferred_hiit_styles?: string[];
          injury_limitation_tags?: string[] | null;
          physical_limitations?: string[] | null;
          medical_conditions?: string[] | null;
          pregnancy_postpartum?: string[] | null;
          resting_hr_bpm?: number | null;
          max_hr_bpm?: number | null;
          units_system?: string | null;
          timezone?: string | null;
          social_privacy?: string | null;
          weekly_goal_minutes?: number | null;
          profile_completed_at?: string | null;
          trainer_bio?: string | null;
          host_tagline?: string | null;
          studio_id?: string | null;
        };
        Insert: {
          id: string;
          updated_at?: string | null;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          website?: string | null;
          role?: 'client' | 'host' | 'admin' | 'super_admin';
          studio_id?: string | null;
        };
        Update: {
          id?: string;
          updated_at?: string | null;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          website?: string | null;
          role?: 'client' | 'host' | 'admin' | 'super_admin';
          date_of_birth?: string | null;
          biological_sex?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          activity_level_baseline?: string | null;
          lifestyle_baseline?: string | null;
          workout_routine?: string | null;
          total_active_multiplier?: number | null;
          primary_fitness_goal?: string | null;
          fitness_goal_ranking?: string[];
          preferred_hiit_style?: string | null;
          preferred_hiit_styles?: string[];
          injury_limitation_tags?: string[] | null;
          physical_limitations?: string[] | null;
          medical_conditions?: string[] | null;
          pregnancy_postpartum?: string[] | null;
          resting_hr_bpm?: number | null;
          max_hr_bpm?: number | null;
          units_system?: string | null;
          timezone?: string | null;
          social_privacy?: string | null;
          weekly_goal_minutes?: number | null;
          profile_completed_at?: string | null;
          trainer_bio?: string | null;
          host_tagline?: string | null;
          studio_id?: string | null;
        };
        Relationships: [];
      };
      studios: {
        Row: {
          id: string;
          slug: string;
          display_name: string;
          logo_url: string | null;
          primary_color: string | null;
          welcome_tagline: string | null;
          welcome_content: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          display_name: string;
          logo_url?: string | null;
          primary_color?: string | null;
          welcome_tagline?: string | null;
          welcome_content?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          display_name?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          welcome_tagline?: string | null;
          welcome_content?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainers: {
        Row: {
          user_id: string;
          slug: string | null;
          display_name: string;
          logo_url: string | null;
          primary_color: string | null;
          welcome_tagline: string | null;
          welcome_content: Record<string, unknown>;
          studio_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          slug?: string | null;
          display_name: string;
          logo_url?: string | null;
          primary_color?: string | null;
          welcome_tagline?: string | null;
          welcome_content?: Record<string, unknown>;
          studio_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string | null;
          display_name?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          welcome_tagline?: string | null;
          welcome_content?: Record<string, unknown>;
          studio_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          trainer_id: string;
          title: string;
          description: string | null;
          tags: string[] | null;
          is_public: boolean;
          status: 'draft' | 'active' | 'archived';
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          created_at: string;
          program_id: string | null;
          trainer_id: string;
          title: string;
          description: string | null;
          duration_minutes: number | null;
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase JSONB column
          blocks: any;
          source: 'manual' | 'ai_factory';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chain JSONB
          ai_chain_metadata: any | null;
          visibility: 'draft' | 'ready' | 'assigned';
          lineage_id: string;
          version_index: number;
          supersedes_workout_id: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          created_at: string;
          trainer_id: string;
          client_id: string;
          program_id: string | null;
          workout_id: string | null;
          scheduled_date: string | null;
          status: 'assigned' | 'completed' | 'missed' | 'skipped';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase JSON column
          completion_data: any;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      client_training_preferences: {
        Row: {
          client_user_id: string;
          trainer_user_id: string;
          recommended_active_program_id: string | null;
          updated_at: string;
        };
        Insert: {
          client_user_id: string;
          trainer_user_id: string;
          recommended_active_program_id?: string | null;
          updated_at?: string;
        };
        Update: {
          recommended_active_program_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_coach_assignments: {
        Row: {
          id: string;
          trainer_user_id: string;
          client_user_id: string;
          assignment_type: 'program' | 'workout' | 'wod' | 'exercise' | 'challenge';
          resource_id: string | null;
          assigned_at: string;
          starts_on: string | null;
          expires_on: string | null;
          title_snapshot: string;
          exercise_slug: string | null;
          coach_note: string | null;
          due_on: string | null;
          dismissed_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_user_id: string;
          client_user_id: string;
          assignment_type: 'program' | 'workout' | 'wod' | 'exercise' | 'challenge';
          resource_id?: string | null;
          assigned_at?: string;
          starts_on?: string | null;
          expires_on?: string | null;
          title_snapshot?: string;
          exercise_slug?: string | null;
          coach_note?: string | null;
          due_on?: string | null;
          dismissed_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          dismissed_at?: string | null;
          revoked_at?: string | null;
          starts_on?: string | null;
          expires_on?: string | null;
          title_snapshot?: string;
          coach_note?: string | null;
          due_on?: string | null;
        };
        Relationships: [];
      };
      client_weekly_activity_boards: {
        Row: {
          id: string;
          trainer_user_id: string;
          client_user_id: string;
          week_start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_user_id: string;
          client_user_id: string;
          week_start_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          week_start_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_weekly_activity_cards: {
        Row: {
          id: string;
          board_id: string;
          scheduled_date: string;
          title: string;
          activity_type: string;
          duration_minutes: number | null;
          notes: string | null;
          status: string;
          source_assignment_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          scheduled_date: string;
          title: string;
          activity_type?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          status?: string;
          source_assignment_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scheduled_date?: string;
          title?: string;
          activity_type?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          status?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_coach_schedule_instances: {
        Row: {
          id: string;
          assignment_id: string;
          client_user_id: string;
          trainer_user_id: string;
          scheduled_at: string;
          trainer_live_session_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          client_user_id: string;
          trainer_user_id: string;
          scheduled_at: string;
          trainer_live_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          scheduled_at?: string;
          trainer_live_session_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainer_client_messages: {
        Row: {
          id: string;
          trainer_user_id: string;
          client_user_id: string;
          author_user_id: string;
          author_role: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_user_id: string;
          client_user_id: string;
          author_user_id: string;
          author_role: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trainer_live_session_series: {
        Row: {
          id: string;
          trainer_user_id: string;
          frequency: string;
          interval_weeks: number;
          weekday: number;
          iana_timezone: string;
          duration_minutes: number;
          local_start_time: string;
          status: string;
          expand_horizon_weeks: number;
          until_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_user_id: string;
          frequency?: string;
          interval_weeks?: number;
          weekday: number;
          iana_timezone: string;
          duration_minutes: number;
          local_start_time: string;
          status?: string;
          expand_horizon_weeks?: number;
          until_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          expand_horizon_weeks?: number;
          until_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainer_live_session_invites: {
        Row: {
          id: string;
          occurrence_id: string;
          invitee_user_id: string | null;
          status: 'pending' | 'accepted' | 'declined' | 'waitlisted' | 'expired' | 'cancelled';
          roster_invitation_id: string | null;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          occurrence_id: string;
          invitee_user_id?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'waitlisted' | 'expired' | 'cancelled';
          roster_invitation_id?: string | null;
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'declined' | 'waitlisted' | 'expired' | 'cancelled';
          invitee_user_id?: string | null;
          roster_invitation_id?: string | null;
          responded_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainer_live_room_invites: {
        Row: {
          id: string;
          trainer_live_session_id: string;
          invitee_user_id: string;
          invited_at: string;
        };
        Insert: {
          id?: string;
          trainer_live_session_id: string;
          invitee_user_id: string;
          invited_at?: string;
        };
        Update: {
          invited_at?: string;
        };
        Relationships: [];
      };
      trainer_live_session_occurrences: {
        Row: {
          id: string;
          trainer_user_id: string;
          series_id: string | null;
          scheduled_start_at: string;
          scheduled_end_at: string;
          status: 'scheduled' | 'cancelled' | 'completed';
          live_session_id: string | null;
          display_name: string | null;
          reminder_24h_sent_at: string | null;
          reminder_1h_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_user_id: string;
          series_id?: string | null;
          scheduled_start_at: string;
          scheduled_end_at: string;
          status?: 'scheduled' | 'cancelled' | 'completed';
          live_session_id?: string | null;
          display_name?: string | null;
          reminder_24h_sent_at?: string | null;
          reminder_1h_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          series_id?: string | null;
          scheduled_start_at?: string;
          scheduled_end_at?: string;
          status?: 'scheduled' | 'cancelled' | 'completed';
          live_session_id?: string | null;
          display_name?: string | null;
          reminder_24h_sent_at?: string | null;
          reminder_1h_sent_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string | null;
          workout_name: string;
          date: string;
          effort: number;
          rating: number;
          notes: string | null;
          duration_seconds: number | null;
          calories: number | null;
          rounds: number | null;
          source: string | null;
          handoff_dedupe_key: string | null;
          workout_type: string | null;
          workout_format: string | null;
          intensity: string | null;
          focus_area: string | null;
          is_active_rest: boolean | null;
          readiness_score: number | null;
          goal_snapshot: string[] | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_id?: string | null;
          workout_name: string;
          date: string;
          effort: number;
          rating: number;
          notes?: string | null;
          duration_seconds?: number | null;
          calories?: number | null;
          rounds?: number | null;
          source?: string | null;
          handoff_dedupe_key?: string | null;
          workout_type?: string | null;
          workout_format?: string | null;
          intensity?: string | null;
          focus_area?: string | null;
          is_active_rest?: boolean | null;
          readiness_score?: number | null;
          goal_snapshot?: string[] | null;
        };
        Update: {
          user_id?: string;
          workout_id?: string | null;
          workout_name?: string;
          date?: string;
          effort?: number;
          rating?: number;
          notes?: string | null;
          duration_seconds?: number | null;
          calories?: number | null;
          rounds?: number | null;
          source?: string | null;
          handoff_dedupe_key?: string | null;
          workout_type?: string | null;
          workout_format?: string | null;
          intensity?: string | null;
          focus_area?: string | null;
          is_active_rest?: boolean | null;
          readiness_score?: number | null;
          goal_snapshot?: string[] | null;
        };
        Relationships: [];
      };
      trainer_featured_live_workouts: {
        Row: {
          id: string;
          trainer_user_id: string;
          workout_id: string;
          context: 'trainer_live_amrap' | 'trainer_live_tabata';
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_user_id: string;
          workout_id: string;
          context: 'trainer_live_amrap' | 'trainer_live_tabata';
          sort_order: number;
          created_at?: string;
        };
        Update: {
          workout_id?: string;
          context?: 'trainer_live_amrap' | 'trainer_live_tabata';
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_mission_control_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_trainer_profile_for_client: {
        Args: { p_program_id: string };
        Returns: Record<string, unknown> | null;
      };
      trainer_live_schedule_invite_accept: {
        Args: { p_invite_id: string };
        Returns: Record<string, unknown>;
      };
      trainer_live_schedule_invite_decline: {
        Args: { p_invite_id: string };
        Returns: Record<string, unknown>;
      };
      update_featured_workouts: {
        Args: {
          p_trainer_id: string;
          p_context: string;
          p_workout_ids: string[];
        };
        Returns: undefined;
      };
      get_live_session_summary: {
        Args: { p_session_id: string };
        Returns: Record<string, unknown>;
      };
      trainer_live_invite_clients_to_session: {
        Args: { p_session_id: string; p_client_user_ids: string[] };
        Returns: Record<string, unknown>;
      };
      trainer_live_client_pending_invites: {
        Args: Record<PropertyKey, never>;
        Returns: {
          session_id: string;
          trainer_display_name: string;
        }[];
      };
    };
  };
}
