/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consistent error/success/warning/info message display for editors.
 */

import React from 'react';
import { X } from 'lucide-react';

export interface StatusMessageProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
}

const TYPE_CLASSES = {
  error: 'border-red-500/20 bg-red-500/10 text-red-300',
  success: 'border-green-500/20 bg-green-500/10 text-green-300',
  warning: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
};

const StatusMessage: React.FC<StatusMessageProps> = ({ type, message, onDismiss }) => {
  if (!message.trim()) return null;

  const baseClass = `rounded-lg border px-4 py-3 ${TYPE_CLASSES[type]}`;

  return (
    <div className={`flex items-center justify-between gap-3 ${baseClass}`}>
      <span className="flex-1">{message}</span>
      {onDismiss != null ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default StatusMessage;
