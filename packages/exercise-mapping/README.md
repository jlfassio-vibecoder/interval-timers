# @workout-generator/exercise-mapping

Shared logic for exercise resolution and canonical slug lookup. Used by `programs` and `admin-dash-astro`.

## Public API

| Export | Description |
| ------ | ----------- |
| `normalizeExerciseName(name: string)` | Normalizes exercise names for lookup (lowercase, singular/plural handling). |
| `buildApprovedExerciseMaps(list)` | Builds `exerciseMap`, `extendedMap`, `slugMap` from a `GeneratedExerciseInput[]`. |
| `ApprovedExerciseMaps` | Type for the maps returned by `buildApprovedExerciseMaps`. |
| `Exercise`, `ExtendedBiomechanics`, `GeneratedExerciseInput` | Types used by the mapping logic. |

`buildApprovedExerciseMaps` populates `Exercise.instructionsStructured` when source data includes `userFriendlyInstructions` (parsed markdown with intro, section title, and numbered steps). The parsing is internal; consumers receive fully built `Exercise` objects.
