/** react-query wrappers: fridges, checklist items, and today's shared
 * temperature/checklist records. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import type {ChecklistFrequency, ComplianceRoutine} from './types';

const keys = {
  fridgeUnits: ['compliance', 'fridge-units'] as const,
  checklistItems: (routine: ComplianceRoutine) =>
    ['compliance', 'checklist-items', routine] as const,
  temperatureReadings: (params: {date: string; routine: ComplianceRoutine}) =>
    ['compliance', 'temperature-readings', params] as const,
  temperatureReadingHistory: (params: {dateFrom: string; dateTo: string}) =>
    ['compliance', 'temperature-reading-history', params] as const,
  checklistCompletions: (date: string) => ['compliance', 'checklist-completions', date] as const,
  adminFridgeUnits: ['compliance', 'admin-fridge-units'] as const,
  adminChecklistItems: (routine: ComplianceRoutine) =>
    ['compliance', 'admin-checklist-items', routine] as const,
  checklistTemplates: (frequency: ChecklistFrequency) =>
    ['compliance', 'checklist-templates', frequency] as const,
  checklistTasks: (template: string) => ['compliance', 'checklist-tasks', template] as const,
  checklistTaskCompletions: (template: string) =>
    ['compliance', 'checklist-task-completions', template] as const,
  adminChecklistTemplates: (frequency: ChecklistFrequency) =>
    ['compliance', 'admin-checklist-templates', frequency] as const,
  adminChecklistTasks: (template: string) =>
    ['compliance', 'admin-checklist-tasks', template] as const,
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

export function useTemperatureReadingHistory(params: {dateFrom: string; dateTo: string}) {
  return useQuery({
    queryKey: keys.temperatureReadingHistory(params),
    queryFn: () => api.listTemperatureReadingHistory(params),
  });
}

export function useRecordTemperature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.recordTemperature,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['compliance', 'temperature-readings']});
      queryClient.invalidateQueries({queryKey: ['compliance', 'temperature-reading-history']});
    },
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

export function useChecklistTemplates(frequency: ChecklistFrequency) {
  return useQuery({
    queryKey: keys.checklistTemplates(frequency),
    queryFn: () => api.listChecklistTemplates(frequency),
  });
}

export function useChecklistTasks(template: string) {
  return useQuery({
    queryKey: keys.checklistTasks(template),
    queryFn: () => api.listChecklistTasks(template),
    enabled: Boolean(template),
  });
}

export function useChecklistTaskCompletions(template: string) {
  return useQuery({
    queryKey: keys.checklistTaskCompletions(template),
    queryFn: () => api.listChecklistTaskCompletions(template),
    enabled: Boolean(template),
  });
}

export function useCompleteChecklistTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.completeChecklistTask,
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: ['compliance', 'checklist-task-completions']}),
  });
}

export function useUncompleteChecklistTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uncompleteChecklistTask,
    onSuccess: () =>
      queryClient.invalidateQueries({queryKey: ['compliance', 'checklist-task-completions']}),
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

export function useAdminChecklistTemplates(frequency: ChecklistFrequency) {
  return useQuery({
    queryKey: keys.adminChecklistTemplates(frequency),
    queryFn: () => api.listAdminChecklistTemplates(frequency),
  });
}

export function useCreateChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createChecklistTemplate,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useUpdateChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateChecklistTemplateInput}) =>
      api.updateChecklistTemplate(id, input),
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useDeleteChecklistTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteChecklistTemplate,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useAdminChecklistTasks(template: string) {
  return useQuery({
    queryKey: keys.adminChecklistTasks(template),
    queryFn: () => api.listAdminChecklistTasks(template),
    enabled: Boolean(template),
  });
}

export function useCreateChecklistTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createChecklistTask,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useUpdateChecklistTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateChecklistTaskInput}) =>
      api.updateChecklistTask(id, input),
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}

export function useDeleteChecklistTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteChecklistTask,
    onSuccess: () => invalidateFridgeUnits(queryClient),
  });
}
