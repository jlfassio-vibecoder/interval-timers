/**
 * Minimal type for interval timer standalone app.
 * Single block in the linear timeline consumed by the interval timer overlay.
 */
export interface HIITTimelineBlock {
  type: 'warmup' | 'setup' | 'work' | 'rest' | 'cooldown';
  duration: number; // seconds
  name: string;
  notes?: string;
  /** Primary exercise image URL when available */
  imageUrl?: string;
}
