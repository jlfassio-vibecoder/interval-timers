/**
 * Client-side Viz Lab templates: persist form presets to Supabase for team sharing.
 */

import { supabase } from '../client';
import type { VizLabTemplate, VizLabTemplateInput } from '@/lib/visualization-lab/templates';

interface VizLabTemplateRow {
  id: string;
  name: string;
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

function rowToTemplate(row: VizLabTemplateRow): VizLabTemplate {
  const config = row.config || {};
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  return {
    id: row.id,
    name: row.name,
    exerciseTopic: (config.exerciseTopic as string) ?? '',
    complexityLevel: (config.complexityLevel as string) ?? 'intermediate',
    visualStyle: (config.visualStyle as string) ?? 'photorealistic',
    outputMode: (config.outputMode as 'single' | 'sequence') ?? 'single',
    demographics: (config.demographics as string) ?? '',
    movementPhase: (config.movementPhase as string) ?? '',
    bodySide: (config.bodySide as string) ?? '',
    bodySideStart: config.bodySideStart as string | undefined,
    bodySideEnd: config.bodySideEnd as string | undefined,
    formCuesToEmphasize: config.formCuesToEmphasize as string | undefined,
    misrenderingsToAvoid: config.misrenderingsToAvoid as string | undefined,
    domainContext: config.domainContext as string | undefined,
    referenceImageUrl: (config.referenceImageUrl as string) ?? '',
    createdAt,
  };
}

function inputToConfig(input: VizLabTemplateInput): Record<string, unknown> {
  const config: Record<string, unknown> = {
    exerciseTopic: input.exerciseTopic,
    complexityLevel: input.complexityLevel,
    visualStyle: input.visualStyle,
    outputMode: input.outputMode ?? 'single',
    demographics: input.demographics ?? '',
    movementPhase: input.movementPhase ?? '',
    bodySide: input.bodySide ?? '',
    referenceImageUrl: input.referenceImageUrl ?? '',
  };
  if (input.bodySideStart != null) config.bodySideStart = input.bodySideStart;
  if (input.bodySideEnd != null) config.bodySideEnd = input.bodySideEnd;
  if (input.formCuesToEmphasize) config.formCuesToEmphasize = input.formCuesToEmphasize;
  if (input.misrenderingsToAvoid) config.misrenderingsToAvoid = input.misrenderingsToAvoid;
  if (input.domainContext) config.domainContext = input.domainContext;
  return config;
}

export async function listVizLabTemplates(): Promise<VizLabTemplate[]> {
  const { data, error } = await supabase
    .from('viz_lab_templates')
    .select('id, name, config, created_by, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToTemplate(row as VizLabTemplateRow));
}

export async function createVizLabTemplate(
  input: VizLabTemplateInput,
  userId: string
): Promise<VizLabTemplate> {
  const { data, error } = await supabase
    .from('viz_lab_templates')
    .insert({ name: input.name, config: inputToConfig(input), created_by: userId })
    .select('id, name, config, created_by, created_at')
    .single();
  if (error) throw error;
  return rowToTemplate(data as VizLabTemplateRow);
}

export async function deleteVizLabTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('viz_lab_templates').delete().eq('id', id);
  if (error) throw error;
}
