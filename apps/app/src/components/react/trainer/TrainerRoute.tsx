import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Outlet,
  useLocation,
  Navigate,
} from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutList,
  Users,
  BarChart3,
  Wrench,
  Home,
  ExternalLink,
  FileText,
  UserCircle,
  Video,
} from 'lucide-react';
import { AppProvider, useAppContext } from '../../../contexts/AppContext';
import { AuthModal } from '@interval-timers/auth-ui';
import { supabase } from '@/lib/supabase/supabase-instance';
import TrainerDashboard from './TrainerDashboard';
import RosterView from './views/RosterView';
import ClientDetailView from './views/ClientDetailView';
import ClientMissionControlLayout from './views/ClientMissionControlLayout';
import PerformanceLabView from './views/PerformanceLabView';
import IntelView from './views/IntelView';
import StudioWelcomeEditorView from './views/StudioWelcomeEditorView';
import TrainerWelcomeEditorView from './views/TrainerWelcomeEditorView';
import FluidBackground from '../FluidBackground';
import PageViewTracker from '@/components/react/PageViewTracker';
import { adminPaths } from '@/lib/admin/config';
import TrainerLiveClientJoinPage from './live/TrainerLiveClientJoinPage';
import TrainerLiveLobbyView from './live/TrainerLiveLobbyView';
import TrainerLiveHostView from './live/TrainerLiveHostView';
import TrainerWorkoutFactoryView from './views/TrainerWorkoutFactoryView';

const TRAINER_NAV = [
  { path: '/', label: 'Mission Control', icon: LayoutDashboard },
  { path: '/workouts/factory', label: 'Workout Factory', icon: LayoutList },
  { path: '/roster', label: 'Roster', icon: Users },
  { path: '/live', label: 'Live', icon: Video },
  { path: '/roster/welcome', label: 'Studio invite', icon: FileText },
  { path: '/roster/welcome/coach', label: 'Coach landing', icon: UserCircle },
  { path: '/intel', label: 'Intel', icon: BarChart3 },
] as const;

function isTrainerNavActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  if (path === '/live') {
    return pathname === '/live' || pathname.startsWith('/live/');
  }
  if (path === '/workouts/factory') {
    return pathname === '/workouts/factory' || pathname.startsWith('/workouts/factory/');
  }
  if (path === '/roster/welcome/coach') {
    return pathname === '/roster/welcome/coach';
  }
  if (path === '/roster/welcome') {
    return pathname === '/roster/welcome';
  }
  if (path === '/roster') {
    if (pathname === '/roster') return true;
    if (!pathname.startsWith('/roster/')) return false;
    return !pathname.startsWith('/roster/welcome');
  }
  return pathname === path || pathname.startsWith(path + '/');
}

const TrainerLayout: React.FC = () => {
  const location = useLocation();
  const { isTrainer } = useAppContext();
  const showTrainerNav = isTrainer;
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
            {TRAINER_NAV.filter((item) => showTrainerNav || item.path === '/').map((item) => {
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
              href="/welcome"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ExternalLink className="h-5 w-5 shrink-0" />
              Landing Page
            </a>
            {showTrainerNav && (
              <a
                href={adminPaths.root}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Wrench className="h-5 w-5" />
                Open Builder
              </a>
            )}
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

/** Mission Control auth + staff check; renders child routes via Outlet */
const TrainerAccessGate: React.FC = () => {
  const { user, isMissionControlStaff } = useAppContext();
  const [showAuth, setShowAuth] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
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
        <p className="mb-8 text-white/60">Mission Control access required.</p>
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
            const { data: prof } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', authUser.id)
              .maybeSingle();
            const r = prof?.role;
            if (r === 'host' || r === 'admin' || r === 'super_admin') return '/trainer';
            const { data: tr } = await supabase
              .from('trainers')
              .select('user_id')
              .eq('user_id', authUser.id)
              .maybeSingle();
            if (tr) return '/trainer';
            return null;
          }}
        />
      </div>
    );
  }

  if (!isMissionControlStaff) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black p-8 text-center text-white">
        <FluidBackground />
        <h1 className="mb-4 text-3xl font-bold uppercase text-red-500">Clearance Denied</h1>
        <p className="mb-8 max-w-md text-white/60">
          Your profile is registered as a <strong>Client</strong>. Mission Control is restricted to
          hosts, trainers, and admins.
        </p>
        <div className="space-y-4">
          <a
            href="/"
            className="block rounded-xl border border-white/20 bg-white/5 px-8 py-3 font-bold uppercase text-white hover:bg-white/10"
          >
            Return to Base
          </a>
          <button
            type="button"
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

  return <Outlet />;
};

function TrainerLiveLobbyRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <TrainerLiveLobbyView /> : <Navigate to="/" replace />;
}

function TrainerLiveHostRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <TrainerLiveHostView /> : <Navigate to="/" replace />;
}

function TrainerRosterRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <RosterView /> : <Navigate to="/" replace />;
}

function TrainerStudioWelcomeRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <StudioWelcomeEditorView /> : <Navigate to="/" replace />;
}

function TrainerCoachWelcomeRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <TrainerWelcomeEditorView /> : <Navigate to="/" replace />;
}

function TrainerClientMissionRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <ClientMissionControlLayout /> : <Navigate to="/" replace />;
}

function TrainerIntelRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <IntelView /> : <Navigate to="/" replace />;
}

function TrainerWorkoutFactoryRoute() {
  const { isTrainer } = useAppContext();
  return isTrainer ? <TrainerWorkoutFactoryView /> : <Navigate to="/" replace />;
}

const TrainerBrowser: React.FC = () => {
  return (
    <BrowserRouter basename="/trainer">
      <Routes>
        <Route path="live/join/:sessionId" element={<TrainerLiveClientJoinPage />} />
        <Route element={<TrainerAccessGate />}>
          <Route path="/" element={<TrainerLayout />}>
            <Route index element={<TrainerDashboard />} />
            <Route path="workouts/factory" element={<TrainerWorkoutFactoryRoute />} />
            <Route path="roster" element={<TrainerRosterRoute />} />
            <Route path="roster/welcome" element={<TrainerStudioWelcomeRoute />} />
            <Route path="roster/welcome/coach" element={<TrainerCoachWelcomeRoute />} />
            <Route path="roster/:userId" element={<TrainerClientMissionRoute />}>
              <Route index element={<ClientDetailView />} />
              <Route path="lab" element={<PerformanceLabView />} />
            </Route>
            <Route path="intel" element={<TrainerIntelRoute />} />
            <Route path="live" element={<TrainerLiveLobbyRoute />} />
            <Route path="live/:sessionId" element={<TrainerLiveHostRoute />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

const TrainerRoute: React.FC = () => {
  return (
    <AppProvider>
      <TrainerBrowser />
    </AppProvider>
  );
};

export default TrainerRoute;
