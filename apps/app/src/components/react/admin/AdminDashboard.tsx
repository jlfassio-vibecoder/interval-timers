/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Outlet,
  useLocation,
  useParams,
} from 'react-router-dom';
import { Home, LogOut, LayoutDashboard } from 'lucide-react';
import { AppProvider } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import { clearAuthCookie } from '@/lib/auth-cookie';
import DashboardHome from './views/DashboardHome';
import ManageUsers from './views/ManageUsers';
import ManagePrograms from './views/ManagePrograms';
import ManageChallenges from './views/ManageChallenges';
import ManageWorkouts from './views/ManageWorkouts';
import ManageExercises from './views/ManageExercises';
import ManageZones from './views/ManageZones';
import ProgramEditor from './views/ProgramEditor';
import WorkoutEditor from './views/WorkoutEditor';
import ChallengeEditor from './views/ChallengeEditor';
import WODEditor from './views/WODEditor';
import WODEngine from './views/WODEngine';
import WarmUpEngine from './views/WarmUpEngine';
import AdminExerciseDetailWrapper from './AdminExerciseDetailWrapper';
import ExerciseImageGenerator from '@/components/ExerciseImageGenerator';
import { adminPaths } from '@/lib/admin/config';
import { ADMIN_NAV_ITEMS, isAdminNavActive } from '@/lib/admin/navigation';

const AdminLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-bg-dark text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="border-b border-white/10 p-6">
            <h1 className="font-heading text-xl font-bold">Admin Dashboard</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isAdminNavActive(item.path, location.pathname);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive: navActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                      navActive || active
                        ? 'bg-orange-light/20 text-orange-light'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Trainer dashboard, Landing Page, Sign Out */}
          <div className="space-y-1 border-t border-white/10 p-4">
            <a
              href="/trainer"
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="font-medium">Mission Control</span>
            </a>
            <button
              onClick={() => {
                window.location.href = adminPaths.home;
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Home className="h-5 w-5" />
              <span className="font-medium">Return to Home</span>
            </button>
            <button
              onClick={async () => {
                clearAuthCookie();
                await supabase.auth.signOut();
                window.location.href = adminPaths.login;
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const AdminExerciseDetailView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return <AdminExerciseDetailWrapper slug={slug} initialExercise={null} />;
};

const ExerciseImageGenView: React.FC = () => {
  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="mb-4 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Exercise Visualization Lab
        </h1>
        <p className="text-xl text-white/60">
          Generate professional biomechanical infographics using AI research and image synthesis.
        </p>
      </div>
      <ExerciseImageGenerator />
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter basename={adminPaths.root}>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="programs/:id" element={<ProgramEditor />} />
            <Route path="programs" element={<ManagePrograms />} />
            <Route path="challenges/:id" element={<ChallengeEditor />} />
            <Route path="challenges" element={<ManageChallenges />} />
            <Route path="workouts/:id" element={<WorkoutEditor />} />
            <Route path="workouts" element={<ManageWorkouts />} />
            <Route path="wod/:id" element={<WODEditor />} />
            <Route path="wod" element={<WODEngine />} />
            <Route path="warmup" element={<WarmUpEngine />} />
            <Route path="exercises/:slug" element={<AdminExerciseDetailView />} />
            <Route path="exercises" element={<ManageExercises />} />
            <Route path="exercise-image-gen" element={<ExerciseImageGenView />} />
            <Route path="zones" element={<ManageZones />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default AdminDashboard;
