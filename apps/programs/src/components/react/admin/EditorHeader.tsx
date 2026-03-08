/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared editor header: back button, title, and action slot.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface EditorHeaderProps {
  title: string;
  backPath: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  backPath,
  backLabel = 'Back to List',
  actions,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>{backLabel}</span>
        </button>
        <h1 className="font-heading text-3xl font-bold">{title}</h1>
      </div>
      {actions != null ? <div>{actions}</div> : null}
    </div>
  );
};

export default EditorHeader;
