/** Calls to /staff/{inventory-items,stock-movements,invoice-scans,
 * invoice-line-items}/ and /admin/inventory-items/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {
  AdminInventoryItem,
  InventoryItem,
  InvoiceLineItem,
  InvoiceScan,
  StockMovement,
  StockMovementReason,
} from './types';

// ---------------------------------------------------------------------------
// Staff (also used by admin - both roles view/log stock the same way)
// ---------------------------------------------------------------------------

export async function listInventoryItems(): Promise<Paginated<InventoryItem>> {
  const {data} = await apiClient.get<Paginated<InventoryItem>>(endpoints.staff.inventory.items);
  return data;
}

export type CreateInventoryItemInput = {
  name: string;
  unit: string;
};

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<InventoryItem> {
  const {data} = await apiClient.post<InventoryItem>(endpoints.staff.inventory.items, input);
  return data;
}

export async function listStockMovements(params?: {
  item?: string;
}): Promise<Paginated<StockMovement>> {
  const {data} = await apiClient.get<Paginated<StockMovement>>(
    endpoints.staff.inventory.movements,
    {params},
  );
  return data;
}

export async function adjustStock(input: {
  item: string;
  quantity_delta: number;
  reason: StockMovementReason;
  note?: string;
}): Promise<StockMovement> {
  const {data} = await apiClient.post<StockMovement>(endpoints.staff.inventory.movements, input);
  return data;
}

export async function listInvoiceScans(params?: {
  status?: string;
}): Promise<Paginated<InvoiceScan>> {
  const {data} = await apiClient.get<Paginated<InvoiceScan>>(
    endpoints.staff.inventory.invoiceScans,
    {params},
  );
  return data;
}

export async function getInvoiceScan(id: string): Promise<InvoiceScan> {
  const {data} = await apiClient.get<InvoiceScan>(endpoints.staff.inventory.invoiceScan(id));
  return data;
}

/** Uploads the photo and waits for the vision model to read it - can take
 * well past the app's normal request timeout, so this call gets its own,
 * longer one rather than the shared default. */
const SCAN_TIMEOUT_MS = 60_000;

export async function uploadInvoice(uri: string): Promise<InvoiceScan> {
  const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append('photo', {
    uri,
    name: `invoice.${extension}`,
    type: mime,
  } as unknown as Blob);

  const {data} = await apiClient.post<InvoiceScan>(endpoints.staff.inventory.invoiceScans, form, {
    headers: {'Content-Type': 'multipart/form-data'},
    transformRequest: value => value,
    timeout: SCAN_TIMEOUT_MS,
  });
  return data;
}

export async function rescanInvoice(id: string): Promise<InvoiceScan> {
  const {data} = await apiClient.post<InvoiceScan>(
    endpoints.staff.inventory.rescanInvoice(id),
    undefined,
    {timeout: SCAN_TIMEOUT_MS},
  );
  return data;
}

export async function confirmInvoice(id: string): Promise<InvoiceScan> {
  const {data} = await apiClient.post<InvoiceScan>(endpoints.staff.inventory.confirmInvoice(id));
  return data;
}

export async function discardInvoice(id: string): Promise<InvoiceScan> {
  const {data} = await apiClient.post<InvoiceScan>(endpoints.staff.inventory.discardInvoice(id));
  return data;
}

export type UpdateInvoiceLineItemInput = {
  raw_name?: string;
  matched_item?: string | null;
  quantity?: string;
  unit?: string;
  unit_price?: string | null;
};

export async function updateInvoiceLineItem(
  id: string,
  input: UpdateInvoiceLineItemInput,
): Promise<InvoiceLineItem> {
  const {data} = await apiClient.patch<InvoiceLineItem>(
    endpoints.staff.inventory.invoiceLineItem(id),
    input,
  );
  return data;
}

export async function deleteInvoiceLineItem(id: string): Promise<void> {
  await apiClient.delete(endpoints.staff.inventory.invoiceLineItem(id));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listAdminInventoryItems(): Promise<Paginated<AdminInventoryItem>> {
  const {data} = await apiClient.get<Paginated<AdminInventoryItem>>(
    endpoints.admin.inventory.items,
  );
  return data;
}

export type UpdateInventoryItemInput = {
  name?: string;
  unit?: string;
  par_level?: string | null;
  is_active?: boolean;
};

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
): Promise<AdminInventoryItem> {
  const {data} = await apiClient.patch<AdminInventoryItem>(
    endpoints.admin.inventory.item(id),
    input,
  );
  return data;
}
