/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drag payload types for trainer unified calendar (P2).
 */

export type UnifiedCalendarScheduledDragData = {
  kind: 'scheduled_live_occurrence';
  occurrenceId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
};

export type UnifiedCalendarCoachDragData = {
  kind: 'coach_instance';
  clientUserId: string;
  instanceId: string;
  assignmentId: string;
  scheduledAt: string;
  trainerLiveSessionId?: string | null;
};

export type UnifiedCalendarDragData =
  | UnifiedCalendarScheduledDragData
  | UnifiedCalendarCoachDragData;
