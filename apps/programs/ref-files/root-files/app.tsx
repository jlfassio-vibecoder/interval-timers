/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Globe,
  Zap,
  Music,
  MapPin,
  Menu,
  X,
  Calendar,
  Play,
  ChevronLeft,
  ChevronRight,
  Target,
  Shield,
  Cpu,
  Clock,
  Dumbbell,
  Timer,
  ZapOff,
  Wind,
  ArrowUpRight,
  Activity,
  Layers,
  CheckCircle2,
  User,
  Award,
  BarChart3,
  Fingerprint,
  RefreshCcw,
  Lock,
  Star,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import FluidBackground from './components/FluidBackground';
import GradientText from './components/GlitchText';
import CustomCursor from './components/CustomCursor';
import ArtistCard from './components/ArtistCard';
import AIChat from './components/AIChat';
import {
  Artist,
  WorkoutDetail,
  Program,
  ProgramDetail,
  WorkoutLog,
  WorkoutComponent,
} from './types';

const IntensityBars: React.FC<{ level: number }> = ({ level }) => {
  const scale = [
    'bg-orange-100',
    'bg-orange-300',
    'bg-orange-500',
    'bg-orange-700',
    'bg-orange-900',
  ];

  return (
    <div className="flex h-4 items-end gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2 rounded-sm transition-all duration-500 ${i <= level ? scale[i - 1] : 'bg-white/10'}`}
          style={{ height: `${(i / 5) * 100}%` }}
        />
      ))}
    </div>
  );
};

const defaultWorkoutDetails: WorkoutDetail = {
  warmup: {
    title: 'Dynamic Mobilization',
    duration: '8 Minutes',
    exercises: [
      'Jumping Jacks',
      "World's Greatest Stretch",
      'Cat-Cow Transitions',
      'Bodyweight Squats',
      'Arm Circles',
    ],
  },
  main: {
    title: 'Metabolic Threshold Block',
    duration: '27 Minutes',
    exercises: [
      'Max Effort Sprints (45s)',
      'Active Recovery Plank (30s)',
      'Explosive Burpees (15 reps)',
      'Alternating Reverse Lunges',
      'Lateral Bounds',
    ],
  },
  finisher: {
    title: 'The Furnace finisher',
    duration: '5 Minutes',
    exercises: ['Tabata: Mountain Climbers vs. High Knees', 'Hold Hollow Body for 60s'],
  },
  cooldown: {
    title: 'Static Recovery & Pulse Drop',
    duration: '5 Minutes',
    exercises: [
      'Standing Quad Stretch',
      'Cross-Body Shoulder Stretch',
      "Child's Pose",
      'Deep Diaphragmatic Breathing',
    ],
  },
};

const FOUNDATION_DETAIL: ProgramDetail = {
  overview:
    "The 6-Week Foundation Kickstart is engineered for total system reboot. We focus on 'Neural Awakening'—re-establishing the brain-to-muscle connection, improving joint stability, and priming your metabolic engine for high-output work.",
  phases: [
    {
      weeks: 'Weeks 1-2',
      title: 'Neural Awakening',
      focus: 'Bio-mechanical Alignment',
      deliverables: [
        'Correcting postural imbalances',
        'Improving ankle and hip mobility',
        'Establishing core bracing mechanics',
        'Low-threshold aerobic base building',
      ],
    },
    {
      weeks: 'Weeks 3-4',
      title: 'Structural Integrity',
      focus: 'Load Tolerance & Stability',
      deliverables: [
        'Increasing time under tension',
        'Multi-planar functional movements',
        'Introducing moderate metabolic intervals',
        'Connective tissue strengthening',
      ],
    },
    {
      weeks: 'Weeks 5-6',
      title: 'Metabolic Prime',
      focus: 'Output Optimization',
      deliverables: [
        'High-intensity interval integration',
        'Complex movement sequencing',
        'Maximal aerobic capacity testing',
        'Transitioning to high-performance cycles',
      ],
    },
  ],
};

const WEEK_1_WORKOUTS: Artist[] = [
  {
    id: 'w1-d1',
    name: 'Neural Reset',
    genre: 'CNS Calibration',
    day: 'Week 1 Day 1',
    intensity: 2,
    image:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000&auto=format&fit=crop',
    description:
      'A dedicated focus on mobility and neurological readiness. Resetting the baseline for the weeks ahead.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      warmup: {
        ...defaultWorkoutDetails.warmup,
        exercises: ['Neck Rolls', 'Shoulder Shrugs', 'Thoracic Openers', 'Hip Circles'],
      },
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Neural Sync Circuits',
        exercises: [
          'Bird-Dogs (slow)',
          'Dead Bugs',
          'Glute Bridges (isomteric)',
          'Scapular Pushups',
        ],
      },
    },
  },
  {
    id: 'w1-d2',
    name: 'Biomechanical Loading',
    genre: 'Stability / Foundation',
    day: 'Week 1 Day 2',
    intensity: 3,
    image:
      'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=1000&auto=format&fit=crop',
    description:
      'Establishing structural integrity through isometric holds and foundational movement patterns.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Structural Load Testing',
        exercises: [
          'Tempo Air Squats (3:3:3)',
          'Static Lunge Hold',
          'Cossack Squats',
          'Bear Crawl Holds',
        ],
      },
    },
  },
  {
    id: 'w1-d3',
    name: 'Engine Primer',
    genre: 'Aerobic Base',
    day: 'Week 1 Day 3',
    intensity: 3,
    image:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop',
    description:
      'Low-intensity steady-state work combined with dynamic intervals to prime the oxidative system.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Oxidative Priming',
        exercises: ['Zone 2 Jog-in-place', 'Shadow Boxing', 'Light Burpees', 'Lateral Shuffle'],
      },
    },
  },
];

const WORKOUTS: Artist[] = [
  {
    id: '1',
    name: 'VO2 Max Destroyer',
    genre: 'Aerobic Threshold',
    day: 'Intensity',
    intensity: 5,
    image:
      'https://images.pexels.com/photos/1649691/pexels-photo-1649691.jpeg?_gl=1*i3xa2i*_ga*MjE0NTQyMDk5Mi4xNzYzMDYyMDM3*_ga_8JE65Q40S6*czE3NjMxNTk5MjAkbzYkZzEkdDE3NjMxNjE2MjkkajUxJGwwJGgw',
    description:
      'A relentless interval-based protocol designed to push your aerobic ceiling. This class utilizes high-intensity bouts with minimal recovery to optimize oxygen utilization.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Destroyer Intervals' },
    },
  },
  {
    id: '2',
    name: 'Lactic Acid Threshold',
    genre: 'Anaerobic Power',
    day: 'Intensity',
    intensity: 4,
    image:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop',
    description:
      'Train the body to buffer hydrogen ions and clear lactate efficiently. Expect sustained high-effort work that tests mental fortitude and metabolic efficiency.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Lactate Accumulation Sets' },
    },
  },
  {
    id: '3',
    name: 'Oxidative Core Ignition',
    genre: 'Functional Stability',
    day: 'Intensity',
    intensity: 3,
    image:
      'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop',
    description:
      'A multi-planar core workout that combines stability movements with aerobic components to ensure your engine is supported by a bulletproof chassis.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Multidimensional Core Core' },
    },
  },
  {
    id: '4',
    name: 'Kinetic MetCon 500',
    genre: 'Caloric Burn',
    day: 'Intensity',
    intensity: 5,
    image:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop',
    description:
      'The ultimate metabolic conditioning challenge. A high-volume circuit designed to burn 500+ calories while improving total body explosive power.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'The 500 Rep Gauntlet' },
    },
  },
  {
    id: '5',
    name: 'Neural Drive Sprint',
    genre: 'CNS Activation',
    day: 'Intensity',
    intensity: 4,
    image:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop',
    description:
      'Focused on Central Nervous System recruitment. Short, explosive bursts followed by complete recovery to maximize force production and speed.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Explosive CNS Bursts' },
    },
  },
  {
    id: '6',
    name: 'Ashen Active Recovery',
    genre: 'Metabolic Flush',
    day: 'Intensity',
    intensity: 1,
    image:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1000&auto=format&fit=crop',
    description:
      'Low-intensity steady-state movement designed to facilitate blood flow and nutrient delivery to recovering muscle tissue. Essential for high-performance longevity.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Cellular Repair Flush' },
    },
  },
];

const FUSION_PROGRAMS: Program[] = [
  {
    id: 'p1',
    name: '6-Week Foundation Kickstart',
    weeks: 6,
    description:
      'Build the fundamental movement patterns and neural recruitment required for elite conditioning. Perfect for reclaiming your baseline mobility and engine power.',
    image:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop',
    intensity: 3,
    focus: 'Fundamental Mechanics',
    programDetail: FOUNDATION_DETAIL,
  },
  {
    id: 'p2',
    name: '8-Week Shred Protocol',
    weeks: 8,
    description:
      'A high-density metabolic assault designed to maximize caloric expenditure while maintaining functional muscle mass. Leverage EPOC through calculated intensity waves.',
    image:
      'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=1000&auto=format&fit=crop',
    intensity: 4,
    focus: 'Fat Oxidation & Power',
  },
  {
    id: 'p3',
    name: '12-Week Solaris Mastery',
    weeks: 12,
    description:
      'The ultimate physical transformation journey. Phase-based training that evolves from stability to explosive power, concluding in a peak metabolic performance window.',
    image:
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=1000&auto=format&fit=crop',
    intensity: 5,
    focus: 'Elite Performance Peak',
  },
];

const App: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [showProgramsGrid, setShowProgramsGrid] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  // Dashboard / Activation States
  const [isActivating, setIsActivating] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  // Logging States
  const [showLogModal, setShowLogModal] = useState(false);
  const [effortValue, setEffortValue] = useState(5);
  const [ratingValue, setRatingValue] = useState(0);
  const [notesValue, setNotesValue] = useState('');
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<Set<string>>(new Set());

  const [purchasingIndex, setPurchasingIndex] = useState<number | null>(null);
  const [purchasedIndex, setPurchasedIndex] = useState<number | null>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showLogModal) {
        if (e.key === 'Escape') setShowLogModal(false);
        return;
      }
      if (selectedArtist) {
        if (e.key === 'Escape') setSelectedArtist(null);
        return;
      }
      if (selectedWeek !== null) {
        if (e.key === 'Escape') setSelectedWeek(null);
      } else if (showDashboard) {
        if (e.key === 'Escape') setShowDashboard(false);
      } else if (selectedProgram) {
        if (e.key === 'Escape') setSelectedProgram(null);
      } else if (showProgramsGrid && e.key === 'Escape') {
        setShowProgramsGrid(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedArtist,
    showProgramsGrid,
    selectedProgram,
    showDashboard,
    selectedWeek,
    showLogModal,
  ]);

  const handlePurchase = (index: number) => {
    setPurchasingIndex(index);
    setTimeout(() => {
      setPurchasingIndex(null);
      setPurchasedIndex(index);
    }, 3500);
  };

  const handleActivateProtocol = () => {
    setIsActivating(true);
    // Simulate tactical synchronization sequence
    setTimeout(() => {
      setIsActivating(false);
      setShowDashboard(true);
      setSelectedProgram(null);
      setShowProgramsGrid(false);
    }, 4000);
  };

  const handleSaveLog = () => {
    if (!selectedArtist) return;

    const newLog: WorkoutLog = {
      id: Math.random().toString(36).substr(2, 9),
      workoutId: selectedArtist.id,
      workoutName: selectedArtist.name,
      date: new Date().toLocaleDateString(),
      effort: effortValue,
      rating: ratingValue,
      notes: notesValue,
    };

    setWorkoutLogs([newLog, ...workoutLogs]);
    setCompletedWorkouts(new Set([...completedWorkouts, selectedArtist.id]));
    setShowLogModal(false);
    setSelectedArtist(null); // Close the detail modal too

    // Reset values
    setEffortValue(5);
    setRatingValue(0);
    setNotesValue('');
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative min-h-screen cursor-auto overflow-x-hidden text-white selection:bg-[#ffbf00] selection:text-black md:cursor-none">
      <CustomCursor />
      <FluidBackground />
      <AIChat />

      {/* Navigation */}
      <nav className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-6 mix-blend-difference md:px-8">
        <div className="z-50 cursor-default font-heading text-lg font-bold tracking-tighter text-white md:text-xl">
          AI FITCOPILOT
        </div>

        {/* Desktop Menu */}
        <div className="hidden gap-10 text-sm font-bold uppercase tracking-widest md:flex">
          {['Workouts', 'Programs', 'Complexes'].map((item) => (
            <button
              key={item}
              onClick={() =>
                scrollToSection(item === 'Complexes' ? 'complexes' : item.toLowerCase())
              }
              className="cursor-pointer border-none bg-transparent text-white transition-colors hover:text-[#ffbf00]"
              data-hover="true"
            >
              {item}
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollToSection('complexes')}
          className="hidden cursor-pointer border border-white bg-transparent px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black md:inline-block"
          data-hover="true"
        >
          Get Passes
        </button>

        {/* Mobile Menu Toggle */}
        <button
          className="relative z-50 flex h-10 w-10 items-center justify-center text-white md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-[#120800]/95 backdrop-blur-xl md:hidden"
          >
            {['Workouts', 'Programs', 'Complexes'].map((item) => (
              <button
                key={item}
                onClick={() =>
                  scrollToSection(item === 'Complexes' ? 'complexes' : item.toLowerCase())
                }
                className="border-none bg-transparent font-heading text-4xl font-bold uppercase text-white transition-colors hover:text-[#ffbf00]"
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => scrollToSection('complexes')}
              className="mt-8 border border-white bg-white px-10 py-4 text-sm font-bold uppercase tracking-widest text-black"
            >
              Get Passes
            </button>

            <div className="absolute bottom-10 flex gap-6">
              <a
                href="https://x.com/GoogleAIStudio"
                className="text-white/50 transition-colors hover:text-white"
              >
                Twitter
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <header className="relative flex h-[100svh] min-h-[600px] flex-col items-center justify-center overflow-hidden px-4">
        <motion.div
          style={{ y, opacity }}
          className="z-10 flex w-full max-w-6xl flex-col items-center pb-24 text-center md:pb-20"
        >
          {/* Date / Location */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-4 flex items-center gap-3 rounded-full bg-black/20 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-[#ffbf00] backdrop-blur-sm md:gap-6 md:text-base md:tracking-[0.3em]"
          >
            <span>ARMY PHYSICAL TRAINING</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff8000] md:h-2 md:w-2" />
            <span>Feb 2-6</span>
          </motion.div>

          {/* Main Title */}
          <div className="relative flex w-full items-center justify-center px-4">
            <GradientText
              text="AI FITCOPILOT"
              as="h1"
              className="text-center text-[10vw] font-black leading-[0.9] tracking-tighter md:text-[8vw]"
            />
            {/* Optimized Orb - Amber Glow */}
            <motion.div
              className="pointer-events-none absolute -z-20 h-[50vw] w-[50vw] rounded-full bg-[#ffa500]/10 blur-[40px] will-change-transform"
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 6, repeat: Infinity }}
              style={{ transform: 'translateZ(0)' }}
            />
          </div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, delay: 0.5, ease: 'circOut' }}
            className="mb-6 mt-4 h-px w-full max-w-md bg-gradient-to-r from-transparent via-[#ff8000]/50 to-transparent md:mb-8 md:mt-8"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mx-auto max-w-xl px-4 text-base font-light leading-relaxed text-white/90 drop-shadow-lg md:text-2xl"
          >
            The world's most intelligent workouts
          </motion.p>
        </motion.div>

        {/* MARQUEE - Orange background */}
        <div className="absolute bottom-12 left-0 z-20 w-full overflow-hidden border-y-4 border-black bg-[#ff8000] py-4 text-black shadow-[0_0_40px_rgba(255,128,0,0.4)] md:bottom-16 md:py-6">
          <motion.div
            className="flex w-fit will-change-transform"
            animate={{ x: '-50%' }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          >
            {[0, 1].map((key) => (
              <div key={key} className="flex shrink-0 whitespace-nowrap">
                {[...Array(4)].map((_, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-4 px-8 font-heading text-3xl font-black md:text-7xl"
                  >
                    AI Fitcopilot | AI-Powered Hypertrophy & Tactical Workout Programs.{' '}
                    <span className="text-2xl text-black md:text-4xl">●</span>
                    LIVE ONLINE CLASSES <span className="text-2xl text-black md:text-4xl">●</span>
                  </span>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* WORKOUTS SECTION */}
      <section id="workouts" className="relative z-10 py-20 md:py-32">
        <div className="mx-auto max-w-[1600px] px-4 md:px-6">
          <div className="mb-12 flex flex-col items-end justify-between px-4 md:mb-16 md:flex-row">
            <h2 className="w-full break-words font-heading text-5xl font-bold uppercase leading-[0.9] drop-shadow-lg md:w-auto md:text-8xl">
              METABOLIC <br />
              <span className="bg-gradient-to-r from-[#ffbf00] to-[#ff1500] bg-clip-text text-transparent">
                CONDITIONING
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 border-l border-t border-white/10 bg-black/20 backdrop-blur-sm md:grid-cols-2 lg:grid-cols-3">
            {WORKOUTS.map((workout) => (
              <ArtistCard
                key={workout.id}
                artist={workout}
                onClick={() => setSelectedArtist(workout)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* EXPERIENCE SECTION -> PROGRAMS */}
      <section
        id="programs"
        className="relative z-10 overflow-hidden border-t border-white/10 bg-black/20 py-20 backdrop-blur-sm md:py-32"
      >
        <div
          className="pointer-events-none absolute right-[-20%] top-1/2 h-[50vw] w-[50vw] rounded-full bg-[#ff4000]/20 blur-[40px] will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        />

        <div className="relative mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid grid-cols-1 items-center gap-12 md:gap-16 lg:grid-cols-12">
            <div className="order-2 lg:order-1 lg:col-span-5">
              <h2 className="mb-6 font-heading text-4xl font-bold leading-tight md:mb-8 md:text-7xl">
                Ignite <br /> <GradientText text="WORKOUTS" className="text-5xl md:text-8xl" />
              </h2>
              <p className="mb-8 text-lg font-light leading-relaxed text-gray-200 drop-shadow-md md:mb-12 md:text-xl">
                AI FITCOPILOT is the fusion of AI and 30 Years of professional fitness experience.
                We fuse cutting-edge AI fitness intelligence with human oversight and prompt
                engineering to create the most effective workouts possible.
              </p>

              <div className="space-y-6 md:space-y-8">
                {[
                  {
                    icon: Shield,
                    title: 'Steel Pit Drills',
                    desc: 'Uncompromising full-gear endurance in subterranean bunker environments.',
                  },
                  {
                    icon: Target,
                    title: 'Neural Recon',
                    desc: 'High-stakes tactical agility and split-second situational awareness.',
                  },
                  {
                    icon: Cpu,
                    title: 'Combat Engine',
                    desc: 'Real-time biometric optimization and AI-driven performance tracking.',
                  },
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-6">
                    <div className="rounded-2xl border border-white/5 bg-white/10 p-4 backdrop-blur-md">
                      <feature.icon className="h-6 w-6 text-[#ffa500]" />
                    </div>
                    <div>
                      <h4 className="mb-1 font-heading text-lg font-bold md:mb-2 md:text-xl">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-gray-300">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative order-1 h-[400px] w-full md:h-[700px] lg:order-2 lg:col-span-7">
              <div className="absolute inset-0 rotate-3 rounded-3xl bg-gradient-to-br from-[#ff8000] to-[#ff1500] opacity-30 blur-xl" />
              <div className="group relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000&auto=format&fit=crop"
                  alt="Crowd"
                  className="h-full w-full object-cover transition-transform duration-[1.5s] will-change-transform group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10">
                  <div className="bg-gradient-to-b from-white to-white/0 bg-clip-text font-heading text-4xl font-bold text-transparent opacity-50 md:text-6xl">
                    BODYWEIGHT
                  </div>
                  <div className="mt-2 text-lg font-bold uppercase tracking-widest text-white md:text-xl">
                    Fusion Zones
                  </div>
                </div>

                <button
                  onClick={() => setShowProgramsGrid(true)}
                  className="absolute bottom-6 right-6 flex transform items-center gap-2 rounded-full bg-[#ffbf00] px-6 py-3 text-xs font-bold uppercase tracking-widest text-black shadow-xl transition-all hover:scale-105 hover:bg-white md:bottom-10 md:right-10 md:text-sm"
                  data-hover="true"
                >
                  Review Programs <Play className="h-4 w-4 fill-current" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLEXES SECTION */}
      <section
        id="complexes"
        className="relative z-10 bg-black/30 px-4 py-20 backdrop-blur-lg md:px-6 md:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center md:mb-20">
            <h2 className="font-heading text-5xl font-bold text-white opacity-20 md:text-9xl">
              PASSES
            </h2>
            <p className="relative z-10 -mt-3 font-mono text-sm uppercase tracking-widest text-[#ffbf00] md:-mt-8 md:text-base">
              Choose your intensity
            </p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="mx-auto mt-8 flex w-fit flex-wrap justify-center gap-4 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xs uppercase tracking-widest text-white/60 backdrop-blur-sm md:gap-8 md:text-sm"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#ffbf00]" /> Live Online
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#ffbf00]" /> Mon / Wed / Fri
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#ffbf00]" /> 7am - 7:45 PST
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-[#ffbf00]" /> Bodyweight & Bands
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                name: 'Heat Pass',
                subtitle: '(1 Class)',
                price: '$7',
                color: 'white',
                accent: 'bg-white/5',
                features: ['Single Access', 'AI Generated Plan', 'Digital Token'],
              },
              {
                name: 'Flare Week',
                subtitle: '(3 Classes)',
                price: '$19',
                color: 'amber',
                accent: 'bg-[#ffbf00]/10 border-[#ffbf00]/50',
                features: ['Weekly Progression', 'Human Oversight', 'Prompt Support'],
              },
              {
                name: 'Solaris Elite',
                subtitle: '(12 Classes)',
                price: '$69',
                color: 'red',
                accent: 'bg-[#ff4000]/10 border-[#ff4000]/50',
                features: ['Monthly Mastery', 'Direct Coaching', 'Full Biometrics'],
              },
            ].map((ticket, i) => {
              const isPurchasing = purchasingIndex === i;
              const isPurchased = purchasedIndex === i;
              const isDisabled = purchasingIndex !== null || purchasedIndex !== null;

              return (
                <motion.div
                  key={i}
                  whileHover={isDisabled ? {} : { y: -20 }}
                  className={`relative flex min-h-[450px] flex-col border border-white/10 p-8 backdrop-blur-md transition-colors duration-300 md:min-h-[550px] md:p-10 ${ticket.accent} ${isDisabled && !isPurchased ? 'opacity-50 grayscale' : ''} will-change-transform`}
                  data-hover={!isDisabled}
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  <div className="flex-1">
                    <h3 className="mb-1 font-heading text-2xl font-bold text-white md:text-3xl">
                      {ticket.name}
                    </h3>
                    <p className="mb-4 font-mono text-xs uppercase text-white/50">
                      {ticket.subtitle}
                    </p>
                    <div
                      className={`mb-8 text-5xl font-bold tracking-tighter md:mb-10 md:text-6xl ${ticket.color === 'white' ? 'text-white' : ticket.color === 'amber' ? 'text-[#ffbf00]' : 'text-[#ff1500]'}`}
                    >
                      {ticket.price}
                    </div>
                    <ul className="space-y-4 text-sm text-gray-200 md:space-y-6">
                      {ticket.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                          {idx === 0 ? (
                            <Ticket className="h-5 w-5 text-gray-400" />
                          ) : idx === 1 ? (
                            <MapPin className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Zap className="h-5 w-5 text-gray-400" />
                          )}
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handlePurchase(i)}
                    disabled={isDisabled}
                    className={`group relative mt-8 w-full overflow-hidden border border-white/20 py-4 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
                      isPurchased
                        ? 'cursor-default border-[#ffbf00] bg-[#ffbf00] text-black'
                        : isPurchasing
                          ? 'cursor-wait bg-white/20 text-white'
                          : isDisabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    <span className="relative z-10">
                      {isPurchasing ? 'Processing...' : isPurchased ? 'Activated' : 'Activate'}
                    </span>
                    {!isDisabled && !isPurchased && !isPurchasing && (
                      <div className="absolute inset-0 -z-0 origin-left scale-x-0 transform bg-white transition-transform duration-300 ease-out group-hover:scale-x-100" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/10 bg-black/80 py-12 backdrop-blur-xl md:py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 font-heading text-xl font-bold tracking-tighter text-white md:text-2xl">
              AI FITCOPILOT
            </div>
            <div className="flex gap-2 font-mono text-xs text-gray-400">
              <span>created by @chanelluuh</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 md:gap-8">
            <a
              href="https://x.com/GoogleAIStudio"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-[#ffbf00]"
              data-hover="true"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>

      {/* BIOMETRIC SCAN OVERLAY */}
      <AnimatePresence>
        {isActivating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex cursor-wait flex-col items-center justify-center bg-[#0d0500] p-10"
          >
            <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

            <motion.div
              className="absolute z-20 h-1 w-full bg-[#ffbf00] shadow-[0_0_20px_#ffbf00]"
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />

            <div className="relative z-10 flex flex-col items-center gap-8 text-center">
              <Fingerprint className="h-24 w-24 animate-pulse text-[#ffbf00]" />
              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-black uppercase tracking-tighter text-white md:text-4xl">
                  Analyzing Biometrics
                </h2>
                <p className="animate-pulse font-mono text-xs uppercase tracking-[0.4em] text-[#ffbf00] md:text-sm">
                  Synchronizing Neural Drive...
                </p>
              </div>

              <div className="h-1 w-64 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#ffbf00] to-[#ff4000]"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3.5, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROTOCOL DASHBOARD OVERLAY */}
      <AnimatePresence>
        {showDashboard && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[90] cursor-auto overflow-y-auto bg-[#0d0500] px-6 pb-12 pt-24"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-12">
              {/* Dashboard Header */}
              <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-10 md:flex-row md:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-3 text-[#ffbf00]">
                    <Activity className="h-5 w-5 animate-pulse" />
                    <span className="font-mono text-xs uppercase tracking-[0.4em]">
                      Operational Status: Active
                    </span>
                  </div>
                  <h2 className="font-heading text-4xl font-black uppercase leading-none text-white md:text-7xl">
                    Protocol Dashboard
                  </h2>
                </div>
                <button
                  onClick={() => setShowDashboard(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
                >
                  Terminate Session
                </button>
              </div>

              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                {/* Left: Biometrics */}
                <div className="space-y-6 lg:col-span-3">
                  <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                    Live Biometric Feed
                  </h4>
                  <div className="space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs uppercase text-white/50">
                          Heart Rate
                        </span>
                        <span className="font-bold text-[#ffbf00]">142 BPM</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full bg-[#ffbf00]"
                          animate={{ width: ['70%', '85%', '70%'] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs uppercase text-white/50">CNS Load</span>
                        <span className="text-orange-500 font-bold">88%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="bg-orange-500 h-full"
                          animate={{ width: ['80%', '92%', '80%'] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs uppercase text-white/50">
                          Metabolic Efficiency
                        </span>
                        <span className="font-bold text-red-500">94.2</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full bg-red-500"
                          animate={{ width: ['90%', '96%', '90%'] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#ffbf00]/20 bg-[#ffbf00]/5 p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <User className="h-5 w-5 text-[#ffbf00]" />
                      <h5 className="font-heading text-xs font-bold uppercase">Cadet Stats</h5>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between font-mono text-[10px] uppercase">
                        <span className="text-white/40">Total Workouts</span>
                        <span>{workoutLogs.length} / 18</span>
                      </div>
                      <div className="flex justify-between font-mono text-[10px] uppercase">
                        <span className="text-white/40">Efficiency Rank</span>
                        <span>
                          {workoutLogs.length > 5
                            ? 'Vanguard'
                            : workoutLogs.length > 2
                              ? 'Elite'
                              : 'Recruit'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* History List */}
                  <div className="space-y-4">
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                      Operational History
                    </h4>
                    {workoutLogs.length === 0 ? (
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center font-mono text-[10px] uppercase italic text-white/20">
                        No logs recorded
                      </div>
                    ) : (
                      workoutLogs.slice(0, 3).map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold uppercase text-[#ffbf00]">
                              {log.workoutName}
                            </span>
                            <span className="font-mono text-[10px] uppercase text-white/30">
                              {log.date}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-2.5 w-2.5 ${i < log.rating ? 'fill-current text-[#ffbf00]' : 'text-white/10'}`}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Center: Mission Hub */}
                <div className="space-y-8 lg:col-span-6">
                  <AnimatePresence mode="wait">
                    {selectedWeek === null ? (
                      <motion.div
                        key="mission-hub"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="group relative"
                      >
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#ffbf00] to-[#ff4000] opacity-20 blur-2xl transition-opacity group-hover:opacity-30" />
                        <div className="relative rounded-3xl border border-white/10 bg-black/40 p-10 backdrop-blur-md">
                          <div className="mb-8 flex items-start justify-between">
                            <div>
                              <span className="mb-2 block font-mono text-xs uppercase tracking-[0.4em] text-[#ffbf00]">
                                Current Mission
                              </span>
                              <h3 className="font-heading text-3xl font-black uppercase text-white">
                                Neural Awakening
                              </h3>
                              <p className="mt-1 font-mono text-xs uppercase text-white/50">
                                Week 1 ● Day 1 ● Structural Alignment
                              </p>
                            </div>
                            <Award className="h-10 w-10 text-[#ffbf00]" />
                          </div>

                          <div className="mb-12 space-y-6">
                            <div className="flex items-start gap-4">
                              <div
                                className={`rounded-lg border p-3 transition-colors ${checkedIn ? 'border-[#ffbf00] bg-[#ffbf00] text-black' : 'border-white/10 bg-white/5 text-white/40'}`}
                              >
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                              <div>
                                <h6 className="font-bold text-white">Neural Drive Calibration</h6>
                                <p className="text-sm text-white/50">
                                  8-minute dynamic mobilization sequence focusing on posterior chain
                                  recruitment.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/40">
                                <Zap className="h-5 w-5" />
                              </div>
                              <div>
                                <h6 className="font-bold text-white">The Engine Block</h6>
                                <p className="text-sm italic text-gray-500">
                                  Locked until check-in complete...
                                </p>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setCheckedIn(!checkedIn)}
                            className={`flex w-full items-center justify-center gap-3 rounded-xl py-5 text-sm font-black uppercase tracking-widest transition-all ${
                              checkedIn
                                ? 'cursor-default border border-[#ffbf00]/30 bg-white/10 text-[#ffbf00]'
                                : 'bg-white text-black hover:bg-[#ffbf00]'
                            }`}
                          >
                            {checkedIn ? (
                              <>
                                MISSION LOGGED <CheckCircle2 className="h-5 w-5" />
                              </>
                            ) : (
                              <>
                                START OPERATIONAL DAY <RefreshCcw className="h-5 w-5" />
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="week-workouts"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-heading text-2xl font-black uppercase text-white">
                              Week {selectedWeek} Workouts
                            </h3>
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ffbf00]">
                              Deployment Grid
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedWeek(null)}
                            className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/40 transition-colors hover:text-white"
                          >
                            <ChevronLeft className="h-4 w-4" /> Back to Hub
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                          {WEEK_1_WORKOUTS.map((workout) => {
                            const isDone = completedWorkouts.has(workout.id);
                            return (
                              <motion.div
                                key={workout.id}
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setSelectedArtist(workout)}
                                className={`group relative flex h-40 w-full cursor-pointer items-center overflow-hidden rounded-3xl border px-8 shadow-2xl transition-all ${isDone ? 'border-[#ffbf00] bg-[#ffbf00]/5 shadow-[#ffbf00]/5' : 'border-white/10 bg-black/40 hover:border-[#ffbf00]/30'}`}
                              >
                                <div className="absolute inset-0 overflow-hidden">
                                  <img
                                    src={workout.image}
                                    className="h-full w-full object-cover opacity-20 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-40"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
                                </div>

                                <div className="relative z-10 flex-1">
                                  <div className="mb-3 flex items-center gap-4">
                                    <div className="rounded-lg bg-white/10 p-2 backdrop-blur-md">
                                      {isDone ? (
                                        <CheckCircle2 className="h-4 w-4 text-[#ffbf00]" />
                                      ) : (
                                        <Target className="h-4 w-4 text-white/40" />
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffbf00]">
                                        Session 0{workout.id.split('-d')[1]}
                                      </span>
                                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                                        {workout.genre}
                                      </span>
                                    </div>
                                  </div>
                                  <h4 className="font-heading text-2xl font-black uppercase text-white transition-colors group-hover:text-[#ffbf00]">
                                    {workout.name}
                                  </h4>
                                  {isDone && (
                                    <span className="absolute right-4 top-4 rotate-12 rounded border border-[#ffbf00]/50 bg-black/50 px-2 py-1 font-mono text-[10px] font-black text-[#ffbf00]">
                                      COMPLETED
                                    </span>
                                  )}
                                </div>

                                <div className="relative z-10 flex flex-col items-end gap-3">
                                  <IntensityBars level={workout.intensity} />
                                  <div
                                    className={`rounded-full p-4 transition-all ${isDone ? 'bg-[#ffbf00] text-black' : 'bg-white/5 text-white/40 group-hover:bg-white group-hover:text-black'}`}
                                  >
                                    <Play className="h-5 w-5 fill-current" />
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                      <TrendingUp className="mx-auto mb-2 h-6 w-6 text-[#ffbf00]" />
                      <div className="font-mono text-[10px] uppercase text-white/40">
                        Efficiency Prime
                      </div>
                      <div className="text-xl font-bold">94.8%</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                      <BarChart3 className="mx-auto mb-2 h-6 w-6 text-[#ffbf00]" />
                      <div className="font-mono text-[10px] uppercase text-white/40">
                        Total Sessions
                      </div>
                      <div className="text-xl font-bold">{workoutLogs.length}</div>
                    </div>
                  </div>
                </div>

                {/* Right: Map & Timeline */}
                <div className="space-y-6 lg:col-span-3">
                  <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                    Deployment Timeline
                  </h4>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((week) => {
                      const isUnlocked = week === 1;
                      const isActive = selectedWeek === week;

                      return (
                        <button
                          key={week}
                          disabled={!isUnlocked}
                          onClick={() => setSelectedWeek(isActive ? null : week)}
                          className={`group/week flex w-full items-center justify-between rounded-xl border p-4 transition-all ${
                            isActive
                              ? 'border-[#ffbf00] bg-[#ffbf00] text-black shadow-[0_0_20px_rgba(255,191,0,0.4)]'
                              : isUnlocked
                                ? 'border-[#ffbf00]/30 bg-[#ffbf00]/10 text-white hover:bg-[#ffbf00]/20'
                                : 'cursor-not-allowed border-white/10 bg-white/5 text-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${isActive ? 'bg-black text-[#ffbf00]' : isUnlocked ? 'bg-[#ffbf00] text-black' : 'bg-white/5'}`}
                            >
                              {week}
                            </span>
                            <span
                              className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-black' : ''}`}
                            >
                              Week {week}
                            </span>
                          </div>
                          {isUnlocked ? (
                            isActive ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Target className="h-4 w-4 text-[#ffbf00]" />
                            )
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOG WORKOUT MODAL */}
      <AnimatePresence>
        {showLogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogModal(false)}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/95 p-6 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-[#ffbf00]/30 bg-[#0d0500] p-8 shadow-[0_0_50px_rgba(255,191,0,0.1)] md:p-12"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-[#ffbf00] to-transparent" />

              <div className="mb-10 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-3xl font-black uppercase tracking-tighter text-white">
                    Mission Log
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#ffbf00]">
                    Post-Operational Review
                  </span>
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="rounded-full bg-white/5 p-3 transition-colors hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-10">
                <div>
                  <div className="mb-4 flex items-end justify-between">
                    <label className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                      Bio-Stress (Effort)
                    </label>
                    <span className="font-mono text-2xl font-black text-[#ffbf00]">
                      {effortValue}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={effortValue}
                    onChange={(e) => setEffortValue(parseInt(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/5 accent-[#ffbf00]"
                  />
                </div>

                <div>
                  <label className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                    System Output (Rating)
                  </label>
                  <div className="flex justify-center gap-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRatingValue(star)}
                        className="transition-all hover:scale-110 active:scale-90"
                      >
                        <Star
                          className={`h-12 w-12 transition-colors ${ratingValue >= star ? 'fill-[#ffbf00] text-[#ffbf00]' : 'text-white/5'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                    Tactical Notes
                  </label>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Log metabolic state, joint integrity, or engine feedback..."
                    className="h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white placeholder-white/20 transition-all focus:border-[#ffbf00]/50 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveLog}
                  className="group flex w-full items-center justify-center gap-4 rounded-2xl bg-[#ffbf00] py-6 font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-all hover:bg-white"
                >
                  Record Protocol Data{' '}
                  <TrendingUp className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BODYWEIGHT FUSION GRID */}
      <AnimatePresence>
        {showProgramsGrid && !selectedProgram && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] overflow-y-auto bg-black/95 px-4 py-20 backdrop-blur-2xl md:px-8"
          >
            <div className="mx-auto max-w-7xl">
              <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <h2 className="mb-2 font-heading text-4xl font-bold uppercase tracking-tighter text-white md:text-7xl">
                    Bodyweight Fusion
                  </h2>
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#ffbf00]">
                    Tactical Progression Architect
                  </p>
                </div>
                <button
                  onClick={() => setShowProgramsGrid(false)}
                  className="rounded-full border border-white/10 bg-white/5 p-5 text-white transition-all hover:bg-white hover:text-black"
                >
                  <X className="h-8 w-8" />
                </button>
              </div>

              <div className="grid grid-cols-1 border-l border-t border-white/10 md:grid-cols-2 lg:grid-cols-3">
                {FUSION_PROGRAMS.map((program) => (
                  <motion.div
                    key={program.id}
                    onClick={() => program.programDetail && setSelectedProgram(program)}
                    className="group relative h-[450px] w-full cursor-pointer overflow-hidden border-b border-r border-white/10 bg-black md:h-[550px]"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                  >
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={program.image}
                        alt={program.name}
                        className="h-full w-full object-cover opacity-40 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    </div>

                    <div className="absolute inset-0 flex flex-col justify-between p-8">
                      <div className="flex items-start justify-between">
                        <div className="rounded bg-[#ffbf00] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-black">
                          {program.weeks} Weeks
                        </div>
                        <IntensityBars level={program.intensity} />
                      </div>

                      <div>
                        <h3 className="mb-4 font-heading text-2xl font-bold uppercase leading-none tracking-tighter text-white transition-colors group-hover:text-[#ffbf00] md:text-4xl">
                          {program.name}
                        </h3>
                        <p className="mb-6 line-clamp-3 text-sm font-light leading-relaxed text-gray-400">
                          {program.description}
                        </p>
                        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                            {program.focus}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-white transition-colors group-hover:text-[#ffbf00]">
                            {program.programDetail ? 'Review Program' : 'Coming Soon'}{' '}
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROGRAM DETAIL */}
      <AnimatePresence>
        {selectedProgram && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[80] cursor-auto overflow-y-auto bg-[#0d0500]"
          >
            <div className="relative h-[40vh] w-full md:h-[60vh]">
              <img
                src={selectedProgram.image}
                alt={selectedProgram.name}
                className="h-full w-full object-cover opacity-50 grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0500] to-transparent" />

              <div className="absolute left-10 right-10 top-10 flex items-center justify-between">
                <button
                  onClick={() => setSelectedProgram(null)}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white hover:text-black"
                >
                  <ChevronLeft className="h-4 w-4" /> Back to Lineup
                </button>
                <div className="hidden items-center gap-4 rounded-full border border-white/10 bg-black/40 px-6 py-3 backdrop-blur-md md:flex">
                  <span className="font-mono text-xs uppercase tracking-tighter text-[#ffbf00]">
                    Intensity Level
                  </span>
                  <IntensityBars level={selectedProgram.intensity} />
                </div>
              </div>

              <div className="absolute bottom-12 left-10 right-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="mb-4 font-heading text-4xl font-black uppercase leading-none tracking-tighter text-white drop-shadow-2xl md:text-9xl">
                    {selectedProgram.name}
                  </h2>
                  <div className="flex items-center gap-6">
                    <span className="rounded bg-[#ffbf00] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                      {selectedProgram.weeks} WEEK OPERATIONAL WINDOW
                    </span>
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
                      {selectedProgram.focus}
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-12">
              <div className="space-y-12 lg:col-span-5">
                <section>
                  <h4 className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-[#ffbf00]">
                    <Layers className="h-4 w-4" /> Operational Overview
                  </h4>
                  <p className="text-xl font-light italic leading-tight text-gray-200 md:text-3xl">
                    "{selectedProgram.programDetail?.overview}"
                  </p>
                </section>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                    <Cpu className="mb-4 h-8 w-8 text-[#ffbf00]" />
                    <h5 className="mb-2 font-heading text-sm font-bold uppercase">Neural Rec</h5>
                    <p className="text-[10px] uppercase leading-relaxed tracking-widest text-white/40">
                      Optimization of CNS motor recruitment.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                    <Activity className="mb-4 h-8 w-8 text-[#ffbf00]" />
                    <h5 className="mb-2 font-heading text-sm font-bold uppercase">Bio-Feedback</h5>
                    <p className="text-[10px] uppercase leading-relaxed tracking-widest text-white/40">
                      Real-time HRV and efficiency tracking.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleActivateProtocol}
                  className="w-full rounded-3xl bg-gradient-to-r from-[#ffbf00] to-[#ff4000] py-8 font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_50px_rgba(255,191,0,0.2)] transition-transform hover:scale-[1.02]"
                >
                  Activate Protocol Now
                </button>
              </div>

              <div className="space-y-12 lg:col-span-7">
                <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                  Program Phases
                </h4>
                {selectedProgram.programDetail?.phases.map((phase, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group relative border-l border-white/10 pb-16 pl-12 last:pb-0"
                  >
                    <div className="absolute left-[-7px] top-0 h-[14px] w-[14px] rounded-full bg-[#ffbf00] shadow-[0_0_20px_#ffbf00]" />
                    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ffbf00]">
                          {phase.weeks}
                        </span>
                        <h5 className="font-heading text-4xl font-bold uppercase leading-none tracking-tighter text-white transition-colors group-hover:text-[#ffbf00]">
                          {phase.title}
                        </h5>
                      </div>
                      <span className="h-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                        {phase.focus}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {phase.deliverables.map((item, dIdx) => (
                        <div
                          key={dIdx}
                          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 transition-all hover:border-[#ffbf00]/30"
                        >
                          <div className="h-2 w-2 rounded-full bg-[#ffbf00] shadow-[0_0_10px_#ffbf00]" />
                          <span className="text-xs font-bold uppercase leading-relaxed tracking-widest text-gray-400">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WORKOUT DETAIL MODAL */}
      <AnimatePresence>
        {selectedArtist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedArtist(null)}
            className="fixed inset-0 z-[120] flex cursor-auto items-center justify-center overflow-y-auto bg-black/95 pb-10 pt-20 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="relative mx-4 flex w-full max-w-7xl flex-col overflow-hidden rounded-[3rem] border border-white/10 bg-[#0d0500] shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
            >
              <div className="relative h-64 w-full shrink-0 md:h-[32rem]">
                <img
                  src={selectedArtist.image}
                  alt={selectedArtist.name}
                  className="h-full w-full object-cover opacity-40 grayscale transition-opacity group-hover:opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0500] via-[#0d0500]/40 to-transparent" />

                <button
                  onClick={() => setSelectedArtist(null)}
                  className="absolute right-10 top-10 z-20 rounded-full border border-white/10 bg-black/50 p-5 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
                >
                  <X className="h-6 w-6" />
                </button>

                <div className="absolute bottom-12 left-12 right-12">
                  <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
                    <div>
                      <div className="mb-4 flex items-center gap-4 text-[#ffbf00]">
                        <span className="rounded bg-[#ffbf00]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.4em]">
                          Protocol {selectedArtist.day}
                        </span>
                        <IntensityBars level={selectedArtist.intensity} />
                      </div>
                      <h3 className="font-heading text-5xl font-black uppercase leading-none tracking-tighter text-white drop-shadow-2xl md:text-9xl">
                        {selectedArtist.name}
                      </h3>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                        Target Volume
                      </span>
                      <span className="text-5xl font-black tracking-tighter text-[#ffbf00]">
                        45:00
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-20 overflow-y-auto p-12 md:p-20 lg:grid-cols-12">
                <div className="space-y-12 lg:col-span-4">
                  <section>
                    <h4 className="mb-6 border-b border-[#ffbf00]/20 pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-[#ffbf00]">
                      Mission Parameters
                    </h4>
                    <p className="text-xl font-light italic leading-relaxed text-gray-300">
                      "{selectedArtist.description}"
                    </p>
                  </section>

                  <div className="space-y-10 rounded-3xl border border-white/5 bg-white/5 p-8">
                    <div className="flex items-center gap-6">
                      <div className="rounded-2xl bg-[#ffbf00]/10 p-4">
                        <Timer className="h-6 w-6 text-[#ffbf00]" />
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                          Window
                        </div>
                        <div className="text-xl font-bold">45 Minutes</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="rounded-2xl bg-[#ffbf00]/10 p-4">
                        <ZapOff className="h-6 w-6 text-[#ffbf00]" />
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                          Rest Load
                        </div>
                        <div className="text-xl font-bold">Compressed</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <button
                      onClick={() => setShowLogModal(true)}
                      className="flex w-full items-center justify-center gap-4 rounded-2xl bg-[#ffbf00] py-6 font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-transform hover:scale-[1.02]"
                    >
                      Log Session Data <ClipboardList className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setSelectedArtist(null)}
                      className="w-full rounded-xl border border-white/10 py-4 font-mono text-[10px] uppercase tracking-widest text-white/30 transition-all hover:bg-white/5"
                    >
                      Abort View
                    </button>
                  </div>
                </div>

                <div className="space-y-16 lg:col-span-8">
                  {Object.entries(selectedArtist.workoutDetail || {}).map(
                    ([key, blockValue], idx) => {
                      // Cast blockValue to WorkoutComponent to fix TS error: Property 'title' does not exist on type 'unknown'.
                      const block = blockValue as WorkoutComponent;
                      const colors = [
                        { text: 'text-[#ffbf00]', bg: 'bg-[#ffbf00]', shadow: 'shadow-[#ffbf00]' },
                        {
                          text: 'text-orange-500',
                          bg: 'bg-orange-500',
                          shadow: 'shadow-orange-500',
                        },
                        { text: 'text-red-600', bg: 'bg-red-600', shadow: 'shadow-red-600' },
                        { text: 'text-white', bg: 'bg-white', shadow: 'shadow-white' },
                      ];
                      const color = colors[idx] || colors[0];

                      return (
                        <div
                          key={key}
                          className="group/item relative border-l border-white/10 pl-12"
                        >
                          <div
                            className={`absolute left-[-8px] top-0 h-4 w-4 rounded-full ${color.bg} shadow-[0_0_15px] ${color.shadow}`}
                          />
                          <div className="mb-8 flex items-start justify-between">
                            <div>
                              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                                Phase 0{idx + 1}
                              </span>
                              <h5
                                className={`font-heading text-4xl font-black uppercase leading-none tracking-tighter ${color.text}`}
                              >
                                {block.title}
                              </h5>
                            </div>
                            <span
                              className={`${color.text} rounded border border-current px-3 py-1 font-mono text-xs tracking-widest`}
                            >
                              {block.duration}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {block.exercises.map((ex, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 text-sm text-white/80 transition-all hover:border-[#ffbf00]/30"
                              >
                                <span className="font-mono text-[10px] text-white/20">
                                  {(i + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="font-bold uppercase tracking-widest">{ex}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
