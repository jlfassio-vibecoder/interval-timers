/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared meta form: title, description, difficulty, optional durationWeeks.
 * Slot for entity-specific fields via children.
 */

import React from 'react';
import { Save } from 'lucide-react';

export interface EditorMetaFormData {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks?: number;
}

export interface EditorMetaFormProps {
  formData: EditorMetaFormData;
  onChange: (data: EditorMetaFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving?: boolean;
  sectionTitle?: string;
  children?: React.ReactNode;
}

const EditorMetaForm: React.FC<EditorMetaFormProps> = ({
  formData,
  onChange,
  onSubmit,
  saving = false,
  sectionTitle = 'Program Information',
  children,
}) => {
  const hasDuration = formData.durationWeeks !== undefined;

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
      <h2 className="mb-6 font-heading text-xl font-bold">{sectionTitle}</h2>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => onChange({ ...formData, title: e.target.value })}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
            placeholder="Program title"
            required
            disabled={saving}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            rows={4}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
            placeholder="Program description"
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">Difficulty *</label>
            <select
              value={formData.difficulty}
              onChange={(e) =>
                onChange({
                  ...formData,
                  difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced',
                })
              }
              className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
              required
              disabled={saving}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {hasDuration && (
            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                Duration (Weeks) *
              </label>
              <input
                type="number"
                min={0}
                value={formData.durationWeeks ?? 0}
                onChange={(e) =>
                  onChange({ ...formData, durationWeeks: parseInt(e.target.value, 10) || 0 })
                }
                className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                placeholder="0"
                required
                disabled={saving}
              />
            </div>
          )}
        </div>

        {children}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditorMetaForm;
