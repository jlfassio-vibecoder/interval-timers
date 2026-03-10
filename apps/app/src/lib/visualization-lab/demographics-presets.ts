/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Demographics/theme preset prompts for Visualization Lab.
 */

export interface DemographicsPreset {
  id: string;
  label: string;
  text: string;
}

export interface DemographicsPresetGroup {
  group: string;
  options: DemographicsPreset[];
}

export const DEMOGRAPHICS_PRESETS: DemographicsPresetGroup[] = [
  {
    group: 'AI Fitcopilot Primary',
    options: [
      {
        id: 'primary-1',
        label: 'Female, 30s, CrossFit gym, Mission Bay',
        text: "Female Athlete, mid 30's, small sports bra and shorts, boutique crossfit style gym, harbor, Mission Bay, San Diego, California.",
      },
      {
        id: 'primary-2',
        label: 'Female, late 30s, outdoor park, Mission Bay',
        text: "Female Athlete, late 30's, micro sports bra and shorts, outdoor park, Mission Bay, San Diego, California.",
      },
      {
        id: 'primary-3',
        label: 'Male, 40s, CrossFit gym, Mission Bay',
        text: "Male Athlete, mid 40's, Tank Top and Board shorts, boutique crossfit style gym, harbor, Mission Bay, San Diego, California.",
      },
      {
        id: 'primary-4',
        label: 'Male, 40s, outdoor park, Mission Bay',
        text: "Male Athlete, mid 40's, Tank Top and Board shorts, outdoor park, Mission Bay, San Diego, California.",
      },
    ],
  },
  {
    group: 'Big Box Commercial Gym',
    options: [
      {
        id: 'bigbox-a',
        label: 'Black male, 30s, commercial gym',
        text: 'A muscular Black male, mid-30s. Crowded commercial gym environment, fluorescent overhead lighting, wearing a lifting belt and wrist wraps, chalk dust in the air, rows of dumbbells in the background.',
      },
      {
        id: 'bigbox-b',
        label: 'East Asian female, 20s, high-end club',
        text: 'A fit East Asian female, early 20s. High-end fitness club, gym mirror reflection, wearing matching teal activewear, ponytail, AirPods Pro, crowded background with blurred movement, modern LED lighting.',
      },
      {
        id: 'bigbox-c',
        label: 'White male, 40s, powerlifter style',
        text: 'A large, powerlifting-style White male, late 40s, with a thick beard and tattoos. Gritty commercial gym texture, wearing an oversized hoodie and sweatpants, water bottle in hand.',
      },
      {
        id: 'bigbox-d',
        label: 'South Asian female, 30s, high-end club',
        text: 'A South Asian female, mid-30s. High-end fitness club, floor-to-ceiling windows, natural light, high ponytail, wearing a sweat-wicking vest.',
      },
    ],
  },
  {
    group: 'Garage & Home Lab',
    options: [
      {
        id: 'garage-e',
        label: 'Hispanic male, 40s, garage gym',
        text: 'A lean Hispanic male, early 40s. Dimly lit garage gym, shafts of morning sunlight cutting through smoke/dust, wearing grey shorts and no shirt, sweat on skin, industrial concrete background.',
      },
      {
        id: 'garage-f',
        label: 'Black female, 50s, living room',
        text: 'A toned Black female, 50s. Modern living room, morning light, hardwood floors, barefoot, wearing yoga pants and a loose tank top, minimalist furniture.',
      },
      {
        id: 'garage-g',
        label: 'White male, 60s, backyard',
        text: 'A wiry, vascular White male, 60s (Silver Fox). Backyard setting, late afternoon golden hour lighting, grass stains on shoes, wearing a rucksack, gritty endurance vibe.',
      },
      {
        id: 'garage-h',
        label: 'Middle Eastern male, 20s, apartment',
        text: 'A Middle Eastern male, late 20s. Small apartment bedroom, tight framing, sweat dripping, wearing compression shorts, cluttered but functional space, natural window light.',
      },
    ],
  },
  {
    group: 'Age & Active Aging',
    options: [
      {
        id: 'age-i',
        label: '70-year-old White woman',
        text: 'A 70-year-old White woman with short white hair. Gym setting, wearing comfortable track pants and a cardigan, sharp focus.',
      },
      {
        id: 'age-j',
        label: '65-year-old Black man',
        text: 'A 65-year-old Black man with a grey beard. Gym background, wearing a vintage gym t-shirt, strong posture, chalk on hands.',
      },
      {
        id: 'age-k',
        label: '55-year-old Asian woman',
        text: 'A 55-year-old Asian woman, very fit/lean. Clean studio background, wearing professional athletic gear.',
      },
    ],
  },
  {
    group: 'Style & Aesthetic',
    options: [
      {
        id: 'style-bio',
        label: 'The Bio-Hacker',
        text: "Androgynous subject, pale skin. Futuristic gym lighting, clean lines, clinical 'lab' aesthetic, wearing a continuous glucose monitor (CGM) on arm and a chest strap heart monitor.",
      },
      {
        id: 'style-tactical',
        label: 'The Tactical Athlete',
        text: 'Mixed-race male, beard. Outdoor park setting, gritty texture, high contrast, sweat and dirt, wearing a weighted vest and cargo shorts, utilitarian vibe.',
      },
      {
        id: 'style-yoga',
        label: 'The Yoga/Mobility',
        text: 'Indian female, traditional features. Plant-filled studio background, soft diffused lighting, barefoot, wearing soft earth-tone fabrics.',
      },
      {
        id: 'style-bodybuilder',
        label: 'The Bodybuilder',
        text: 'Pacific Islander male, massive muscle mass. Dark gym background with spotlighting, veins popping, wearing a stringer tank top.',
      },
    ],
  },
  {
    group: 'Racial/Ethnic Specificity',
    options: [
      {
        id: 'ethnic-l',
        label: 'Native American male',
        text: 'Native American male, long dark hair tied back, athletic build. Forest background, natural light, outdoor trail environment.',
      },
      {
        id: 'ethnic-m',
        label: 'Afro-Caribbean female',
        text: 'Afro-Caribbean female, natural hair in a protective style. Outdoor track setting, bright colorful athletic wear, high energy.',
      },
      {
        id: 'ethnic-n',
        label: 'Nordic/Scandinavian male',
        text: 'Nordic/Scandinavian male, very pale skin, blonde buzz cut. Minimalist gym, cool toned lighting, icy blue eyes.',
      },
      {
        id: 'ethnic-o',
        label: 'Mediterranean female',
        text: 'Mediterranean female, olive skin, curly dark hair. Boxing gym background, gritty texture, cinematic lighting.',
      },
    ],
  },
];

/** Get preset text by id, or undefined if not found. */
export function getPresetTextById(id: string): string | undefined {
  for (const group of DEMOGRAPHICS_PRESETS) {
    const preset = group.options.find((o) => o.id === id);
    if (preset) return preset.text;
  }
  return undefined;
}
