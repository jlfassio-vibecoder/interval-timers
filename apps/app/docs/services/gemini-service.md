# Gemini Service

## Overview

The Gemini service provides AI chat for the AIChat widget. The **client** (`src/services/geminiService.ts`) keeps a thin chat session and sends messages to **`/api/chat`**. The **server** (`src/lib/gemini-server.ts`) holds the system prompt and calls the Gemini API (API key stays server-side).

**Client**: `src/services/geminiService.ts`  
**Server (prompt + model)**: `src/lib/gemini-server.ts`  
**API route**: `src/pages/api/chat.ts`

## Initialization

### Chat Session

The service maintains a singleton chat session:

```tsx
let chatSession: ChatSession | null = null;
```

### `initializeChat(): ChatSession`

Initializes and returns a chat session. Creates new session if one doesn't exist.

**Returns**: `ChatSession` object

**Usage**:

```tsx
import { initializeChat } from '../services/geminiService';

const chat = initializeChat();
```

**Implementation**:

- Client session delegates to `sendMessageToGemini()`, which calls `/api/chat` (POST with `{ message }`).
- System prompt and model are server-side in `gemini-server.ts` (see **System Instructions** below).

**System Instructions**:
The system instruction is defined server-side in `src/lib/gemini-server.ts` (`AI_FITCOPILOT_SYSTEM_PROMPT`). The AI is configured for the trainer-facing product:

```
You are 'AI FITCOPILOT', the AI assistant for personal trainers. You help trainers design programs, prescribe exercises, and scale workouts for their clients.

Role: AI assistant for personal trainers designing programs and prescribing exercises.
Tone: Professional, clinical, supportive. Use emojis sparingly (💪, 🔥, ⚡) when it fits.

Focus on: program design, exercise selection, form cues, periodization, client scaling, and evidence-based recommendations.

Keep responses short (under 50 words) and high-energy. The user is a personal trainer—answer in that context (e.g. "prescribe", "assign to clients", "scale for").
```

## Functions

### `sendMessageToGemini(message: string): Promise<string>`

Sends a message to the AI and returns the response.

**Parameters**:

- `message` - User's message string

**Returns**: AI response string

**Usage**:

```tsx
import { sendMessageToGemini } from '../services/geminiService';

const response = await sendMessageToGemini("What's today's workout?");
console.log(response);
```

**Error Handling**:

- Catches errors and returns fallback message
- Only logs errors in development mode
- Returns: `"Neural burnout. Calibration needed."` on error

**Implementation**:

```tsx
// Client: geminiService.ts — calls /api/chat
export const sendMessageToGemini = async (message: string): Promise<string> => {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  // ... parse JSON response, handle errors, return data.text or fallback
};
```

## Integration

### Server-side (API and prompt)

Chat is handled by `POST /api/chat` (`src/pages/api/chat.ts`), which calls `sendAIFitcopilotMessage()` in `src/lib/gemini-server.ts`. The system prompt is `AI_FITCOPILOT_SYSTEM_PROMPT`; the model is `gemini-2.0-flash`. The API key (`GEMINI_API_KEY`) is only used on the server.

### Usage in Components

The service is used by `AIChat` component:

```tsx
// In AIChat.tsx
import { sendMessageToGemini } from '../../services/geminiService';

const handleSend = async (message: string) => {
  const response = await sendMessageToGemini(message);
  // Update chat UI with response
};
```

## Configuration

### Model selection

The model is configured server-side in `src/lib/gemini-server.ts` inside `sendAIFitcopilotMessage()` (currently `gemini-2.0-flash`). To change it, edit the `model` field in that function’s `client.models.generateContent()` call.

### System instructions

System instructions are defined server-side in `src/lib/gemini-server.ts` as `AI_FITCOPILOT_SYSTEM_PROMPT`. The client calls `/api/chat`, which uses `sendAIFitcopilotMessage()` and this prompt.

**To modify**: Edit the `AI_FITCOPILOT_SYSTEM_PROMPT` constant in `gemini-server.ts`.

## Error Handling

### Development Mode

Errors are logged to console in development:

```tsx
if (import.meta.env.DEV) {
  console.error('Gemini Error:', error);
}
```

### Production Mode

Errors return user-friendly message without logging:

```tsx
return 'Neural burnout. Calibration needed.';
```

### Connection Errors

If response is empty, returns:

```tsx
return 'Connection dropped. Checking metabolic load...';
```

## Best Practices

1. **Handle errors gracefully** - Always provide fallback messages
2. **Don't expose errors to users** - Use friendly error messages
3. **Log in development only** - Avoid logging sensitive data in production
4. **Reuse chat session** - Session maintains conversation context
5. **Update system instructions carefully** - Changes affect AI personality

## Related Documentation

- [Firebase Service](./firebase-service.md)
- [AIChat Component](../components/react-components.md#aichattsx)
