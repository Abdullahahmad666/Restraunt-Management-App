/** FridgeUnit, ChecklistItem, and the shared daily records against them. */

export type ComplianceRoutine = 'OPENING' | 'CLOSING';

export const ROUTINE_LABELS: Record<ComplianceRoutine, string> = {
  OPENING: 'Opening',
  CLOSING: 'Closing',
};

export type FridgeUnitKind = 'FRIDGE' | 'FREEZER';

export type FridgeUnit = {
  id: string;
  name: string;
  kind: FridgeUnitKind;
  photo: string | null;
  recommended_max_celsius: string;
  sort_order: number;
};

/** Admin-only fields, present when it comes back from /admin/fridge-units/. */
export type AdminFridgeUnit = FridgeUnit & {
  is_active: boolean;
};

export type ChecklistItem = {
  id: string;
  routine: ComplianceRoutine;
  text: string;
  sort_order: number;
};

export type AdminChecklistItem = ChecklistItem & {
  is_active: boolean;
};

/** One fridge/freezer's temperature for one routine, one day - shared
 * across the whole team, not owned by whoever logged it. See the backend's
 * apps.compliance.models.results docstring for why. */
export type TemperatureReading = {
  id: string;
  fridge_unit: string;
  routine: ComplianceRoutine;
  date: string;
  celsius: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  recorded_at: string;
  is_within_range: boolean;
};

/** One checklist item ticked off for one day - same sharing rule as
 * TemperatureReading. */
export type ChecklistCompletion = {
  id: string;
  checklist_item: string;
  date: string;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string;
};
