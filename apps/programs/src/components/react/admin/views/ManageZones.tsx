/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Edit2, RotateCcw, Shield } from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import {
  getAllEquipmentItems,
  createEquipmentItem,
  deleteEquipmentItem,
  getAllZones,
  createZone,
  updateZone,
  seedDefaultData,
} from '@/lib/supabase/client/equipment';
import type { EquipmentItem, EquipmentCategoryCode, Zone } from '@/lib/supabase/client/equipment';

type TabType = 'inventory' | 'zones';

const PREDEFINED_CONSTRAINTS = [
  'Load Limited',
  'Variable Resistance',
  'Stabilizer Heavy',
  'No Limits',
  'High Variety',
  'Fixed Bar Path',
  'The 50lb Ceiling',
  'Vector Freedom',
  'Fixed Planes',
  'Relative Strength',
  'Plyometric/Speed',
];

const ManageZones: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('zones');
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Equipment form state
  const [equipmentFormData, setEquipmentFormData] = useState<{
    name: string;
    category: EquipmentCategoryCode;
  }>({
    name: '',
    category: 'free_weights',
  });

  // Zone form state
  const [zoneFormData, setZoneFormData] = useState({
    name: '',
    category: 'domestic' as 'domestic' | 'commercial' | 'amenity' | 'outdoor',
    description: '',
    biomechanicalConstraints: [] as string[],
    equipmentIds: [] as string[],
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [equipment, zonesData] = await Promise.all([getAllEquipmentItems(), getAllZones()]);
      setEquipmentItems(equipment);
      setZones(zonesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Equipment handlers
  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentFormData.name.trim()) {
      setError('Equipment name is required');
      return;
    }

    try {
      setError(null);
      await createEquipmentItem(equipmentFormData);
      setEquipmentFormData({ name: '', category: 'free_weights' });
      setShowEquipmentForm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create equipment item');
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment item?')) {
      return;
    }

    try {
      setError(null);
      await deleteEquipmentItem(id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete equipment item');
    }
  };

  // Zone handlers
  const handleOpenZoneModal = (zone?: Zone) => {
    if (zone) {
      setEditingZone(zone);
      setZoneFormData({
        name: zone.name,
        category: zone.category,
        description: zone.description,
        biomechanicalConstraints: zone.biomechanicalConstraints,
        equipmentIds: zone.equipmentIds,
      });
    } else {
      setEditingZone(null);
      setZoneFormData({
        name: '',
        category: 'domestic',
        description: '',
        biomechanicalConstraints: [],
        equipmentIds: [],
      });
    }
    setShowZoneModal(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneFormData.name.trim()) {
      setError('Zone name is required');
      return;
    }

    try {
      setError(null);
      if (editingZone) {
        await updateZone(editingZone.id, zoneFormData);
      } else {
        await createZone(zoneFormData);
      }
      setShowZoneModal(false);
      setEditingZone(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save zone');
    }
  };

  // NOTE: Zone delete not implemented. Use handleDeleteEquipment pattern when adding.

  const handleSeedDefaults = async () => {
    if (!confirm('This will populate default equipment and zones. Continue?')) {
      return;
    }

    try {
      setSeeding(true);
      setError(null);
      const result = await seedDefaultData();
      await fetchData();
      alert(
        `Seeded ${result.equipmentItemsCreated} equipment items and ${result.zonesCreated} zones.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed default data');
    } finally {
      setSeeding(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'free_weights':
        return 'bg-blue-500/20 text-blue-300';
      case 'machines':
        return 'bg-indigo-500/20 text-indigo-300';
      case 'cables_bands':
        return 'bg-violet-500/20 text-violet-300';
      case 'bodyweight':
        return 'bg-emerald-500/20 text-emerald-300';
      case 'benches_racks':
        return 'bg-green-500/20 text-green-300';
      case 'conditioning':
        return 'bg-red-500/20 text-red-300';
      case 'functional_training':
        return 'bg-teal-500/20 text-teal-300';
      case 'domestic':
        return 'bg-purple-500/20 text-purple-300';
      case 'commercial':
        return 'bg-orange-500/20 text-orange-300';
      case 'amenity':
        return 'bg-cyan-500/20 text-cyan-300';
      case 'outdoor':
        return 'bg-yellow-500/20 text-yellow-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategoryCode, string> = {
    free_weights: 'Free Weights',
    machines: 'Machines',
    cables_bands: 'Cables & Bands',
    bodyweight: 'Bodyweight',
    benches_racks: 'Benches & Racks',
    conditioning: 'Conditioning',
    functional_training: 'Functional Training',
  };

  const getCategoryLabel = (category: string, type: 'equipment' | 'zone' = 'zone') => {
    if (type === 'equipment' && category in EQUIPMENT_CATEGORY_LABELS)
      return EQUIPMENT_CATEGORY_LABELS[category as EquipmentCategoryCode];
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Group equipment by category
  const equipmentByCategory = equipmentItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, EquipmentItem[]>
  );

  // Group zones by category
  const zonesByCategory = zones.reduce(
    (acc, zone) => {
      if (!acc[zone.category]) {
        acc[zone.category] = [];
      }
      acc[zone.category].push(zone);
      return acc;
    },
    {} as Record<string, Zone[]>
  );

  // Creatable Select options for constraints
  const constraintOptions = PREDEFINED_CONSTRAINTS.map((constraint) => ({
    value: constraint,
    label: constraint,
  }));

  const selectedConstraints = zoneFormData.biomechanicalConstraints.map((constraint) => ({
    value: constraint,
    label: constraint,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="border-orange-light/20 h-12 w-12 animate-spin rounded-full border-4 border-t-orange-light"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Equipment & Zones</h1>
          <p className="mt-2 text-white/60">Manage equipment inventory and zones</p>
        </div>
        {activeTab === 'zones' && (
          <div className="flex gap-3">
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              <RotateCcw className={`h-5 w-5 ${seeding ? 'animate-spin' : ''}`} />
              <span>Reset Defaults</span>
            </button>
            <button
              onClick={() => handleOpenZoneModal()}
              className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Create Zone</span>
            </button>
          </div>
        )}
        {activeTab === 'inventory' && (
          <button
            onClick={() => setShowEquipmentForm(!showEquipmentForm)}
            className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Equipment</span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`border-b-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'border-orange-light text-orange-light'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`border-b-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'zones'
              ? 'border-orange-light text-orange-light'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          Zones
        </button>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Add Equipment Form */}
          {showEquipmentForm && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold">Add Equipment Item</h2>
                <button
                  onClick={() => setShowEquipmentForm(false)}
                  className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEquipment} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Equipment Name *
                  </label>
                  <input
                    type="text"
                    value={equipmentFormData.name}
                    onChange={(e) =>
                      setEquipmentFormData({ ...equipmentFormData, name: e.target.value })
                    }
                    className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                    placeholder="e.g. Kettlebell"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">Category *</label>
                  <select
                    value={equipmentFormData.category}
                    onChange={(e) =>
                      setEquipmentFormData({
                        ...equipmentFormData,
                        category: e.target.value as EquipmentCategoryCode,
                      })
                    }
                    className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                    required
                  >
                    {(Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategoryCode[]).map(
                      (code) => (
                        <option key={code} value={code}>
                          {EQUIPMENT_CATEGORY_LABELS[code]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="hover:bg-orange-light/90 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors"
                  >
                    Create Equipment
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEquipmentForm(false)}
                    className="rounded-lg border border-white/10 bg-black/20 px-6 py-2 font-medium text-white transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Equipment List by Category */}
          {Object.keys(equipmentByCategory).length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">No equipment items found. Add your first item above.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategoryCode[]).map(
                (category) => {
                  const items = equipmentByCategory[category] || [];
                  if (items.length === 0) return null;

                  return (
                    <div
                      key={category}
                      className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm"
                    >
                      <h3 className="mb-4 font-heading text-lg font-bold">
                        {EQUIPMENT_CATEGORY_LABELS[category]}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(
                                  item.category
                                )}`}
                              >
                                {getCategoryLabel(item.category, 'equipment')}
                              </span>
                              <span className="font-medium text-white">{item.name}</span>
                              {item.tags?.includes('safety_features') && (
                                <span
                                  className="ml-1.5 inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-300"
                                  title="Safety pins/straps available"
                                >
                                  <Shield className="h-3 w-3" aria-hidden />
                                  Safety features
                                </span>
                              )}
                              {item.tags?.includes('cable_machine') && item.pulley_ratio && (
                                <span
                                  className="ml-1.5 inline-flex rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300"
                                  title="Pulley ratio (e.g. 2:1 = 100 lb stack feels like 50 lb)"
                                >
                                  Pulley {item.pulley_ratio}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteEquipment(item.id)}
                              className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="space-y-6">
          {Object.keys(zonesByCategory).length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">
                No zones found. Click "Reset Defaults" to load preset zones or create a new zone.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(['domestic', 'commercial', 'amenity', 'outdoor'] as const).map((category) => {
                const categoryZones = zonesByCategory[category] || [];
                if (categoryZones.length === 0) return null;

                return (
                  <div
                    key={category}
                    className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm"
                  >
                    <h3 className="mb-4 font-heading text-lg font-bold capitalize">{category}</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryZones.map((zone) => (
                        <div
                          key={zone.id}
                          className="group rounded-lg border border-white/10 bg-black/10 p-4 transition-all hover:border-white/20"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="mb-1 font-heading text-lg font-bold">{zone.name}</h4>
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(
                                  zone.category
                                )}`}
                              >
                                {getCategoryLabel(zone.category)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleOpenZoneModal(zone)}
                              className="rounded-lg p-1.5 text-white/60 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>

                          {zone.description && (
                            <p className="mb-3 text-sm text-white/60">{zone.description}</p>
                          )}

                          <div className="space-y-2">
                            <div className="text-xs text-white/50">
                              {zone.equipmentIds.length} equipment item
                              {zone.equipmentIds.length !== 1 ? 's' : ''}
                            </div>
                            {zone.biomechanicalConstraints.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {zone.biomechanicalConstraints
                                  .slice(0, 3)
                                  .map((constraint, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/70"
                                    >
                                      {constraint}
                                    </span>
                                  ))}
                                {zone.biomechanicalConstraints.length > 3 && (
                                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50">
                                    +{zone.biomechanicalConstraints.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Zone Editor Modal */}
      <AnimatePresence>
        {showZoneModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
            onClick={() => setShowZoneModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 p-6">
                <h2 className="font-heading text-2xl font-bold">
                  {editingZone ? 'Edit Zone' : 'Create Zone'}
                </h2>
                <button
                  onClick={() => setShowZoneModal(false)}
                  className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
                <form onSubmit={handleSaveZone} className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Zone Name *
                    </label>
                    <input
                      type="text"
                      value={zoneFormData.name}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                      placeholder="e.g. Home Gym (Garage Iron)"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Category *
                    </label>
                    <select
                      value={zoneFormData.category}
                      onChange={(e) =>
                        setZoneFormData({
                          ...zoneFormData,
                          category: e.target.value as
                            | 'domestic'
                            | 'commercial'
                            | 'amenity'
                            | 'outdoor',
                        })
                      }
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:outline-none focus:ring-2"
                      required
                    >
                      <option value="domestic">Domestic</option>
                      <option value="commercial">Commercial</option>
                      <option value="amenity">Amenity</option>
                      <option value="outdoor">Outdoor</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Description
                    </label>
                    <textarea
                      value={zoneFormData.description}
                      onChange={(e) =>
                        setZoneFormData({ ...zoneFormData, description: e.target.value })
                      }
                      rows={3}
                      className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
                      placeholder="Describe this zone..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Biomechanical Constraints
                    </label>
                    <CreatableSelect
                      isMulti
                      options={constraintOptions}
                      value={selectedConstraints}
                      onChange={(newValue) => {
                        const constraints = newValue ? newValue.map((option) => option.value) : [];
                        setZoneFormData({ ...zoneFormData, biomechanicalConstraints: constraints });
                      }}
                      placeholder="Select or create constraints..."
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          '&:hover': {
                            borderColor: 'rgba(255, 191, 0, 0.5)',
                          },
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#0d0500',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused
                            ? 'rgba(255, 191, 0, 0.2)'
                            : state.isSelected
                              ? 'rgba(255, 191, 0, 0.3)'
                              : 'transparent',
                          color: '#fff',
                          '&:active': {
                            backgroundColor: 'rgba(255, 191, 0, 0.3)',
                          },
                        }),
                        multiValue: (base) => ({
                          ...base,
                          backgroundColor: 'rgba(255, 191, 0, 0.2)',
                        }),
                        multiValueLabel: (base) => ({
                          ...base,
                          color: '#ffbf00',
                        }),
                        multiValueRemove: (base) => ({
                          ...base,
                          color: '#ffbf00',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 191, 0, 0.3)',
                            color: '#fff',
                          },
                        }),
                        input: (base) => ({
                          ...base,
                          color: '#fff',
                        }),
                        placeholder: (base) => ({
                          ...base,
                          color: 'rgba(255, 255, 255, 0.4)',
                        }),
                      }}
                      className="text-white"
                      classNamePrefix="react-select"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Equipment ({zoneFormData.equipmentIds.length} selected)
                    </label>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/10 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {equipmentItems.map((item) => (
                          <label
                            key={item.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${
                              zoneFormData.equipmentIds.includes(item.id)
                                ? 'border-orange-light/50 bg-orange-light/10'
                                : 'border-white/5 bg-black/10 hover:border-white/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={zoneFormData.equipmentIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setZoneFormData({
                                    ...zoneFormData,
                                    equipmentIds: [...zoneFormData.equipmentIds, item.id],
                                  });
                                } else {
                                  setZoneFormData({
                                    ...zoneFormData,
                                    equipmentIds: zoneFormData.equipmentIds.filter(
                                      (id) => id !== item.id
                                    ),
                                  });
                                }
                              }}
                              className="focus:ring-orange-light/50 h-4 w-4 rounded border-white/20 text-orange-light"
                            />
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(
                                item.category
                              )}`}
                            >
                              {getCategoryLabel(item.category, 'equipment')}
                            </span>
                            <span className="flex-1 text-sm text-white">{item.name}</span>
                            {item.tags?.includes('safety_features') && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-300"
                                title="Safety pins/straps available"
                              >
                                <Shield className="h-3 w-3" aria-hidden />
                                Safety
                              </span>
                            )}
                            {item.tags?.includes('cable_machine') && item.pulley_ratio && (
                              <span
                                className="inline-flex rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300"
                                title="Pulley ratio"
                              >
                                {item.pulley_ratio}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowZoneModal(false)}
                      className="rounded-lg border border-white/10 bg-black/20 px-6 py-2 font-medium text-white transition-colors hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="hover:bg-orange-light/90 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors"
                    >
                      {editingZone ? 'Save Changes' : 'Create Zone'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManageZones;
