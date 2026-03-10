/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Program, ProgramDetail } from '@/types';

export const FOUNDATION_DETAIL: ProgramDetail = {
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

export const FUSION_PROGRAMS: Program[] = [
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
