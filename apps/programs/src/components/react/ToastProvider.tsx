/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ToastProvider - Global toast notifications using Sonner
 * Styled to match the dark theme of the application.
 */

import React from 'react';
import { Toaster } from 'sonner';

const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="bottom-center"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'rgba(13, 5, 0, 0.95)',
          border: '1px solid rgba(255, 191, 0, 0.2)',
          color: '#fff',
        },
        classNames: {
          toast: 'font-sans',
          title: 'font-medium',
          description: 'text-white/70',
          actionButton: 'bg-orange-light text-black font-bold',
          cancelButton: 'bg-white/10 text-white',
          closeButton: 'bg-white/10 border-white/20 text-white hover:bg-white/20',
        },
      }}
    />
  );
};

export default ToastProvider;
