import { supabase } from '../client';

/** Shape of a program row from Supabase (select *). */
interface ProgramRow {
  id: string;
  title: string;
  description: string | null;
  difficulty?: string | null;
  duration_weeks?: number | null;
  created_at: string;
  updated_at: string;
  tags?: string[] | null;
  status: string;
  is_public: boolean;
  trainer_id: string;
  config?: unknown;
  chain_metadata?: unknown;
}

/** UI type for program library table and editors. */
export interface ProgramLibraryItem {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  durationWeeks: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status: string;
  isPublic: boolean;
  trainerId: string;
}

const mapProgram = (row: ProgramRow): ProgramLibraryItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  difficulty: row.difficulty || 'intermediate',
  durationWeeks: row.duration_weeks ?? 4,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  tags: row.tags ?? [],
  status: row.is_public ? 'active' : 'draft',
  isPublic: row.is_public,
  trainerId: row.trainer_id,
});

export const fetchPrograms = async (trainerId: string) => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapProgram);
};

export const fetchProgram = async (programId: string) => {
  const { data, error } = await supabase.from('programs').select('*').eq('id', programId).single();

  if (error) throw error;
  return mapProgram(data);
};

export const updateProgram = async (
  id: string,
  updates: Partial<
    Pick<
      ProgramLibraryItem,
      'title' | 'description' | 'difficulty' | 'durationWeeks' | 'tags' | 'status'
    >
  >
) => {
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
  if (updates.durationWeeks !== undefined) payload.duration_weeks = updates.durationWeeks;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.status !== undefined) payload.status = updates.status;

  const { error } = await supabase.from('programs').update(payload).eq('id', id);

  if (error) throw error;
};

export const createProgram = async (program: { title: string; trainer_id: string }) => {
  const { data, error } = await supabase
    .from('programs')
    .insert([
      {
        title: program.title,
        trainer_id: program.trainer_id,
        status: 'draft',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return mapProgram(data);
};

export const deleteProgram = async (id: string) => {
  const { error } = await supabase.from('programs').delete().eq('id', id);

  if (error) throw error;
};
