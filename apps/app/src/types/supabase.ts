export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          updated_at: string | null;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          website: string | null;
          role: 'client' | 'host' | 'trainer' | 'admin' | 'super_admin';
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
          role?: 'client' | 'host' | 'trainer' | 'admin' | 'super_admin';
          studio_id?: string | null;
        };
        Update: {
          id?: string;
          updated_at?: string | null;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          website?: string | null;
          role?: 'client' | 'host' | 'trainer' | 'admin' | 'super_admin';
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          display_name?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          welcome_tagline?: string | null;
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
    };
  };
}
