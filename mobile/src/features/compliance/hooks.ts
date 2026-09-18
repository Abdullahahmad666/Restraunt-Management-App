/** react-query wrappers: fridges, checklist items, and today's shared
 * temperature/checklist records. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import type {ComplianceRoutine} from './types';

const keys = {
  fridgeUnits: ['compliance', 'fridge-units'] as const,
  checklistItems: (routine: ComplianceRoutine) =>
    ['compliance', 'checklist-items', routine] as const,
  temperatureReadings: (params: {date: string; routine: ComplianceRoutine}) =>
    ['compliance', 'temperature-readings', params] as const,
  checklistCompletions: (date: string) => ['compliance', 'checklist-completions', date] as const,
  adminFridgeUnits: ['compliance', 'admin-fridge-units'] as const,
  adminChecklistItems: (routine: ComplianceRoutine) =>
    ['compliance', 'admin-checklist-items', routine] as const,
};

// ---------------------------------------------------------------------------
// Staff (and admin, viewing/completing the same routines)
// ---------------------------------------------------------------------------

export function useFridgeUnits() {
  return useQuery({queryKey: keys.fridgeUnits, queryFn: api.listFridgeUnits});
}

export function useChecklistItems(routine: ComplianceRoutine) {
  return useQuery({
    queryKey: keys.checklistItems(routine),
    queryFn: () => api.listChecklistItems(routine),
  });
}

export function useTemperatureReadings(params: {date: string; routine: ComplianceRoutine}) {
  return useQuery({
    queryKey: keys.temperatureReadings(params),
    queryFn: () => api.listTemperatureReadings(params),
  });
}

export function useRecordTemperature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.recordTemperature,
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: ['compliance', 'temperature-readings']}),
  });
}

export function useChecklistCompletions(date: string) {
  return useQuery({
    queryKey: keys.checklistCompletions(date),
    queryFn: () => api.listChecklistCompletions({date}),
  });
}

export function useCompleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.completeChecklistItem,
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: ['compliance', 'checklist-completions']}),
  });
}

export function useUncompleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uncompleteChecklistItem,
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: ['compliance', 'checklist-completions']}),
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function useAdminFridgeUnits() {
  return useQuery({queryKey: keys.adminFridgeUnits, queryFn: api.listAdminFridgeUnits});
}

function invalidateFridgeUnits(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({queryKey: ['compliance']});
}

export function useCreateFridgeUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createFridgeUnit,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useUpdateFridgeUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateFridgeUnitInput}) =>
      api.updateFridgeUnit(id, input),
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useUploadFridgePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, uri}: {id: string; uri: string}) => api.uploadFridgePhoto(id, uri),
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useDeleteFridgeUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteFridgeUnit,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useAdminChecklistItems(routine: ComplianceRoutine) {
  return useQuery({
    queryKey: keys.adminChecklistItems(routine),
    queryFn: () => api.listAdminChecklistItems(routine),
  });
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createChecklistItem,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateChecklistItemInput}) =>
      api.updateChecklistItem(id, input),
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteChecklistItem,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}
