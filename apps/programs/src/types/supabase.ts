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
          role: 'trainer' | 'client' | 'admin';
        };
        Insert: {
          id: string;
          updated_at?: string | null;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          website?: string | null;
          role?: 'trainer' | 'client' | 'admin';
        };
        Update: {
          id?: string;
          updated_at?: string | null;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          website?: string | null;
          role?: 'trainer' | 'client' | 'admin';
        };
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
      };
    };
  };
}
