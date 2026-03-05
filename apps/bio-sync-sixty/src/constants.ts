/** Base path for the app (no trailing slash). Use for building links; must match astro.config base and Vercel rewrites. */
export const BASE = '/bio-sync60';

export const PHASE_CONTENT = {
  1: {
      title: "Autonomic Alignment",
      subtitle: "Goal: Stabilize nervous system & establish baseline.",
      badge: "Days 1-20",
      checklist: [
          "30g Protein Anchor (Within 30m of waking)",
          "Rule 90/90/1 (Strict adherence)",
          "Digital Sunset (1 hr pre-sleep)",
          "Japanese Walking (30 mins)"
      ],
      move: {
          title: "Japanese Walking",
          desc: "3 mins brisk pace, 3 mins strolling. Repeat for 30 minutes.",
          why: "Improves VO2 Max without cortisol spikes."
      },
      vagal: {
          title: "Face Immersion (Tier 1)",
          desc: "Basin with ice water. 30-60s hold. The entry point for vagal tone."
      }
  },
  2: {
      title: "Metabolic Flexibility",
      subtitle: "Goal: Train cells to switch fuel sources efficiently.",
      badge: "Days 21-40",
      checklist: [
          "Shift Feeding Window (End by 6pm)",
          "Rucking Integration (2x/week)",
          "Functional Force (Bodyweight)",
          "Cold Shower Finishers"
      ],
      move: {
          title: "Rucking",
          desc: "Add 15-20lbs to your daily walk. Burns 3x calories of walking, builds posture.",
          why: "Increases caloric load without joint stress."
      },
      vagal: {
          title: "Cold Shower (Tier 2)",
          desc: "End every shower with 2 minutes of cold water. Focus on slow exhale to control panic response."
      }
  },
  3: {
      title: "Peak Functional Force",
      subtitle: "Goal: Maximize output & resilience.",
      badge: "Days 41-60",
      checklist: [
          "Full Cold Plunge (3-4x/week)",
          "Heavy Resistance (3x/week)",
          "Zone 2 Running / Heavy Ruck",
          "Maintain 10hr Feeding Window"
      ],
      move: {
          title: "Zone 2 / Heavy Lift",
          desc: "30-45 mins resistance training to preserve lean mass (GLP-1 Critical).",
          why: "Maximal adaptation phase."
      },
      vagal: {
          title: "Full Plunge (Tier 3)",
          desc: "Submersion to neck. 45-50°F for 3-5 minutes. Mental clarity & inflammation control."
      }
  }
};

export const LEVELS = {
  novice: { title: "Novice Protocol", cold: "Face Dip (Basin)", move: "Walking Only", lift: "Bodyweight Circuit" },
  inter: { title: "Intermediate Protocol", cold: "Cold Shower (2m)", move: "Rucking (20lbs)", lift: "3x Functional Force" },
  master: { title: "Mastery Protocol", cold: "Ice Plunge (3m)", move: "Zone 2 Run/Ruck", lift: "4x Hypertrophy" }
};

// 29% / VT1 claim: sourced from SYNC60_PROTOCOL_EXPERT_AUDIT_AND_RECOMMENDATIONS.md (Zone 2 / VT1 section). See docs/reference/mitochondrial-calibration-vt1.md.
export const CHART_DATA = [
  { name: 'Generic (220-Age)', value: 71, fill: '#D1D5DB' },
  { name: 'Sync60 (VT1)', value: 98, fill: '#2B4C59' },
];
