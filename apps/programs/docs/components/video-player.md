# Video Player Component

## Overview

The `VideoPlayer` component is a reusable React component that displays video content with a distinctive "Neural Feed" styling. It's designed to showcase exercise demonstrations, workout videos, and other fitness-related content.

**Location**: `src/components/react/VideoPlayer.tsx`

## Component API

### Props

```typescript
interface VideoPlayerProps {
  videoUrl: string; // Required: Path to video file
}
```

### Usage

```tsx
import VideoPlayer from './VideoPlayer';

<VideoPlayer videoUrl="/videos/exercise/squat.mp4" />;
```

## Features

### Visual Design

- **Aspect Ratio**: Maintains 16:9 aspect ratio (`aspect-video`)
- **Styling**: Rounded corners, golden border (`border-[#ffbf00]/30`), shadow effects
- **Neural Feed Badge**: Animated red dot indicator with "Neural Feed" label
- **Inner Border**: Subtle 8px black border overlay for depth

### Video Attributes

The video element includes these attributes for optimal user experience:

- `autoPlay` - Video starts playing automatically
- `muted` - Required for autoplay in modern browsers
- `loop` - Video continuously loops
- `playsInline` - Prevents fullscreen on mobile devices
- `controlsList="nodownload"` - Prevents download option in native controls

### Defensive Rendering

The component returns `null` if `videoUrl` is not provided, preventing errors:

```tsx
if (!videoUrl) return null;
```

## Video Storage Structure

Videos are stored in the `public/videos/` directory, organized by type:

```
public/videos/
├── exercise/      # Exercise demonstration videos
├── workout/       # Full workout videos
├── complexes/     # Complex movement sequences
├── instruction/   # Instructional/tutorial videos
└── form-check/    # Form correction and analysis videos
```

### File Path Resolution

Files in `public/` are served at the root URL:

- `public/videos/exercise/squat.mp4` → `/videos/exercise/squat.mp4`
- `public/videos/workout/day1.mp4` → `/videos/workout/day1.mp4`

## Integration with Exercise Data

### Exercise Type Definition

The `Exercise` interface includes an optional `videoUrl` field:

```typescript
export interface Exercise {
  name: string;
  images: string[];
  instructions: string[];
  videoUrl?: string; // Optional video URL for exercise demonstrations
}
```

### Adding Videos to Exercises

In `src/data/exercises.ts`, add the `videoUrl` property:

```typescript
{
  name: "Squat",
  images: ["/images/exercises/squat-1.jpg"],
  instructions: ["Stand with feet shoulder-width apart", ...],
  videoUrl: "/videos/exercise/squat.mp4" // Add video URL
}
```

### Displaying in ExerciseDetailModal

The `ExerciseDetailModal` component automatically displays the video when present:

```tsx
// In ExerciseDetailModal.tsx
{
  exercise.videoUrl && <VideoPlayer videoUrl={exercise.videoUrl} />;
}
```

The video appears at the top of the scrollable image stack, before the exercise images.

## Video File Guidelines

### File Naming Convention

Use kebab-case for video filenames:

- ✅ `squat-form-check.mp4`
- ✅ `deadlift-instruction.mp4`
- ✅ `workout-day-1-warmup.mp4`
- ❌ `Squat Form Check.mp4` (spaces and capitals)
- ❌ `deadlift_instruction.mp4` (underscores)

### Recommended Formats

- **Primary**: MP4 (H.264 codec) for maximum browser compatibility
- **Optional**: WebM for better compression (provide both for optimal support)

### File Size Considerations

- **Exercise videos**: Keep under 10MB when possible
- **Workout videos**: 50-100MB acceptable for full-length content
- **Instruction videos**: 5-15MB depending on length
- Use video compression tools before committing large files

### Video Specifications

For best performance and compatibility:

- **Resolution**: 1080p (1920x1080) or 720p (1280x720)
- **Frame Rate**: 30fps
- **Codec**: H.264
- **Aspect Ratio**: 16:9 (recommended)

## Usage Examples

### In Exercise Data

```typescript
// src/data/exercises.ts
export const EXERCISES = {
  squat: {
    name: 'Squat',
    images: ['/images/exercises/squat-1.jpg'],
    instructions: [
      'Stand with feet shoulder-width apart',
      'Lower your body as if sitting back into a chair',
      'Keep your chest up and core engaged',
      'Return to standing position',
    ],
    videoUrl: '/videos/exercise/squat.mp4',
  },
};
```

### In React Components

```tsx
// Direct usage
<VideoPlayer videoUrl="/videos/exercise/squat.mp4" />;

// Conditional rendering
{
  exercise.videoUrl && <VideoPlayer videoUrl={exercise.videoUrl} />;
}

// With dynamic path
const videoPath = `/videos/${type}/${filename}.mp4`;
<VideoPlayer videoUrl={videoPath} />;
```

### In Other Modals

The `VideoPlayer` component can be used in any component that needs to display videos:

```tsx
// In WorkoutDetailModal.tsx (future enhancement)
{
  workout.videoUrl && (
    <div className="mb-4">
      <VideoPlayer videoUrl={workout.videoUrl} />
    </div>
  );
}

// In ProgramDetail.tsx (future enhancement)
{
  program.introVideoUrl && <VideoPlayer videoUrl={program.introVideoUrl} />;
}
```

## Component Structure

```tsx
const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl }) => {
  if (!videoUrl) return null;

  return (
    <div className="group/video relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-[#ffbf00]/30 bg-black shadow-2xl">
      {/* Neural Feed Badge */}
      <div className="absolute left-4 top-4 z-20 ...">
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-500 ..." />
        <span className="...">Neural Feed</span>
      </div>

      {/* Video Element */}
      <video
        src={videoUrl}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        controlsList="nodownload"
      />

      {/* Inner Border Overlay */}
      <div className="pointer-events-none absolute inset-0 border-[8px] border-black/10" />
    </div>
  );
};
```

## Styling Details

### Container Classes

- `group/video` - Enables group hover effects (for future enhancements)
- `relative` - Positioning context for absolute children
- `shrink-0` - Prevents flex shrinking
- `w-full` - Full width
- `aspect-video` - Maintains 16:9 aspect ratio
- `rounded-2xl` - Rounded corners
- `overflow-hidden` - Clips content to rounded corners
- `border border-[#ffbf00]/30` - Golden border with 30% opacity
- `bg-black` - Black background
- `shadow-2xl` - Large shadow effect

### Badge Classes

- `absolute top-4 left-4 z-20` - Positioned in top-left corner
- `bg-black/60 backdrop-blur-md` - Semi-transparent black with blur
- `border border-[#ffbf00]/20` - Subtle golden border
- `animate-pulse` - Pulsing animation on red dot

### Video Element Classes

- `h-full w-full` - Full container size
- `object-cover` - Maintains aspect ratio while filling container

## Browser Compatibility

The video player works in all modern browsers:

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

The `playsInline` attribute ensures videos play inline on iOS devices instead of opening in fullscreen.

## Future Enhancements

Potential improvements for the VideoPlayer component:

1. **Controls**: Add custom play/pause controls
2. **Progress Bar**: Show video progress
3. **Volume Control**: Allow users to unmute
4. **Fullscreen**: Add fullscreen toggle
5. **Multiple Sources**: Support for multiple video formats (MP4 + WebM)
6. **Poster Image**: Show thumbnail before video loads
7. **Loading State**: Display loading indicator while video loads
8. **Error Handling**: Show error message if video fails to load

## Related Documentation

- [React Components](./react-components.md)
- [Directory Structure](../architecture/directory-structure.md)
- [Data Structures](../data/data-structures.md)
- [Exercise Detail Modal](./react-components.md#exercisedetailmodaltxs)
