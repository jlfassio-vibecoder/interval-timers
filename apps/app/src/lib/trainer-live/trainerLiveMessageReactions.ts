import type { LucideIcon } from 'lucide-react';
import {
  Dumbbell,
  Flame,
  HandHeart,
  Heart,
  Medal,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';

/** Must match allowlist in `trainer_live_post_session_message` (migration). */
export const TRAINER_LIVE_REACTION_KEYS = [
  'leaderboard_climb',
  'leaderboard_hot',
  'leaderboard_medal',
  'intensity_fire',
  'intensity_zap',
  'intensity_lift',
  'motivation_heart',
  'motivation_nice',
  'motivation_sparkles',
  'motivation_hands',
] as const;

export type TrainerLiveReactionKey = (typeof TRAINER_LIVE_REACTION_KEYS)[number];

export type TrainerLiveReactionCategory = 'leaderboard' | 'intensity' | 'motivation';

export type TrainerLiveReactionPreset = {
  reactionKey: TrainerLiveReactionKey;
  category: TrainerLiveReactionCategory;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
};

const bright = {
  gold: 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]',
  orange: 'text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.4)]',
  rose: 'text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.4)]',
  violet: 'text-violet-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.45)]',
  emerald: 'text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]',
  sky: 'text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]',
};

export const TRAINER_LIVE_REACTION_PRESETS: TrainerLiveReactionPreset[] = [
  {
    reactionKey: 'leaderboard_climb',
    category: 'leaderboard',
    label: 'Moved up the board!',
    icon: Trophy,
    iconClassName: `${bright.gold} stroke-[2]`,
  },
  {
    reactionKey: 'leaderboard_hot',
    category: 'leaderboard',
    label: 'On a heater!',
    icon: TrendingUp,
    iconClassName: `${bright.orange} stroke-[2]`,
  },
  {
    reactionKey: 'leaderboard_medal',
    category: 'leaderboard',
    label: 'Podium pace!',
    icon: Medal,
    iconClassName: `${bright.sky} stroke-[2]`,
  },
  {
    reactionKey: 'intensity_fire',
    category: 'intensity',
    label: 'Full send!',
    icon: Flame,
    iconClassName: `${bright.orange} stroke-[2]`,
  },
  {
    reactionKey: 'intensity_zap',
    category: 'intensity',
    label: 'Turning it up!',
    icon: Zap,
    iconClassName: `${bright.violet} stroke-[2]`,
  },
  {
    reactionKey: 'intensity_lift',
    category: 'intensity',
    label: 'Strong work!',
    icon: Dumbbell,
    iconClassName: `${bright.emerald} stroke-[2]`,
  },
  {
    reactionKey: 'motivation_heart',
    category: 'motivation',
    label: 'Love this crew!',
    icon: Heart,
    iconClassName: `${bright.rose} stroke-[2]`,
  },
  {
    reactionKey: 'motivation_nice',
    category: 'motivation',
    label: "Let's go!",
    icon: ThumbsUp,
    iconClassName: `${bright.gold} stroke-[2]`,
  },
  {
    reactionKey: 'motivation_sparkles',
    category: 'motivation',
    label: 'Crushing it!',
    icon: Sparkles,
    iconClassName: `${bright.violet} stroke-[2]`,
  },
  {
    reactionKey: 'motivation_hands',
    category: 'motivation',
    label: "You've got this!",
    icon: HandHeart,
    iconClassName: `${bright.orange} stroke-[2]`,
  },
];

const presetByKey = new Map<string, TrainerLiveReactionPreset>(
  TRAINER_LIVE_REACTION_PRESETS.map((p) => [p.reactionKey, p])
);

export function getTrainerLiveReactionPreset(
  reactionKey: string | null | undefined
): TrainerLiveReactionPreset | null {
  if (reactionKey == null || reactionKey === '') return null;
  return presetByKey.get(reactionKey) ?? null;
}

const CATEGORY_LABEL: Record<TrainerLiveReactionCategory, string> = {
  leaderboard: 'Leaderboard',
  intensity: 'Intensity',
  motivation: 'Motivation',
};

export function groupPresetsByCategory(
  presets: TrainerLiveReactionPreset[]
): { category: TrainerLiveReactionCategory; label: string; items: TrainerLiveReactionPreset[] }[] {
  const order: TrainerLiveReactionCategory[] = ['leaderboard', 'intensity', 'motivation'];
  const map = new Map<TrainerLiveReactionCategory, TrainerLiveReactionPreset[]>();
  for (const c of order) map.set(c, []);
  for (const p of presets) {
    map.get(p.category)?.push(p);
  }
  return order.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: map.get(category) ?? [],
  }));
}
