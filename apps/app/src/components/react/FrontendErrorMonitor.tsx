/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Registers global error and unhandledrejection handlers to log frontend errors.
 */

import React, { useEffect } from 'react';
import { logFrontendError } from '@/lib/log-frontend-error';

const FrontendErrorMonitor: React.FC = () => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.message ?? String(event.error);
      const stack = event.error instanceof Error ? event.error.stack : undefined;
      logFrontendError({
        message,
        stack,
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const message =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
            ? event.reason
            : 'Unhandled rejection';
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      logFrontendError({
        message,
        stack,
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
};

export default FrontendErrorMonitor;
