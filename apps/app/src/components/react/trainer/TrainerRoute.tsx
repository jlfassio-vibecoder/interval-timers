import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, Wrench, Home } from 'lucide-react';
import { AppProvider, useAppContext } from '../../../contexts/AppContext';
import { AuthModal } from '@interval-timers/auth-ui';
import { supabase } from '@/lib/supabase/supabase-instance';
import TrainerDashboard from './TrainerDashboard';
import RosterView from './views/RosterView';
import ClientDetailView from './views/ClientDetailView';
import IntelView from './views/IntelView';
import FluidBackground from '../FluidBackground';
import PageViewTracker from '@/components/react/PageViewTracker';
import { adminPaths } from '@/lib/admin/config';

const TRAINER_NAV = [
  { path: '/', label: 'Mission Control', icon: LayoutDashboard },
  { path: '/roster', label: 'Roster', icon: Users },
  { path: '/intel', label: 'Intel', icon: BarChart3 },
] as const;

function isTrainerNavActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return pathname === path || pathname.startsWith(path + '/');
}

const TrainerLayout: React.FC = () => {
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-black text-white">
      <PageViewTracker pathname={location.pathname} supabase={supabase} appId="app" />
      <aside className="w-56 border-r border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex h-full min-h-screen flex-col">
          <div className="border-b border-white/10 p-5">
            <h1 className="font-heading text-lg font-bold uppercase tracking-tight">
              Mission Control
            </h1>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {TRAINER_NAV.map((item) => {
              const Icon = item.icon;
              const active = isTrainerNavActive(item.path, location.pathname);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      isActive || active
                        ? 'bg-orange-light/20 text-orange-light'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
            <a
              href={adminPaths.root}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Wrench className="h-5 w-5" />
              Open Builder
            </a>
          </nav>
          <div className="border-t border-white/10 p-4">
            <a
              href="/"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Home className="h-5 w-5" />
              Return to Home
            </a>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 pt-24">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const TrainerGuard = () => {
  const { user, profile, isTrainer } = useAppContext();
  const [showAuth, setShowAuth] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Wait for initial auth check (user is null initially, but onAuthStateChanged fires quickly)
    // A better pattern might be an isLoading flag in context, but checking against null/undefined if possible
    // Here we'll just wait a tick or rely on user state changes.
    // For now, let's assume if user is null after a short delay, they are not logged in.
    const timer = setTimeout(() => setAuthChecked(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authChecked && !user) {
      setShowAuth(true);
    }
  }, [authChecked, user]);

  if (!authChecked && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
        <FluidBackground />
        <h1 className="mb-4 text-3xl font-bold uppercase">Restricted Access</h1>
        <p className="mb-8 text-white/60">Trainer credentials required.</p>
        <button
          onClick={() => setShowAuth(true)}
          className="rounded-xl bg-orange-light px-8 py-3 font-bold uppercase text-black hover:bg-white"
        >
          Authenticate
        </button>
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          supabase={supabase}
          redirectBaseUrl="/account"
          fromAppId="app"
          getRedirectUrl={async (authUser) => {
            const { data } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', authUser.id)
              .maybeSingle();
            if (data?.role === 'trainer' || data?.role === 'admin') return '/trainer';
            return null;
          }}
        />
      </div>
    );
  }

  if (!isTrainer) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black p-8 text-center text-white">
        <FluidBackground />
        <h1 className="mb-4 text-3xl font-bold uppercase text-red-500">Clearance Denied</h1>
        <p className="mb-8 max-w-md text-white/60">
          Your profile is registered as a <strong>Client</strong>. This area is restricted to
          command personnel.
        </p>
        <div className="space-y-4">
          <a
            href="/"
            className="block rounded-xl border border-white/20 bg-white/5 px-8 py-3 font-bold uppercase text-white hover:bg-white/10"
          >
            Return to Base
          </a>
          <button
            onClick={() =>
              window.alert('Contact support to upgrade your account to Trainer status.')
            }
            className="block w-full rounded-xl text-xs uppercase tracking-widest text-white/30 hover:text-orange-light"
          >
            Request Promotion
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/trainer">
      <Routes>
        <Route path="/" element={<TrainerLayout />}>
          <Route index element={<TrainerDashboard profile={profile} />} />
          <Route path="roster" element={<RosterView />} />
          <Route path="roster/:userId" element={<ClientDetailView />} />
          <Route path="intel" element={<IntelView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

const TrainerRoute: React.FC = () => {
  return (
    <AppProvider>
      <TrainerGuard />
    </AppProvider>
  );
};

export default TrainerRoute;
