/** react-query wrappers: stock items, the stock ledger, and scanned invoices. */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import * as api from './api';
import {isScanInProgress} from './types';

/** How often to ask whether the worker has finished reading an invoice.
 * Frequent enough to feel immediate, rare enough not to hammer the API while
 * someone leaves the screen open. */
const SCAN_POLL_MS = 2000;

const keys = {
  items: ['inventory', 'items'] as const,
  movements: (item?: string) => ['inventory', 'movements', item ?? 'all'] as const,
  invoiceScans: (status?: string) => ['inventory', 'invoice-scans', status ?? 'all'] as const,
  invoiceScan: (id: string) => ['inventory', 'invoice-scan', id] as const,
  adminItems: ['inventory', 'admin-items'] as const,
};

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({queryKey: ['inventory']});
}

// ---------------------------------------------------------------------------
// Staff (and admin, viewing/logging stock the same way)
// ---------------------------------------------------------------------------

export function useInventoryItems() {
  return useQuery({queryKey: keys.items, queryFn: api.listInventoryItems});
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createInventoryItem,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useStockMovements(item?: string) {
  return useQuery({
    queryKey: keys.movements(item),
    queryFn: () => api.listStockMovements(item ? {item} : undefined),
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.adjustStock,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useInvoiceScans(status?: string) {
  return useQuery({
    queryKey: keys.invoiceScans(status),
    queryFn: () => api.listInvoiceScans(status ? {status} : undefined),
  });
}

export function useInvoiceScan(id: string) {
  return useQuery({
    queryKey: keys.invoiceScan(id),
    queryFn: () => api.getInvoiceScan(id),
    enabled: Boolean(id),
    // Reading happens on a worker, so the invoice arrives empty and fills in
    // afterwards. Poll while that is outstanding and stop the moment it is
    // not - the server always reaches DONE or FAILED, including when it gives
    // up, so this terminates rather than spinning.
    refetchInterval: query =>
      query.state.data && isScanInProgress(query.state.data.scan_state) ? SCAN_POLL_MS : false,
  });
}

export function useUploadInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadInvoice,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['inventory', 'invoice-scans']}),
  });
}

function invalidateInvoice(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({queryKey: keys.invoiceScan(id)});
  queryClient.invalidateQueries({queryKey: ['inventory', 'invoice-scans']});
}

export function useRescanInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.rescanInvoice,
    onSuccess: (_data, id) => invalidateInvoice(queryClient, id),
  });
}

export function useConfirmInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.confirmInvoice,
    onSuccess: (_data, id) => {
      invalidateInvoice(queryClient, id);
      queryClient.invalidateQueries({queryKey: keys.items});
      queryClient.invalidateQueries({queryKey: ['inventory', 'movements']});
    },
  });
}

export function useDiscardInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.discardInvoice,
    onSuccess: (_data, id) => invalidateInvoice(queryClient, id),
  });
}

export function useUpdateInvoiceLineItem(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateInvoiceLineItemInput}) =>
      api.updateInvoiceLineItem(id, input),
    onSuccess: () => invalidateInvoice(queryClient, invoiceId),
  });
}

export function useDeleteInvoiceLineItem(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteInvoiceLineItem,
    onSuccess: () => invalidateInvoice(queryClient, invoiceId),
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function useAdminInventoryItems() {
  return useQuery({queryKey: keys.adminItems, queryFn: api.listAdminInventoryItems});
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: api.UpdateInventoryItemInput}) =>
      api.updateInventoryItem(id, input),
    onSuccess: () => invalidateAll(queryClient),
  });
}
