/** Calls to /staff/{fridge-units,checklist-items,temperature-readings,
 * checklist-completions}/ and /admin/{fridge-units,checklist-items}/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {
  AdminChecklistItem,
  AdminFridgeUnit,
  ChecklistCompletion,
  ChecklistItem,
  ComplianceRoutine,
  FridgeUnit,
  FridgeUnitKind,
  TemperatureReading,
} from './types';

// ---------------------------------------------------------------------------
// Staff (also used by admin - both roles read/complete the same way)
// ---------------------------------------------------------------------------

export async function listFridgeUnits(): Promise<Paginated<FridgeUnit>> {
  const {data} = await apiClient.get<Paginated<FridgeUnit>>(endpoints.staff.compliance.fridgeUnits);
  return data;
}

export async function listChecklistItems(
  routine: ComplianceRoutine,
): Promise<Paginated<ChecklistItem>> {
  const {data} = await apiClient.get<Paginated<ChecklistItem>>(
    endpoints.staff.compliance.checklistItems,
    {params: {routine}},
  );
  return data;
}

export async function listTemperatureReadings(params: {
  date: string;
  routine: ComplianceRoutine;
}): Promise<Paginated<TemperatureReading>> {
  const {data} = await apiClient.get<Paginated<TemperatureReading>>(
    endpoints.staff.compliance.temperatureReadings,
    {params},
  );
  return data;
}

export async function recordTemperature(input: {
  fridge_unit: string;
  routine: ComplianceRoutine;
  date: string;
  celsius: number;
}): Promise<TemperatureReading> {
  const {data} = await apiClient.post<TemperatureReading>(
    endpoints.staff.compliance.temperatureReadings,
    input,
  );
  return data;
}

export async function listChecklistCompletions(params: {
  date: string;
}): Promise<Paginated<ChecklistCompletion>> {
  const {data} = await apiClient.get<Paginated<ChecklistCompletion>>(
    endpoints.staff.compliance.checklistCompletions,
    {params},
  );
  return data;
}

export async function completeChecklistItem(input: {
  checklist_item: string;
  date: string;
}): Promise<ChecklistCompletion> {
  const {data} = await apiClient.post<ChecklistCompletion>(
    endpoints.staff.compliance.checklistCompletions,
    input,
  );
  return data;
}

export async function uncompleteChecklistItem(id: string): Promise<void> {
  await apiClient.delete(endpoints.staff.compliance.checklistCompletion(id));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listAdminFridgeUnits(): Promise<Paginated<AdminFridgeUnit>> {
  const {data} = await apiClient.get<Paginated<AdminFridgeUnit>>(
    endpoints.admin.compliance.fridgeUnits,
  );
  return data;
}

export type CreateFridgeUnitInput = {
  name: string;
  kind: FridgeUnitKind;
  recommended_max_celsius: string;
};

export async function createFridgeUnit(input: CreateFridgeUnitInput): Promise<AdminFridgeUnit> {
  const {data} = await apiClient.post<AdminFridgeUnit>(
    endpoints.admin.compliance.fridgeUnits,
    input,
  );
  return data;
}

export type UpdateFridgeUnitInput = Partial<CreateFridgeUnitInput> & {is_active?: boolean};

export async function updateFridgeUnit(
  id: string,
  input: UpdateFridgeUnitInput,
): Promise<AdminFridgeUnit> {
  const {data} = await apiClient.patch<AdminFridgeUnit>(
    endpoints.admin.compliance.fridgeUnit(id),
    input,
  );
  return data;
}

export async function deleteFridgeUnit(id: string): Promise<void> {
  await apiClient.delete(endpoints.admin.compliance.fridgeUnit(id));
}

/** Same {uri, name, type} multipart shape as uploadAvatar in
 * features/auth/api.ts - see its comment for why the Content-Type header
 * is left for the runtime to set. */
export async function uploadFridgePhoto(id: string, uri: string): Promise<AdminFridgeUnit> {
  const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append('photo', {
    uri,
    name: `fridge.${extension}`,
    type: mime,
  } as unknown as Blob);

  const {data} = await apiClient.patch<AdminFridgeUnit>(
    endpoints.admin.compliance.fridgeUnit(id),
    form,
    {headers: {'Content-Type': 'multipart/form-data'}, transformRequest: value => value},
  );
  return data;
}

export async function listAdminChecklistItems(
  routine: ComplianceRoutine,
): Promise<Paginated<AdminChecklistItem>> {
  const {data} = await apiClient.get<Paginated<AdminChecklistItem>>(
    endpoints.admin.compliance.checklistItems,
    {params: {routine}},
  );
  return data;
}

export type CreateChecklistItemInput = {
  routine: ComplianceRoutine;
  text: string;
  sort_order?: number;
};

export async function createChecklistItem(
  input: CreateChecklistItemInput,
): Promise<AdminChecklistItem> {
  const {data} = await apiClient.post<AdminChecklistItem>(
    endpoints.admin.compliance.checklistItems,
    input,
  );
  return data;
}

export type UpdateChecklistItemInput = Partial<CreateChecklistItemInput> & {is_active?: boolean};

export async function updateChecklistItem(
  id: string,
  input: UpdateChecklistItemInput,
): Promise<AdminChecklistItem> {
  const {data} = await apiClient.patch<AdminChecklistItem>(
    endpoints.admin.compliance.checklistItem(id),
    input,
  );
  return data;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  await apiClient.delete(endpoints.admin.compliance.checklistItem(id));
}
