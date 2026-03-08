/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD Editor stub. WOD uses GeneratedWODDoc with WorkoutDetail (warmup/main/finisher/cooldown,
 * each exercises: string[]). Full editor design deferred until WOD CRUD surface is confirmed.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import EditorHeader from '../EditorHeader';
import StatusMessage from '../StatusMessage';

const WODEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6" data-wod-editor>
      <EditorHeader title="Edit WOD" backPath="/wod" backLabel="Back to WOD Engine" />

      <StatusMessage
        type="info"
        message={`WOD editing for "${id ?? 'unknown'}" is not yet available. Use the WOD Engine to generate and manage WODs.`}
      />

      <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
        <p className="text-white/60">
          Full WOD editor coming soon. The WOD structure (WorkoutDetail with string arrays per
          phase) differs from program/workout Exercise blocks and will need dedicated edit
          components.
        </p>
      </div>
    </div>
  );
};

export default WODEditor;
