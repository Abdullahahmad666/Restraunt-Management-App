/** Stock items, the movements that change them, and scanned invoices. */

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  quantity_on_hand: string;
  par_level: string | null;
  cost_per_unit: string | null;
  is_below_par: boolean;
};

export type AdminInventoryItem = InventoryItem & {
  is_active: boolean;
};

export type StockMovementReason = 'DELIVERY' | 'WASTE' | 'CORRECTION';

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  DELIVERY: 'Delivery received',
  WASTE: 'Waste / spoilage',
  CORRECTION: 'Manual correction',
};

export type StockMovement = {
  id: string;
  item: string;
  reason: StockMovementReason;
  quantity_delta: string;
  note: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

export type InvoiceScanStatus = 'PENDING' | 'CONFIRMED' | 'DISCARDED';

/** How far the read has got. Separate from status, which is the human review
 * lifecycle - an invoice can be waiting to be read and waiting to be reviewed
 * at the same time. */
export type InvoiceScanState = 'AWAITING_UPLOAD' | 'QUEUED' | 'SCANNING' | 'DONE' | 'FAILED';

/** True while the worker still owes us line items, which is when the review
 * screen shows progress rather than an empty invoice. */
export function isScanInProgress(state: InvoiceScanState): boolean {
  return state === 'AWAITING_UPLOAD' || state === 'QUEUED' || state === 'SCANNING';
}

export type InvoiceLineItem = {
  id: string;
  invoice: string;
  raw_name: string;
  matched_item: string | null;
  matched_item_name: string | null;
  quantity: string;
  unit: string;
  unit_price: string | null;
  line_total: string | null;
  sort_order: number;
};

export type InvoiceScan = {
  id: string;
  photo: string;
  status: InvoiceScanStatus;
  scan_state: InvoiceScanState;
  content_type: string;
  supplier_name: string;
  invoice_date: string | null;
  scan_error: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  line_items: InvoiceLineItem[];
  created_at: string;
};
