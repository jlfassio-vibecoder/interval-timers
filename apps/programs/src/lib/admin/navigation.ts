/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin navigation configuration and active-state logic.
 * Single source of truth for sidebar nav; reusable for breadcrumbs etc.
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Dumbbell,
  LayoutGrid,
  Flame,
  Trophy,
  LayoutList,
  ImageIcon,
  Activity,
} from 'lucide-react';
import { EXERCISE_LABELS } from '@/lib/labels/exercises';

export interface AdminNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/programs', label: 'Program Factory', icon: BookOpen },
  { path: '/challenges', label: 'Challenge Factory', icon: Trophy },
  { path: '/workouts', label: 'Workout Factory', icon: LayoutList },
  { path: '/wod', label: 'WOD Engine', icon: Flame },
  { path: '/warmup', label: 'Warm-Up Engine', icon: Activity },
  { path: '/exercises', label: EXERCISE_LABELS.section, icon: Dumbbell },
  { path: '/exercise-image-gen', label: EXERCISE_LABELS.visualizationLab, icon: ImageIcon },
  { path: '/zones', label: 'Zones', icon: LayoutGrid },
];

/**
 * Check if a nav path is active given the current pathname.
 * pathname is the path under the admin basename (e.g. /exercises/foo from useLocation).
 */
export function isAdminNavActive(path: string, pathname: string): boolean {
  if (path === '/') {
    return pathname === '/' || pathname === '' || pathname === '/admin' || pathname === '/admin/';
  }
  return pathname === path || pathname.startsWith(path + '/');
}
