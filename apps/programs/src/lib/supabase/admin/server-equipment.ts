/**
 * Server-side equipment and zones. Replaces firebase/admin/server-equipment.
 */

import { getSupabaseServer } from '../server';
import type { EquipmentItem, Zone } from '../client/equipment';

interface EquipmentRow {
  id: string;
  name: string;
  category: string;
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
  return { id: row.id, name: row.name, category: row.category as EquipmentItem['category'] };
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

export async function getAllEquipmentItemsServer(): Promise<EquipmentItem[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('equipment_inventory').select('*');
  if (error) throw error;
  return (data ?? []).map(mapEquipment);
}

export async function getAllZonesServer(): Promise<Zone[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('equipment_zones').select('*');
  if (error) throw error;
  return (data ?? []).map(mapZone);
}

export async function getZoneByIdServer(id: string): Promise<Zone | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('equipment_zones').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapZone(data) : null;
}
