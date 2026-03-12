/**
 * Index/landing for Interval Timers: hero, value props, protocol grid, footer.
 * Shown when no ?protocol= in URL. Matches the "Master Every Energy System" design in site dark theme.
 */
import React from 'react';
import {
  Flame,
  Wind,
  Activity,
  Zap,
  Timer,
  Footprints,
  Heart,
  Clock,
  Repeat,
  Gauge,
  TrendingUp,
  Play,
} from 'lucide-react';
import type { IntervalTimerPage } from './intervalTimerProtocols';

interface IntervalTimerLandingPageProps {
  onNavigate: (page: IntervalTimerPage) => void;
}

const protocols: {
  category: string;
  items: {
    id: IntervalTimerPage;
    name: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
    text: string;
    gradientFrom: string;
  }[];
}[] = [
  {
    category: 'Foundations',
    items: [
      {
        id: 'warmup',
        name: 'Daily Warm-Up',
        desc: 'Joint mobility & activation.',
        icon: <Activity size={24} />,
        color: 'bg-slate-600',
        text: 'text-white',
        gradientFrom: 'from-slate-600',
      },
      {
        id: 'mindful',
        name: 'Japanese Walking',
        desc: 'Zone 2 cardio meets meditation.',
        icon: <Footprints size={24} />,
        color: 'bg-green-600',
        text: 'text-white',
        gradientFrom: 'from-green-600',
      },
    ],
  },
  {
    category: 'High Intensity (HIIT)',
    items: [
      {
        id: 'tabata',
        name: 'Tabata',
        desc: 'The original 4-minute miracle.',
        icon: <Flame size={24} />,
        color: 'bg-red-600',
        text: 'text-white',
        gradientFrom: 'from-red-600',
      },
      {
        id: 'gibala',
        name: 'Gibala Method',
        desc: 'Sustainable, efficient intervals.',
        icon: <Wind size={24} />,
        color: 'bg-emerald-600',
        text: 'text-white',
        gradientFrom: 'from-emerald-600',
      },
      {
        id: 'wingate',
        name: 'Wingate',
        desc: 'Supra-maximal power test.',
        icon: <Zap size={24} />,
        color: 'bg-lime-500',
        text: 'text-black',
        gradientFrom: 'from-lime-500',
      },
      {
        id: 'timmons',
        name: 'Timmons',
        desc: 'Minimum effective dose.',
        icon: <TrendingUp size={24} />,
        color: 'bg-sky-500',
        text: 'text-white',
        gradientFrom: 'from-sky-500',
      },
    ],
  },
  {
    category: 'Energy Systems',
    items: [
      {
        id: 'phosphagen',
        name: 'Phosphagen',
        desc: 'Explosive ATP-PC power.',
        icon: <Zap size={24} />,
        color: 'bg-yellow-500',
        text: 'text-black',
        gradientFrom: 'from-yellow-500',
      },
      {
        id: 'lactate',
        name: 'Lactate Threshold',
        desc: 'Increase pain tolerance.',
        icon: <Gauge size={24} />,
        color: 'bg-amber-600',
        text: 'text-white',
        gradientFrom: 'from-amber-600',
      },
      {
        id: 'aerobic',
        name: 'Aerobic Power',
        desc: 'VO2 Max capacity building.',
        icon: <Heart size={24} />,
        color: 'bg-indigo-600',
        text: 'text-white',
        gradientFrom: 'from-indigo-600',
      },
      {
        id: '10-20-30',
        name: '10-20-30',
        desc: 'The Copenhagen Method.',
        icon: <Repeat size={24} />,
        color: 'bg-cyan-500',
        text: 'text-black',
        gradientFrom: 'from-cyan-500',
      },
    ],
  },
  {
    category: 'Conditioning',
    items: [
      {
        id: 'emom',
        name: 'EMOM',
        desc: 'Every Minute on the Minute.',
        icon: <Clock size={24} />,
        color: 'bg-teal-600',
        text: 'text-white',
        gradientFrom: 'from-teal-600',
      },
      {
        id: 'amrap',
        name: 'AMRAP',
        desc: 'As Many Rounds As Possible.',
        icon: <Timer size={24} />,
        color: 'bg-orange-600',
        text: 'text-white',
        gradientFrom: 'from-orange-600',
      },
    ],
  },
];

const IntervalTimerLandingPage: React.FC<IntervalTimerLandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-bg-dark font-sans text-white">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/3 rounded-full bg-red-600 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-96 w-96 -translate-x-1/3 translate-y-1/2 rounded-full bg-blue-600 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-24 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/80">
            <Activity size={14} className="text-red-400" />
            <span>Physiological Optimization Suite</span>
          </div>
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
            Master Every <br />
            <span className="to-orange-400 bg-gradient-to-r from-red-400 bg-clip-text text-transparent">
              Energy System
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
            Stop guessing. Prescribe scientifically validated interval protocols designed to target
            specific physiological adaptations—from neural drive to mitochondrial density.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => onNavigate('warmup')}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-light px-8 py-4 font-bold text-black transition-colors hover:bg-[#e6ac00]"
            >
              <Play size={20} fill="currentColor" />
              Daily Warm-Up Protocol
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById('protocols')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl border border-white/30 bg-white/10 px-8 py-4 font-bold text-white transition-colors hover:bg-white/20"
            >
              Explore Protocols
            </button>
          </div>
        </div>
      </header>

      {/* Value prop */}
      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="font-display mb-6 text-3xl font-bold text-white">Why Use Intervals?</h2>
          <div className="grid gap-8 text-left md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                <Flame size={20} />
              </div>
              <h3 className="mb-2 font-bold text-white">Maximum VO2</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Protocols like Tabata and Wingate are clinically proven to increase peak oxygen
                uptake faster than steady-state cardio.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Activity size={20} />
              </div>
              <h3 className="mb-2 font-bold text-white">Metabolic Flexibility</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Train your body to switch efficiently between fat oxidation (Zone 2) and glycogen
                depletion (Phosphagen/Glycolytic).
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
                <Footprints size={20} />
              </div>
              <h3 className="mb-2 font-bold text-white">Mindful Integration</h3>
              <p className="text-sm leading-relaxed text-white/70">
                Bridging the gap between physical exertion and mental clarity through breath-synced
                walking protocols.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol grid */}
      <section id="protocols" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        {protocols.map((category, idx) => (
          <div key={idx} className="mb-16 last:mb-0">
            <h3 className="font-display mb-6 border-l-4 border-orange-light pl-4 text-xl font-bold text-white">
              {category.category}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {category.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 text-left shadow-sm transition-all hover:border-white/20 hover:bg-white/10 hover:shadow-xl"
                >
                  <div
                    className={`absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br ${item.gradientFrom} to-transparent opacity-10 transition-opacity group-hover:opacity-20`}
                  />
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110 ${item.color} ${item.text}`}
                  >
                    {item.icon}
                  </div>
                  <h4 className="mb-1 text-lg font-bold text-white">{item.name}</h4>
                  <p className="mb-4 flex-grow text-sm leading-relaxed text-white/60">
                    {item.desc}
                  </p>
                  <div className="flex items-center text-xs font-bold uppercase tracking-wider text-white/50 transition-colors group-hover:text-orange-light">
                    Launch Timer <span className="ml-1">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="font-display mb-2 text-2xl font-bold text-white">Sync-60</div>
          <p className="mb-8 text-sm text-white/50">Designed by AI Fitcopilot</p>
          <div className="flex justify-center gap-6 text-sm font-bold text-white/40">
            <a href="/privacy" className="hover:text-white/70">Privacy</a>
            <a href="/terms" className="hover:text-white/70">Terms</a>
            <span>Science</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default IntervalTimerLandingPage;
