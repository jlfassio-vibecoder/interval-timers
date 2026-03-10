/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side Gemini chat service for the AIChat widget.
 * Calls the server API (/api/chat) so the API key stays server-side.
 */

/** Minimal chat session interface for compatibility with code that holds a session. */
export interface ChatSession {
  sendMessage(message: string): Promise<{ response: { text: () => string } }>;
}

let chatSession: ChatSession | null = null;

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return import.meta.env.SITE ?? 'http://localhost:4321';
}

export const initializeChat = (): ChatSession => {
  if (chatSession) return chatSession;
  chatSession = {
    sendMessage: async (message: string) => {
      const text = await sendMessageToGemini(message);
      return {
        response: {
          text: () => text,
        },
      };
    },
  };
  return chatSession;
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const text = await res.text();
    if (!res.ok) {
      try {
        const err = JSON.parse(text) as { error?: string };
        return err.error ?? `Request failed (${res.status})`;
      } catch {
        return `Request failed (${res.status})`;
      }
    }
    try {
      const data = JSON.parse(text) as { text?: string };
      return data.text ?? 'Connection dropped. Checking metabolic load...';
    } catch {
      return 'Connection dropped. Checking metabolic load...';
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Gemini Error:', error);
    }
    return 'Neural burnout. Calibration needed.';
  }
};
