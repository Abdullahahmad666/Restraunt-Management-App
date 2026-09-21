/** Calls to /staff/{inventory-items,stock-movements,invoice-scans,
 * invoice-line-items}/ and /admin/inventory-items/. */
import {apiClient} from '../../api/client';
import {endpoints} from '../../api/endpoints';
import type {Paginated} from '../../types/api';
import type {PreparedFile} from '../../utils/media';
import type {
  AdminInventoryItem,
  InventoryItem,
  InvoiceLineItem,
  InvoiceScan,
  PurchaseByItem,
  PurchaseFilters,
  PurchasePeriod,
  PurchaseSummary,
  PurchaseTimelineRow,
  StockMovement,
  StockMovementReason,
  Supplier,
  Warehouse,
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

/** Sending the file itself can be slow on restaurant wifi, so the upload gets
 * a longer timeout than the shared default. It no longer waits for the read -
 * that happens on the server's worker, and the response comes back as soon as
 * the bytes have landed. */
const UPLOAD_TIMEOUT_MS = 60_000;

export async function uploadInvoice(file: PreparedFile): Promise<InvoiceScan> {
  const form = new FormData();
  form.append('photo', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const {data} = await apiClient.post<InvoiceScan>(endpoints.staff.inventory.invoiceScans, form, {
    headers: {'Content-Type': 'multipart/form-data'},
    transformRequest: value => value,
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

/** Queues a fresh read of the same file. Returns straight away - poll the
 * invoice's scan_state for the result. */
export async function rescanInvoice(id: string): Promise<InvoiceScan> {
  const {data} = await apiClient.post<InvoiceScan>(endpoints.staff.inventory.rescanInvoice(id));
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

// ---------------------------------------------------------------------------
// Suppliers and warehouses
// ---------------------------------------------------------------------------

export async function listSuppliers(): Promise<Paginated<Supplier>> {
  const {data} = await apiClient.get<Paginated<Supplier>>(endpoints.staff.inventory.suppliers);
  return data;
}

/** Adds a supplier the restaurant has not bought from before. Available to
 * staff because they hit one mid-review; retiring stays admin-only. */
export async function createSupplier(name: string): Promise<Supplier> {
  const {data} = await apiClient.post<Supplier>(endpoints.staff.inventory.suppliers, {name});
  return data;
}

export async function listWarehouses(): Promise<Paginated<Warehouse>> {
  const {data} = await apiClient.get<Paginated<Warehouse>>(endpoints.staff.inventory.warehouses);
  return data;
}

export type AssignInvoiceInput = {
  supplier?: string | null;
  warehouse?: string | null;
};

export async function assignInvoice(id: string, input: AssignInvoiceInput): Promise<InvoiceScan> {
  const {data} = await apiClient.patch<InvoiceScan>(
    endpoints.staff.inventory.invoiceScan(id),
    input,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Purchase history (admin)
// ---------------------------------------------------------------------------

export async function listPurchasesByItem(
  filters: PurchaseFilters = {},
): Promise<{results: PurchaseByItem[]}> {
  const {data} = await apiClient.get<{results: PurchaseByItem[]}>(
    endpoints.admin.inventory.purchases,
    {params: filters},
  );
  return data;
}

export async function getPurchaseTimeline(
  period: PurchasePeriod,
  filters: PurchaseFilters = {},
): Promise<{period: PurchasePeriod; results: PurchaseTimelineRow[]}> {
  const {data} = await apiClient.get<{period: PurchasePeriod; results: PurchaseTimelineRow[]}>(
    endpoints.admin.inventory.purchasesTimeline,
    {params: {...filters, period}},
  );
  return data;
}

export async function getPurchaseSummary(filters: PurchaseFilters = {}): Promise<PurchaseSummary> {
  const {data} = await apiClient.get<PurchaseSummary>(endpoints.admin.inventory.purchasesSummary, {
    params: filters,
  });
  return data;
}
