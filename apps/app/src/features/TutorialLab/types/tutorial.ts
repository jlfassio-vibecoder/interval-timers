/**
 * Tutorial Lab: configuration types for dynamic, camera-based exercise tutorials.
 * Phases and success criteria are data-driven (no squat-specific enums).
 */

export interface SuccessCriterion {
  /** MediaPipe landmark index for first point (e.g. hip) */
  jointA: number;
  /** MediaPipe landmark index for vertex (e.g. knee) */
  jointB: number;
  /** MediaPipe landmark index for third point (e.g. ankle) */
  jointC: number;
  targetAngle: number;
  operator: '<' | '>' | '==';
}

export type CameraOrientation = 'front' | 'side';

export interface ExercisePhase {
  id: string;
  name: string;
  instructionText: string;
  /** MediaPipe POSE_LANDMARKS indices to highlight in overlay */
  targetJoints: number[];
  successCriteria: SuccessCriterion[];
  /** Whether user should face the camera or stand sideways for this phase */
  cameraOrientation?: CameraOrientation;
}

export interface ExerciseConfig {
  id: string;
  name: string;
  description: string;
  phases: ExercisePhase[];
}
