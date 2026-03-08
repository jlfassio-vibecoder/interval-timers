/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChainDebugPanel - Collapsible panel showing intermediate chain outputs
 * Used for debugging and understanding the 4-step generation process.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Layers, GitBranch, Dumbbell, Calculator } from 'lucide-react';
import type { PromptChainMetadata } from '@/types/ai-program';

interface ChainDebugPanelProps {
  metadata: PromptChainMetadata;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  stepNumber: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  stepNumber,
  children,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        <span className="bg-orange-light/20 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-orange-light">
          {stepNumber}
        </span>
        {icon}
        <span className="flex-1 font-medium text-white">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-white/50" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/50" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const ChainDebugPanel: React.FC<ChainDebugPanelProps> = ({ metadata }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { step1_architect, step2_biomechanist, step3_coach, generated_at, model_used } = metadata;

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-black/20">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/5"
      >
        <Layers className="h-5 w-5 text-orange-light" />
        <span className="flex-1 font-medium text-white">Chain Debug Details</span>
        <span className="text-xs text-white/50">
          {model_used} • {new Date(generated_at).toLocaleString()}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-white/50" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/50" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-white/10">
          {/* Step 1: Architect */}
          <CollapsibleSection
            title="Architect Blueprint"
            icon={<GitBranch className="h-4 w-4 text-blue-400" />}
            stepNumber={1}
            defaultOpen
          >
            <div className="space-y-3 text-sm">
              <div className="rounded bg-white/5 p-3">
                <div className="mb-1 text-xs uppercase text-white/50">Program</div>
                <div className="font-medium text-white">{step1_architect.program_name}</div>
                <div className="mt-1 text-white/70">{step1_architect.rationale}</div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded bg-white/5 p-3">
                  <div className="text-xs uppercase text-white/50">Split</div>
                  <div className="font-medium text-orange-light">{step1_architect.split.type}</div>
                  <div className="text-white/70">
                    {step1_architect.split.days_per_week} days/week
                  </div>
                </div>
                <div className="rounded bg-white/5 p-3">
                  <div className="text-xs uppercase text-white/50">Protocol</div>
                  <div className="font-medium text-orange-light">
                    {step1_architect.progression_protocol.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="rounded bg-white/5 p-3">
                  <div className="text-xs uppercase text-white/50">Duration</div>
                  <div className="font-medium text-white">
                    ~{step1_architect.split.session_duration_minutes} min
                  </div>
                </div>
              </div>

              <div className="rounded bg-white/5 p-3">
                <div className="mb-2 text-xs uppercase text-white/50">Progression Rules</div>
                <div className="text-white/80">{step1_architect.progression_rules.description}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/50">Weeks 1-3:</span>{' '}
                    <span className="text-white">
                      {step1_architect.progression_rules.weeks_1_3}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50">Weeks 4-6:</span>{' '}
                    <span className="text-white">
                      {step1_architect.progression_rules.weeks_4_6}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded bg-white/5 p-3">
                <div className="mb-2 text-xs uppercase text-white/50">
                  Volume Landmarks (MEV → MRV)
                </div>
                <div className="flex flex-wrap gap-2">
                  {step1_architect.volume_landmarks.map((v, i) => (
                    <span key={i} className="rounded bg-white/10 px-2 py-1 text-xs text-white">
                      {v.muscle_group}: {v.mev_sets}-{v.mrv_sets} sets
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Step 2: Biomechanist */}
          <CollapsibleSection
            title="Pattern Skeleton"
            icon={<GitBranch className="h-4 w-4 text-green-400" />}
            stepNumber={2}
          >
            <div className="space-y-3 text-sm">
              {step2_biomechanist.days.map((day) => (
                <div key={day.day_number} className="rounded bg-white/5 p-3">
                  <div className="mb-2 font-medium text-orange-light">
                    Day {day.day_number}: {day.day_name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {day.patterns.map((p, i) => (
                      <span
                        key={i}
                        className={`rounded px-2 py-1 text-xs ${
                          p.priority === 'primary'
                            ? 'bg-orange-light/20 text-orange-light'
                            : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {p.pattern} ({p.category})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Step 3: Coach */}
          <CollapsibleSection
            title="Exercise Selection"
            icon={<Dumbbell className="h-4 w-4 text-purple-400" />}
            stepNumber={3}
          >
            <div className="space-y-3 text-sm">
              {step3_coach.map((day) => (
                <div key={day.day_number} className="rounded bg-white/5 p-3">
                  <div className="mb-2 font-medium text-orange-light">
                    Day {day.day_number}: {day.day_name}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-white/50">
                        <th className="pb-1">Pattern</th>
                        <th className="pb-1">Exercise</th>
                        <th className="pb-1">Equipment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.exercises.map((e, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-1 text-white/70">{e.pattern}</td>
                          <td className="py-1 font-medium text-white">{e.exercise_name}</td>
                          <td className="py-1 text-white/50">{e.equipment_used}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Step 4: Summary */}
          <CollapsibleSection
            title="Progression Applied"
            icon={<Calculator className="text-orange-400 h-4 w-4" />}
            stepNumber={4}
          >
            <div className="rounded bg-white/5 p-3 text-sm">
              <p className="text-white/80">
                Week-by-week numbers have been calculated using the{' '}
                <span className="font-medium text-orange-light">
                  {step1_architect.progression_protocol.replace(/_/g, ' ')}
                </span>{' '}
                protocol. Review the full schedule above to see the progression applied.
              </p>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
};

export default ChainDebugPanel;
