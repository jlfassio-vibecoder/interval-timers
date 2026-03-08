/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Visualization Lab templates: save/load form presets in localStorage.
 */

const TEMPLATES_KEY = 'vizlab-templates';

export interface VizLabTemplate {
  id: string;
  name: string;
  exerciseTopic: string;
  complexityLevel: string;
  visualStyle: string;
  /** Output: single image or 3-image sequence */
  outputMode?: 'single' | 'sequence';
  demographics: string;
  movementPhase: string;
  bodySide: string;
  /** For sequence mode: Start view left/right */
  bodySideStart?: string;
  /** For sequence mode: End view left/right */
  bodySideEnd?: string;
  /** Form cues to emphasize in generated image (optional, for backward compatibility) */
  formCuesToEmphasize?: string;
  /** Common misrenderings to avoid (optional, for backward compatibility) */
  misrenderingsToAvoid?: string;
  /** Domain/style context (optional, for backward compatibility) */
  domainContext?: string;
  referenceImageUrl: string;
  createdAt: number;
}

/** Input for saving a new template (all fields except id and createdAt) */
export type VizLabTemplateInput = Omit<VizLabTemplate, 'id' | 'createdAt'>;

function isValidVizLabTemplate(x: unknown): x is VizLabTemplate {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Partial<VizLabTemplate>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
    typeof obj.exerciseTopic !== 'string' ||
    typeof obj.complexityLevel !== 'string' ||
    typeof obj.visualStyle !== 'string' ||
    typeof obj.demographics !== 'string' ||
    typeof obj.movementPhase !== 'string' ||
    typeof obj.bodySide !== 'string' ||
    typeof obj.referenceImageUrl !== 'string' ||
    typeof obj.createdAt !== 'number'
  ) {
    return false;
  }
  if (
    ('formCuesToEmphasize' in obj && typeof obj.formCuesToEmphasize !== 'string') ||
    ('misrenderingsToAvoid' in obj && typeof obj.misrenderingsToAvoid !== 'string') ||
    ('domainContext' in obj && typeof obj.domainContext !== 'string') ||
    ('bodySideStart' in obj &&
      obj.bodySideStart != null &&
      typeof obj.bodySideStart !== 'string') ||
    ('bodySideEnd' in obj && obj.bodySideEnd != null && typeof obj.bodySideEnd !== 'string') ||
    ('outputMode' in obj &&
      obj.outputMode !== undefined &&
      obj.outputMode !== 'single' &&
      obj.outputMode !== 'sequence')
  ) {
    return false;
  }
  return true;
}

export function loadTemplates(): VizLabTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidVizLabTemplate);
  } catch {
    return [];
  }
}

export function saveTemplate(t: VizLabTemplateInput): VizLabTemplate {
  const template: VizLabTemplate = {
    ...t,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const list = loadTemplates();
  list.unshift(template);
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === 'QuotaExceededError'
        ? 'Storage full. Clear templates or browser data to save more.'
        : 'Failed to save template'
    );
  }
  return template;
}

export function deleteTemplate(id: string): void {
  const list = loadTemplates().filter((x) => x.id !== id);
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === 'QuotaExceededError'
        ? 'Storage error while deleting template.'
        : 'Failed to delete template'
    );
  }
}
