/**
 * Client-side equipment and zones. Replaces firebase/admin/equipment.
 *
 * RLS (see RUN_EQUIPMENT_MIGRATIONS.sql / 20260303130000): SELECT for any authenticated user;
 * INSERT/UPDATE/DELETE only for users in public.admin_users. No FOR ALL for anon or plain authenticated.
 * When tables do not exist (404/42P01), functions return empty data so the UI can show setup instructions.
 */

import { supabase } from '../client';

function isTableMissingError(
  err: { code?: string; message?: string; status?: number } | null
): boolean {
  if (!err) return false;
  if (err.code === '42P01') return true;
  if ((err as { status?: number }).status === 404) return true;
  if (typeof err.message === 'string' && err.message.includes('does not exist')) return true;
  return false;
}

export type EquipmentCategoryCode =
  | 'free_weights'
  | 'machines'
  | 'cables_bands'
  | 'bodyweight'
  | 'benches_racks'
  | 'conditioning'
  | 'functional_training';

export interface EquipmentCategory {
  code: EquipmentCategoryCode;
  commonTerm: string;
  technicalTerm: string;
  examples: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategoryCode;
  /** Optional tags (e.g. safety_features for racks with pins/straps). Empty if column missing. */
  tags?: string[];
  /** Optional pulley ratio for cable machines (e.g. "2:1"). */
  pulley_ratio?: string | null;
}

export interface Zone {
  id: string;
  name: string;
  category: 'domestic' | 'commercial' | 'amenity' | 'outdoor';
  description: string;
  biomechanicalConstraints: string[];
  equipmentIds: string[];
  createdAt: Date;
}

interface EquipmentRow {
  id: string;
  name: string;
  category: string;
  tags?: string[] | null;
  pulley_ratio?: string | null;
}

interface ZoneRow {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  biomechanical_constraints?: string[] | null;
  equipment_ids?: string[] | null;
  created_at?: string | null;
}

function mapEquipment(row: EquipmentRow): EquipmentItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as EquipmentItem['category'],
    tags: row.tags ?? [],
    pulley_ratio: row.pulley_ratio ?? undefined,
  };
}

function mapZone(row: ZoneRow): Zone {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Zone['category'],
    description: row.description ?? '',
    biomechanicalConstraints: row.biomechanical_constraints ?? [],
    equipmentIds: row.equipment_ids ?? [],
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

const EQUIPMENT_CATEGORIES_FALLBACK: EquipmentCategory[] = [
  {
    code: 'free_weights',
    commonTerm: 'Free Weights',
    technicalTerm: 'Isoinertial',
    examples: 'Barbells, Dumbbells, Kettlebells',
  },
  {
    code: 'machines',
    commonTerm: 'Machines',
    technicalTerm: 'Mechanically Guided',
    examples: 'Selectorized (pin-loaded) and plate-loaded equipment',
  },
  {
    code: 'cables_bands',
    commonTerm: 'Cables & Bands',
    technicalTerm: 'Variable/Constant Tension',
    examples: 'Functional trainers, resistance bands, pulleys',
  },
  {
    code: 'bodyweight',
    commonTerm: 'Bodyweight',
    technicalTerm: 'Closed-Kinetic Chain',
    examples: 'Pull-up bars, rings, dip stations, floor space',
  },
  {
    code: 'benches_racks',
    commonTerm: 'Benches & Racks',
    technicalTerm: 'Structural/Utility',
    examples: 'Power cages, adjustable benches, squat stands',
  },
  {
    code: 'conditioning',
    commonTerm: 'Conditioning',
    technicalTerm: 'Metabolic Ergometers',
    examples: 'Rowers, bikes, treadmills, stair climbers',
  },
  {
    code: 'functional_training',
    commonTerm: 'Functional Training',
    technicalTerm: 'Multi-Planar / Task-Specific',
    examples: 'Medicine balls, battle ropes, sleds, stability balls, weight vests',
  },
];

export async function getEquipmentCategories(): Promise<EquipmentCategory[]> {
  const { data, error } = await supabase
    .from('equipment_categories')
    .select('code, common_term, technical_term, examples')
    .order('code');
  if (error && isTableMissingError(error)) return EQUIPMENT_CATEGORIES_FALLBACK;
  if (error) throw error;
  const mapped = (data ?? []).map(
    (row: { code: string; common_term: string; technical_term: string; examples: string }) => ({
      code: row.code as EquipmentCategoryCode,
      commonTerm: row.common_term,
      technicalTerm: row.technical_term,
      examples: row.examples,
    })
  );
  return mapped.length > 0 ? mapped : EQUIPMENT_CATEGORIES_FALLBACK;
}

export async function getAllEquipmentItems(): Promise<EquipmentItem[]> {
  const { data, error } = await supabase.from('equipment_inventory').select('*');
  if (error && !isTableMissingError(error)) throw error;
  return (data ?? []).map(mapEquipment);
}

export async function createEquipmentItem(data: Omit<EquipmentItem, 'id'>): Promise<string> {
  const payload: Record<string, unknown> = { name: data.name, category: data.category };
  if (data.tags != null) payload.tags = data.tags;
  if (data.pulley_ratio != null) payload.pulley_ratio = data.pulley_ratio;
  const { data: row, error } = await supabase
    .from('equipment_inventory')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateEquipmentItem(
  id: string,
  data: Partial<Pick<EquipmentItem, 'name' | 'category' | 'tags' | 'pulley_ratio'>>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (data.name != null) payload.name = data.name;
  if (data.category != null) payload.category = data.category;
  if (data.tags != null) payload.tags = data.tags;
  if (data.pulley_ratio !== undefined) payload.pulley_ratio = data.pulley_ratio;
  const { error } = await supabase.from('equipment_inventory').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteEquipmentItem(id: string): Promise<void> {
  const { error } = await supabase.from('equipment_inventory').delete().eq('id', id);
  if (error) throw error;
}

export async function getAllZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from('equipment_zones').select('*');
  if (error && !isTableMissingError(error)) throw error;
  return (data ?? []).map(mapZone);
}

export async function getZoneById(id: string): Promise<Zone | null> {
  const { data, error } = await supabase.from('equipment_zones').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapZone(data) : null;
}

export async function createZone(data: Omit<Zone, 'id' | 'createdAt'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('equipment_zones')
    .insert({
      name: data.name,
      category: data.category,
      description: data.description,
      biomechanical_constraints: data.biomechanicalConstraints ?? [],
      equipment_ids: data.equipmentIds ?? [],
    })
    .select('id')
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateZone(
  id: string,
  data: Partial<Omit<Zone, 'id' | 'createdAt'>>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (data.name != null) payload.name = data.name;
  if (data.category != null) payload.category = data.category;
  if (data.description != null) payload.description = data.description;
  if (data.biomechanicalConstraints != null)
    payload.biomechanical_constraints = data.biomechanicalConstraints;
  if (data.equipmentIds != null) payload.equipment_ids = data.equipmentIds;
  const { error } = await supabase.from('equipment_zones').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteZone(id: string): Promise<void> {
  const { error } = await supabase.from('equipment_zones').delete().eq('id', id);
  if (error) throw error;
}

export async function seedDefaultData(): Promise<{
  equipmentItemsCreated: number;
  zonesCreated: number;
}> {
  const { data: existingEq } = await supabase.from('equipment_inventory').select('id');
  const { data: existingZones } = await supabase.from('equipment_zones').select('id');
  let equipmentItemsCreated = 0;
  let zonesCreated = 0;

  const defaultEquipment: Array<Omit<EquipmentItem, 'id'>> = [
    { name: 'Dumbbells', category: 'free_weights' },
    { name: 'Barbell', category: 'free_weights' },
    { name: 'Plates', category: 'free_weights' },
    { name: 'Kettlebells', category: 'free_weights' },
    { name: 'Machines', category: 'machines' },
    // Cables & Bands (canonical 21)
    { name: 'Functional Trainer (Dual Stack)', category: 'cables_bands' },
    { name: 'Single Column / Cable Tower', category: 'cables_bands' },
    { name: 'Lat Pulldown Station', category: 'cables_bands' },
    { name: 'Seated Row Machine (Cable)', category: 'cables_bands' },
    { name: 'Cable Crossover', category: 'cables_bands' },
    { name: 'Plate-Loaded Cable Tower', category: 'cables_bands' },
    { name: 'All-in-One / Smith-Cable Hybrid', category: 'cables_bands' },
    { name: 'Lat Pulldown Bar', category: 'cables_bands' },
    { name: 'Straight Bar (Revolving)', category: 'cables_bands' },
    { name: 'EZ-Curl Bar Attachment', category: 'cables_bands' },
    { name: 'Tricep Rope (Single or Double)', category: 'cables_bands' },
    { name: 'D-Handle (Single Grip)', category: 'cables_bands' },
    { name: 'V-Bar (Tricep Pressdown)', category: 'cables_bands' },
    { name: 'Double D-Handle (Close-Grip Row)', category: 'cables_bands' },
    { name: 'Ankle Strap', category: 'cables_bands' },
    { name: 'Ab Crunch Strap', category: 'cables_bands' },
    { name: 'Loop Bands (Power/Strength Bands)', category: 'cables_bands' },
    { name: 'Mini-Bands (Glute Loops)', category: 'cables_bands' },
    { name: 'Tube Bands with Handles', category: 'cables_bands' },
    { name: 'Therapy Bands (Flat Strips)', category: 'cables_bands' },
    { name: 'Figure-8 Bands', category: 'cables_bands' },
    { name: 'Smith Machine', category: 'machines' },
    // Conditioning (canonical 18)
    { name: 'Motorized Treadmill', category: 'conditioning' },
    { name: 'Manual (Curved) Treadmill', category: 'conditioning' },
    { name: 'Slat Belt Treadmill', category: 'conditioning' },
    { name: 'Anti-Gravity Treadmill', category: 'conditioning' },
    { name: 'Upright Bike', category: 'conditioning' },
    { name: 'Recumbent Bike', category: 'conditioning' },
    { name: 'Spin (Studio) Bike', category: 'conditioning' },
    { name: 'Air Bike (Fan Bike)', category: 'conditioning' },
    { name: 'Standard Elliptical', category: 'conditioning' },
    { name: 'Arc Trainer', category: 'conditioning' },
    { name: 'Adaptive Motion Trainer (AMT)', category: 'conditioning' },
    { name: 'Rowing Machine (Air/Water/Magnetic)', category: 'conditioning' },
    { name: 'SkiErg', category: 'conditioning' },
    { name: 'StairMill / StepMill', category: 'conditioning' },
    { name: 'Pedaling Stepper', category: 'conditioning' },
    { name: 'Vertical Climber (VersaClimber)', category: 'conditioning' },
    { name: "Jacob's Ladder", category: 'conditioning' },
    { name: 'Jump Rope', category: 'conditioning' },
    // Bodyweight (canonical 20)
    { name: 'Pull-up Bar (Straight/Multi-grip)', category: 'bodyweight' },
    { name: 'Dip Station / Parallel Bars', category: 'bodyweight' },
    { name: 'Power Tower', category: 'bodyweight' },
    { name: 'Wall-Mounted Pull-up Bar', category: 'bodyweight' },
    { name: 'Parallettes', category: 'bodyweight' },
    { name: 'Gymnastic Rings', category: 'bodyweight' },
    { name: 'Suspension Trainer (e.g., TRX)', category: 'bodyweight' },
    { name: 'Stall Bars (Gymnastic Wall)', category: 'bodyweight' },
    { name: 'Ab Wheel / Roller', category: 'bodyweight' },
    { name: 'Glute-Ham Developer (GHD)', category: 'bodyweight' },
    { name: 'Reverse Hyper', category: 'bodyweight' },
    { name: 'Sissy Squat Stand', category: 'bodyweight' },
    { name: 'Nordic Curl Bench', category: 'bodyweight' },
    { name: 'Plyo Box (Wood/Soft/Adjustable)', category: 'bodyweight' },
    { name: 'Push-up Handles', category: 'bodyweight' },
    { name: 'Yoga / Exercise Mat', category: 'bodyweight' },
    { name: 'Peg Board', category: 'bodyweight' },
    { name: 'Climbing Wall / Bouldering Holds', category: 'bodyweight' },
    { name: 'Assistance Bands', category: 'bodyweight' },
    { name: 'Floor space', category: 'bodyweight' },
    // Benches & Racks (canonical 21)
    { name: 'Flat Bench', category: 'benches_racks' },
    { name: 'Adjustable (FID) Bench', category: 'benches_racks' },
    { name: 'Olympic Press Bench', category: 'benches_racks' },
    { name: 'Utility Stool (Seated Bench)', category: 'benches_racks' },
    { name: 'Abdominal/Crunch Bench', category: 'benches_racks' },
    { name: 'Folding Bench', category: 'benches_racks' },
    { name: 'Power Rack (Full Cage)', category: 'benches_racks' },
    { name: 'Half Rack', category: 'benches_racks' },
    { name: 'Squat Stand', category: 'benches_racks' },
    { name: 'Wall-Mounted / Folding Rack', category: 'benches_racks' },
    { name: 'Combo Rack', category: 'benches_racks' },
    { name: 'Rig', category: 'benches_racks' },
    { name: 'Preacher Curl Bench', category: 'benches_racks' },
    { name: 'GHD (Glute Ham Developer)', category: 'benches_racks' },
    { name: '45-Degree Hyper-extension Bench', category: 'benches_racks' },
    { name: 'Sissy Squat Stand', category: 'benches_racks' },
    { name: 'Nordic Bench', category: 'benches_racks' },
    { name: 'Dumbbell Rack (Tiered)', category: 'benches_racks' },
    { name: 'Kettlebell Rack', category: 'benches_racks' },
    { name: 'Weight Plate Tree / Toaster Rack', category: 'benches_racks' },
    { name: 'Barbell Storage Rack (Vertical or Horizontal)', category: 'benches_racks' },
    // Functional Training (canonical 17)
    { name: 'Medicine Ball', category: 'functional_training' },
    { name: 'Battle Rope', category: 'functional_training' },
    { name: 'Sandbag', category: 'functional_training' },
    { name: 'Sled / Prowler', category: 'functional_training' },
    { name: 'Pull Sled', category: 'functional_training' },
    { name: 'Tire (Flipping/Dragging)', category: 'functional_training' },
    { name: 'Climbing Rope', category: 'functional_training' },
    { name: 'Sliders / Gliders', category: 'functional_training' },
    { name: 'Stability Ball', category: 'functional_training' },
    { name: 'BOSU Ball', category: 'functional_training' },
    { name: 'Weight Vest', category: 'functional_training' },
    { name: 'Wall Ball', category: 'functional_training' },
    { name: 'Slam Ball', category: 'functional_training' },
    { name: "Farmer's Walk Handles", category: 'functional_training' },
    { name: 'Agility Ladder', category: 'functional_training' },
    { name: 'Foam Roller', category: 'functional_training' },
    { name: 'Door Anchor', category: 'functional_training' },
  ];

  const equipmentIds: Record<string, string> = {};

  if (!existingEq?.length) {
    for (const item of defaultEquipment) {
      const id = await createEquipmentItem(item);
      equipmentIds[item.name] = id;
      equipmentItemsCreated++;
    }
  } else {
    const items = await getAllEquipmentItems();
    items.forEach((item) => {
      equipmentIds[item.name] = item.id;
    });
  }

  if (!existingZones?.length) {
    const defaultZones: Array<Omit<Zone, 'id' | 'createdAt'>> = [
      {
        name: 'Living Room (Minimalist)',
        category: 'domestic',
        description: 'Minimal equipment setup for small spaces',
        biomechanicalConstraints: ['Load Limited', 'Variable Resistance', 'Stabilizer Heavy'],
        equipmentIds: ['Loop Bands (Power/Strength Bands)', 'Yoga / Exercise Mat']
          .map((n) => equipmentIds[n])
          .filter(Boolean),
      },
      {
        name: 'Home Gym (Garage Iron)',
        category: 'domestic',
        description: 'Full home gym setup with heavy lifting equipment',
        biomechanicalConstraints: ['No Limits', 'Fixed Bar Path', 'Vector Freedom'],
        equipmentIds: ['Power Rack (Full Cage)', 'Barbell', 'Plates', 'Flat Bench', 'Kettlebells']
          .map((n) => equipmentIds[n])
          .filter(Boolean),
      },
      {
        name: 'Hotel (Standard)',
        category: 'amenity',
        description: 'Standard hotel gym equipment',
        biomechanicalConstraints: ['Load Limited', 'The 50lb Ceiling', 'Fixed Planes'],
        equipmentIds: ['Dumbbells', 'Flat Bench', 'Motorized Treadmill', 'Standard Elliptical']
          .map((n) => equipmentIds[n])
          .filter(Boolean),
      },
      {
        name: 'Big Box Gym',
        category: 'commercial',
        description: 'Full commercial gym with all equipment available',
        biomechanicalConstraints: ['No Limits', 'High Variety', 'Vector Freedom'],
        equipmentIds: Object.values(equipmentIds),
      },
    ];
    for (const zone of defaultZones) {
      await createZone(zone);
      zonesCreated++;
    }
  }

  return { equipmentItemsCreated, zonesCreated };
}
