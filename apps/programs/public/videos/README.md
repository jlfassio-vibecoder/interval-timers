# Videos Directory

This directory contains all video assets for the AI Fitcopilot application.

## Directory Structure

```
public/videos/
├── exercise/      # Exercise demonstration videos
├── workout/       # Full workout videos
├── complexes/     # Complex movement sequences
├── instruction/   # Instructional/tutorial videos
└── form-check/    # Form correction and analysis videos
```

## Usage

Videos in this directory are served at the root URL. For example:

- `public/videos/exercise/squat.mp4` → `/videos/exercise/squat.mp4`
- `public/videos/workout/day1.mp4` → `/videos/workout/day1.mp4`

## Referencing Videos in Code

When referencing videos in your code, use the absolute path from the root:

```typescript
// In Exercise data
{
  name: "Squat",
  videoUrl: "/videos/exercise/squat.mp4"
}

// In React components
<VideoPlayer videoUrl="/videos/exercise/squat.mp4" />
```

## File Naming Convention

Use kebab-case for video filenames:

- `squat-form-check.mp4`
- `deadlift-instruction.mp4`
- `workout-day-1-warmup.mp4`

## Video Formats

Recommended formats:

- **Primary**: MP4 (H.264 codec) for maximum browser compatibility
- **Fallback**: WebM for better compression (optional)

## File Size Considerations

- Keep exercise videos under 10MB when possible
- Workout videos may be larger (50-100MB acceptable)
- Consider using video compression tools before committing
