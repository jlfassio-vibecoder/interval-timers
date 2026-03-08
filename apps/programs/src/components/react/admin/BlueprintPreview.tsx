/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BlueprintPreview component for displaying and editing the program blueprint
 * before generating detailed workouts (Phase 1 → Phase 2 transition).
 */

import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Edit2, Check, X } from 'lucide-react';
import type { ProgramBlueprint } from '@/types/ai-program';

interface BlueprintPreviewProps {
  blueprint: ProgramBlueprint;
  onUpdate: (updated: ProgramBlueprint) => void;
  onGenerateWorkouts: () => void;
  onBack: () => void;
  loading: boolean;
}

const BlueprintPreview: React.FC<BlueprintPreviewProps> = ({
  blueprint,
  onUpdate,
  onGenerateWorkouts,
  onBack,
  loading,
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (!editingField) return;

    const updated = { ...blueprint };

    if (editingField === 'program_name') {
      updated.program_name = editValue;
    } else if (editingField === 'rationale') {
      updated.rationale = editValue;
    } else if (editingField === 'split_type') {
      updated.structure = { ...updated.structure, split_type: editValue };
    } else if (editingField === 'days_per_week') {
      const days = parseInt(editValue, 10);
      if (!isNaN(days) && days >= 1 && days <= 7) {
        updated.structure = { ...updated.structure, days_per_week: days };
      }
    } else if (editingField === 'session_duration_minutes') {
      const duration = parseInt(editValue, 10);
      if (!isNaN(duration) && duration >= 10) {
        updated.structure = { ...updated.structure, session_duration_minutes: duration };
      }
    } else if (editingField.startsWith('phase_')) {
      const phaseKey = editingField.replace('phase_', '');
      updated.periodization_strategy = {
        ...updated.periodization_strategy,
        [phaseKey]: editValue,
      };
    } else if (editingField.startsWith('day_')) {
      const dayKey = editingField.replace('day_', '');
      updated.weekly_schedule_skeleton = {
        ...updated.weekly_schedule_skeleton,
        [dayKey]: editValue,
      };
    }

    onUpdate(updated);
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const EditableField: React.FC<{
    field: string;
    value: string;
    label?: string;
    className?: string;
  }> = ({ field, value, label, className = '' }) => {
    const isEditing = editingField === field;

    if (isEditing) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          {label && <span className="text-sm text-white/60">{label}</span>}
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="flex-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white focus:border-orange-light focus:outline-none"
            autoFocus
          />
          <button onClick={saveEdit} className="rounded p-1 text-green-400 hover:bg-green-400/20">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={cancelEdit} className="rounded p-1 text-red-400 hover:bg-red-400/20">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5 ${className}`}
        onClick={() => startEditing(field, value)}
      >
        {label && <span className="text-sm text-white/60">{label}</span>}
        <span className="flex-1">{value}</span>
        <Edit2 className="h-3 w-3 text-white/30 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Program Blueprint</h3>
        <span className="bg-orange-light/20 rounded-full px-3 py-1 text-xs text-orange-light">
          Phase 1 - Review &amp; Edit
        </span>
      </div>

      {/* Program Name & Rationale */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <EditableField
          field="program_name"
          value={blueprint.program_name}
          className="mb-2 text-xl font-bold text-white"
        />
        <EditableField
          field="rationale"
          value={blueprint.rationale}
          className="text-sm italic text-white/70"
        />
      </div>

      {/* Structure Summary */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          Program Structure
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Days/Week</div>
            <EditableField
              field="days_per_week"
              value={String(blueprint.structure.days_per_week)}
              className="text-2xl font-bold text-orange-light"
            />
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Split Type</div>
            <EditableField
              field="split_type"
              value={blueprint.structure.split_type}
              className="text-lg font-semibold text-white"
            />
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Session Duration</div>
            <EditableField
              field="session_duration_minutes"
              value={String(blueprint.structure.session_duration_minutes)}
              className="text-2xl font-bold text-white"
            />
            <span className="text-xs text-white/50">min</span>
          </div>
        </div>
      </div>

      {/* Periodization Strategy */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          Periodization Strategy
        </h4>
        <div className="space-y-2">
          {Object.entries(blueprint.periodization_strategy).map(([phase, focus]) => (
            <div key={phase} className="flex items-center gap-4 rounded-lg bg-white/5 p-3">
              <span className="w-24 shrink-0 text-sm font-medium text-orange-light">
                {phase.replace(/_/g, ' ')}
              </span>
              <EditableField
                field={`phase_${phase}`}
                value={focus}
                className="flex-1 text-sm text-white"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Schedule Skeleton */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          Weekly Schedule Skeleton
        </h4>
        <div className="grid gap-2">
          {Object.entries(blueprint.weekly_schedule_skeleton).map(([day, focus]) => {
            const isRest = focus.toLowerCase().includes('rest');
            return (
              <div
                key={day}
                className={`flex items-center gap-4 rounded-lg p-3 ${
                  isRest ? 'bg-white/5' : 'bg-orange-light/10'
                }`}
              >
                <span
                  className={`w-16 shrink-0 text-sm font-medium ${
                    isRest ? 'text-white/50' : 'text-orange-light'
                  }`}
                >
                  {day.replace(/_/g, ' ')}
                </span>
                <EditableField
                  field={`day_${day}`}
                  value={focus}
                  className={`flex-1 text-sm ${isRest ? 'text-white/50' : 'text-white'}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between gap-4 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-6 py-2 text-white transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Config</span>
        </button>
        <button
          type="button"
          onClick={onGenerateWorkouts}
          disabled={loading}
          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors disabled:opacity-50"
        >
          <Sparkles className={`h-5 w-5 ${loading ? 'animate-pulse' : ''}`} />
          <span>{loading ? 'Generating Workouts...' : 'Generate Detailed Workouts'}</span>
        </button>
      </div>

      {/* Tip */}
      <p className="text-center text-xs text-white/40">
        Click any field to edit it before generating workouts. The AI will follow this structure.
      </p>
    </div>
  );
};

export default BlueprintPreview;
