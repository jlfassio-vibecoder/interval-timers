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
  "title": string,
  "description": string,
  "difficulty": "beginner" | "intermediate" | "advanced",
  "workouts": [{
    "title": string,
    "description": string,
    "exerciseBlocks": [{
      "order": number,
      "name": string,
      "exercises": [{
        "order": number,
        "exerciseName": string,
        "sets": number,
        "reps": string,
        "restSeconds": 0,
        "coachNotes": string
      }]
    }]
  }]
}

CRITICAL: Put ALL movements, exercises, stretches, and mobility work into exerciseBlocks. Every item the user lists must appear as an exercise in an exerciseBlock. Do NOT leave exerciseBlocks empty.

PHASE-BASED WORKOUTS (e.g. "Phase 1: Neural Priming", "Phase 2: High-Intensity"):
- Each phase becomes one exerciseBlock. Set block "name" to the phase title (e.g. "Phase 1: Neural Priming & Dynamic Prep").
- Extract every bullet, numbered item, or named movement under that phase into that block's "exercises" array.
- Mobility, warm-up, and cool-down phases also go in exerciseBlocks (not warmupBlocks/cooldownBlocks).

EXTRACTING EXERCISES:
- "Thera Cane First Rib Depress: 60 sec/side" → exerciseName: "Thera Cane First Rib Depress", sets: 1, reps: "60 sec/side"
- "Quadruped Roller Slides: 2 sets of 8 reps" → exerciseName: "Quadruped Roller Slides", sets: 2, reps: "8"
- "Volume: 3 sets to failure (aim for 10–15 reps)" → sets: 3, reps: "10-15" or "failure"
- "TRX Push-Ups" with multi-line setup/execution → exerciseName: "TRX Push-Ups", put setup details in coachNotes
- Parenthetical notes like "(Palms UP)" or "(Upper Chest Focus)" can stay in exerciseName or go in coachNotes
- For time holds (e.g. "2 Minutes", "60 sec/side"): reps = "2 min" or "60 sec/side", sets = 1

SIMPLE FORMATS:
- "15 KB swings", "10 push-ups" → exerciseName, sets: 1, reps from the number
- "45 sec plank" → reps: "45 sec", sets: 1
- AMRAP/EMOM/Tabata: include protocol in description; put exercises in exerciseBlocks
- Lifestyle (walk, gardening): one workout, each activity as an exercise

- difficulty: infer from intensity or default "intermediate".
- warmupBlocks, finisherBlocks, cooldownBlocks: omit or use [].
`;
}
