/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prompt for AI parsing of pasted workout text into WorkoutSetTemplate JSON.
 * Single-shot Vertex call (no chain).
 */

export function buildParsePastedWorkoutPrompt(rawText: string): string {
  return `You are a fitness coach and data parser. Convert the user's pasted workout or activity notes into a structured JSON object that matches our workout format.

INPUT (user pasted text):
---
${rawText}
---

OUTPUT REQUIREMENTS:
- Output ONLY valid JSON. No markdown, no explanations, no code blocks.
- The JSON must match the WorkoutSetTemplate schema exactly.

WorkoutSetTemplate schema:
{
  "title": string,       // Workout or activity title (derive from content if missing)
  "description": string, // Brief description; can summarize the pasted content
  "difficulty": "beginner" | "intermediate" | "advanced",
  "workouts": [          // Array of 1+ sessions
    {
      "title": string,
      "description": string,
      "warmupBlocks": [{ "order": 1, "exerciseName": string, "instructions": [string] }],
      "exerciseBlocks": [{
        "order": number,
        "name": string,
        "exercises": [{
          "order": number,
          "exerciseName": string,
          "sets": number,
          "reps": string,
          "restSeconds": number,
          "coachNotes": string
        }]
      }],
      "finisherBlocks": [],
      "cooldownBlocks": []
    }
  ]
}

RULES:
- Extract exercises from bullet lists, numbered lists, or inline mentions.
- For "15 KB swings", "10 push-ups": exerciseName = "KB Swings", sets = 1, reps = "15" (or "10").
- For time-based (e.g. "45 sec plank"): reps = "45 sec" or use workSeconds if it's interval-style.
- If format is AMRAP/EMOM/Tabata: include protocol in description; structure exercises in exerciseBlocks.
- If lifestyle (walk, gardening): create one workout with exercises describing each activity.
- Ensure every workout has at least one exerciseBlock with at least one exercise.
- Empty warmupBlocks/finisherBlocks/cooldownBlocks can be [] or omitted.
- difficulty: infer from intensity terms or default to "intermediate".
`;
}
