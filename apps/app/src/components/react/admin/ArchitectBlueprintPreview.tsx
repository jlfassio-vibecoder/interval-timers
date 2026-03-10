/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ArchitectBlueprintPreview - Display and edit ArchitectBlueprint (Step 1 output)
 * Used in optional two-phase flow before generating detailed workouts.
 */

import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Edit2, Check, X } from 'lucide-react';
import type { ArchitectBlueprint, ProgressionProtocol } from '@/types/ai-program';

interface ArchitectBlueprintPreviewProps {
  architect: ArchitectBlueprint;
  onUpdate: (updated: ArchitectBlueprint) => void;
  onGenerateWorkouts: () => void;
  onBack: () => void;
  loading: boolean;
}

const PROTOCOL_OPTIONS: ProgressionProtocol[] = [
  'linear_load',
  'double_progression',
  'density_leverage',
];

const ArchitectBlueprintPreview: React.FC<ArchitectBlueprintPreviewProps> = ({
  architect,
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

    const updated = { ...architect };

    if (editingField === 'program_name') {
      updated.program_name = editValue;
    } else if (editingField === 'rationale') {
      updated.rationale = editValue;
    } else if (editingField === 'split_type') {
      updated.split = { ...updated.split, type: editValue };
    } else if (editingField === 'days_per_week') {
      const days = parseInt(editValue, 10);
      if (!isNaN(days) && days >= 1 && days <= 7) {
        updated.split = { ...updated.split, days_per_week: days };
      }
    } else if (editingField === 'session_duration_minutes') {
      const duration = parseInt(editValue, 10);
      if (!isNaN(duration) && duration >= 10) {
        updated.split = { ...updated.split, session_duration_minutes: duration };
      }
    } else if (editingField === 'progression_protocol') {
      if (PROTOCOL_OPTIONS.includes(editValue as ProgressionProtocol)) {
        updated.progression_protocol = editValue as ProgressionProtocol;
      }
    } else if (editingField === 'progression_description') {
      updated.progression_rules = { ...updated.progression_rules, description: editValue };
    } else if (editingField === 'weeks_1_3') {
      updated.progression_rules = { ...updated.progression_rules, weeks_1_3: editValue };
    } else if (editingField === 'weeks_4_6') {
      updated.progression_rules = { ...updated.progression_rules, weeks_4_6: editValue };
    } else if (editingField.startsWith('landmark_muscle_')) {
      const idx = parseInt(editingField.replace('landmark_muscle_', ''), 10);
      if (!isNaN(idx) && idx >= 0 && idx < updated.volume_landmarks.length) {
        const landmarks = [...updated.volume_landmarks];
        landmarks[idx] = { ...landmarks[idx], muscle_group: editValue };
        updated.volume_landmarks = landmarks;
      }
    } else if (editingField.startsWith('landmark_mev_')) {
      const idx = parseInt(editingField.replace('landmark_mev_', ''), 10);
      if (!isNaN(idx) && idx >= 0 && idx < updated.volume_landmarks.length) {
        const val = parseInt(editValue, 10);
        if (!isNaN(val) && val >= 0) {
          const landmarks = [...updated.volume_landmarks];
          landmarks[idx] = { ...landmarks[idx], mev_sets: val };
          updated.volume_landmarks = landmarks;
        }
      }
    } else if (editingField.startsWith('landmark_mrv_')) {
      const idx = parseInt(editingField.replace('landmark_mrv_', ''), 10);
      if (!isNaN(idx) && idx >= 0 && idx < updated.volume_landmarks.length) {
        const val = parseInt(editValue, 10);
        if (!isNaN(val) && val >= 0) {
          const landmarks = [...updated.volume_landmarks];
          landmarks[idx] = { ...landmarks[idx], mrv_sets: val };
          updated.volume_landmarks = landmarks;
        }
      }
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Program Structure</h3>
        <span className="bg-orange-light/20 rounded-full px-3 py-1 text-xs text-orange-light">
          Review & Edit (2-Phase Flow)
        </span>
      </div>

      {/* Program Name & Rationale */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <EditableField
          field="program_name"
          value={architect.program_name}
          className="mb-2 text-xl font-bold text-white"
        />
        <EditableField
          field="rationale"
          value={architect.rationale}
          className="text-sm italic text-white/70"
        />
      </div>

      {/* Split */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          Split & Schedule
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Days/Week</div>
            <EditableField
              field="days_per_week"
              value={String(architect.split.days_per_week)}
              className="text-2xl font-bold text-orange-light"
            />
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Split Type</div>
            <EditableField
              field="split_type"
              value={architect.split.type}
              className="text-lg font-semibold text-white"
            />
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Session Duration</div>
            <EditableField
              field="session_duration_minutes"
              value={String(architect.split.session_duration_minutes)}
              className="text-2xl font-bold text-white"
            />
            <span className="text-xs text-white/50">min</span>
          </div>
        </div>
      </div>

      {/* Progression Protocol */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          Progression Protocol
        </h4>
        <div className="space-y-2">
          <EditableField
            field="progression_protocol"
            value={architect.progression_protocol}
            label="Protocol:"
            className="text-sm text-white"
          />
          <EditableField
            field="progression_description"
            value={architect.progression_rules.description}
            label="Description:"
            className="text-sm text-white/90"
          />
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Weeks 1-3 (Accumulation)</div>
            <EditableField
              field="weeks_1_3"
              value={architect.progression_rules.weeks_1_3}
              className="text-sm text-white"
            />
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-1 text-xs text-white/50">Weeks 4-6 (Intensification)</div>
            <EditableField
              field="weeks_4_6"
              value={architect.progression_rules.weeks_4_6}
              className="text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Volume Landmarks */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
          Volume Landmarks (MEV-MRV sets/week)
        </h4>
        <div className="space-y-2">
          {architect.volume_landmarks.map((v, idx) => (
            <div key={idx} className="flex items-center gap-4 rounded-lg bg-white/5 p-3">
              <EditableField
                field={`landmark_muscle_${idx}`}
                value={v.muscle_group}
                className="flex-1 text-sm font-medium text-orange-light"
              />
              <EditableField
                field={`landmark_mev_${idx}`}
                value={String(v.mev_sets)}
                className="w-16 text-sm text-white"
              />
              <span className="text-xs text-white/50">MEV</span>
              <EditableField
                field={`landmark_mrv_${idx}`}
                value={String(v.mrv_sets)}
                className="w-16 text-sm text-white"
              />
              <span className="text-xs text-white/50">MRV</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
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

      <p className="text-center text-xs text-white/40">
        Click any field to edit before generating workouts. The AI will follow this structure.
      </p>
    </div>
  );
};

export default ArchitectBlueprintPreview;
