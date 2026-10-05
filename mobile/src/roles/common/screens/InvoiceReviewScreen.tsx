import React, {useState} from 'react';
import {ActivityIndicator, Image, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {PickerRow} from '../../../components/PickerRow';
import {PickerSheet} from '../../../components/PickerSheet';
import {PressableScale} from '../../../components/PressableScale';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  useConfirmInvoice,
  useCreateInventoryItem,
  useDeleteInvoiceLineItem,
  useDiscardInvoice,
  useInventoryItems,
  useInvoiceScan,
  useRescanInvoice,
  useUpdateInvoiceLineItem,
} from '../../../features/inventory/hooks';
import {
  useAssignInvoice,
  useCreateSupplier,
  useSuppliers,
  useWarehouses,
} from '../../../features/inventory/hooks';
import {isScanInProgress} from '../../../features/inventory/types';
import type {InvoiceScan} from '../../../features/inventory/types';
import type {InventoryItem, InvoiceLineItem} from '../../../features/inventory/types';
import type {InventoryStackParamList} from '../../../navigation/types';
import {colors, radii, spacing} from '../../../theme';
import {formatCurrency, formatDate} from '../../../utils/format';

type Route = RouteProp<InventoryStackParamList, 'InvoiceReview'>;
type Nav = NativeStackNavigationProp<InventoryStackParamList>;

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  DISCARDED: 'neutral',
  DUPLICATE: 'neutral',
};

function LineItemCard({
  line,
  index,
  items,
  invoiceId,
  locked,
}: {
  line: InvoiceLineItem;
  index: number;
  items: InventoryItem[];
  invoiceId: string;
  locked: boolean;
}): React.JSX.Element {
  const updateLine = useUpdateInvoiceLineItem(invoiceId);
  const deleteLine = useDeleteInvoiceLineItem(invoiceId);
  const createItem = useCreateInventoryItem();
  const [rawName, setRawName] = useState(line.raw_name);
  const [quantity, setQuantity] = useState(line.quantity);
  const [unitPrice, setUnitPrice] = useState(line.unit_price ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const matchedItem = items.find(item => item.id === line.matched_item);

  async function onSaveDetails() {
    setError(null);
    try {
      await updateLine.mutateAsync({
        id: line.id,
        input: {raw_name: rawName, quantity, unit_price: unitPrice || null},
      });
    } catch (err) {
      setError(describeApiError(err, 'Could not save changes.'));
    }
  }

  async function onMatch(itemId: string) {
    setError(null);
    try {
      await updateLine.mutateAsync({id: line.id, input: {matched_item: itemId}});
    } catch (err) {
      setError(describeApiError(err, 'Could not match that item.'));
    }
  }

  /** `typed` is whatever was in the picker's search box - someone who typed
   * "Ketchup 1L" looking for it, and found nothing, means that as the name. */
  async function onCreateAndMatch(typed?: string) {
    setError(null);
    try {
      const created = await createItem.mutateAsync({
        name: typed?.trim() || rawName.trim() || line.raw_name,
        unit: line.unit || 'each',
      });
      await updateLine.mutateAsync({id: line.id, input: {matched_item: created.id}});
    } catch (err) {
      setError(describeApiError(err, 'Could not create that item.'));
    }
  }

  async function onDelete() {
    setError(null);
    try {
      await deleteLine.mutateAsync(line.id);
    } catch (err) {
      setError(describeApiError(err, 'Could not remove that line.'));
    }
  }

  const lineTotal = Number(quantity) * Number(unitPrice);
  const hasTotal = Number.isFinite(lineTotal) && quantity !== '' && unitPrice !== '';

  return (
    <Card style={styles.lineCard}>
      {/* Which line this is, and the way to drop it. "Remove this line" used
          to sit at the bottom in danger red, directly under the match row and
          louder than anything else on the card - the one action here nobody is
          looking for, drawn like the one they are. */}
      <View style={styles.lineHeader}>
        <Text style={styles.lineNumber}>Line {index + 1}</Text>
        {!locked ? (
          <PressableScale
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Remove line ${index + 1}`}
            style={styles.removeButton}>
            <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
            <Text style={styles.removeLabel}>Remove</Text>
          </PressableScale>
        ) : null}
      </View>

      <TextField
        label="Item name"
        value={rawName}
        onChangeText={setRawName}
        onBlur={onSaveDetails}
        editable={!locked}
      />
      <View style={styles.pairRow}>
        <View style={styles.pairField}>
          <TextField
            label={`Quantity${line.unit ? ` (${line.unit})` : ''}`}
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
            onBlur={onSaveDetails}
            editable={!locked}
          />
        </View>
        <View style={styles.pairField}>
          <TextField
            label="Unit price"
            keyboardType="decimal-pad"
            value={unitPrice}
            onChangeText={setUnitPrice}
            onBlur={onSaveDetails}
            editable={!locked}
          />
        </View>
      </View>

      {/* The two fields above multiplied out. A quantity read as 60 instead
          of 6 is hard to notice in a field and obvious as a total. */}
      {hasTotal ? (
        <Text style={styles.lineMaths}>
          {quantity} x {formatCurrency(unitPrice)} ={' '}
          <Text style={styles.lineMathsTotal}>{formatCurrency(lineTotal)}</Text>
        </Text>
      ) : null}

      {/*
        One control, not a chip per stock item. The chip wall was readable at
        five items and a wall to scroll past at fifty - and every line on the
        invoice repeated it, so reviewing a ten-line delivery meant passing the
        same list ten times.
      */}
      <Text style={styles.label}>Stock item</Text>
      <PickerRow
        icon={matchedItem ? 'checkmark-circle' : 'alert-circle-outline'}
        tone={matchedItem ? 'done' : 'pending'}
        title={matchedItem ? matchedItem.name : 'Not matched'}
        // Short enough to sit beside the action at any width. The full reason -
        // that nothing reaches stock until every line is matched - is said once
        // above the Confirm button, not retold per line and cut off halfway.
        hint={
          matchedItem
            ? `${matchedItem.quantity_on_hand} ${matchedItem.unit} in stock`
            : 'Will not reach stock'
        }
        actionLabel={matchedItem ? 'Change' : 'Match'}
        onPress={() => setPickerOpen(true)}
        disabled={locked}
        accessibilityLabel={
          matchedItem ? `Matched to ${matchedItem.name}. Change` : 'Match to a stock item'
        }
      />

      <PickerSheet
        visible={pickerOpen}
        title="Match to stock item"
        searchPlaceholder="Search your stock items"
        choices={items.map(item => ({
          value: item.id,
          label: item.name,
          hint: `${item.quantity_on_hand} ${item.unit} in stock`,
        }))}
        selected={line.matched_item}
        emptyLabel="No stock item by that name yet - add it below."
        createLabel={query => `Add "${query || rawName || line.raw_name}" to stock`}
        onCreate={query => onCreateAndMatch(query)}
        creating={createItem.isPending}
        onSelect={onMatch}
        onClose={() => setPickerOpen(false)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

/** Picking who supplied an invoice and where it went.
 *
 * Both are shown even when the scan matched one already: the match is a
 * suggestion made from text a model read, and the reviewer is the person who
 * decides it was right. The raw text the scan read sits underneath as the
 * evidence for it.
 */
function SourceCard({invoice, locked}: {invoice: InvoiceScan; locked: boolean}): React.JSX.Element {
  const suppliers = useSuppliers();
  const warehouses = useWarehouses();
  const assign = useAssignInvoice(invoice.id);
  const createSupplier = useCreateSupplier();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<'supplier' | 'warehouse' | null>(null);

  const supplierList = suppliers.data?.results ?? [];
  const warehouseList = warehouses.data?.results ?? [];
  const supplier = supplierList.find(candidate => candidate.id === invoice.supplier);
  const warehouse = warehouseList.find(candidate => candidate.id === invoice.warehouse);

  async function onAssign(input: {supplier?: string | null; warehouse?: string | null}) {
    setError(null);
    try {
      await assign.mutateAsync(input);
    } catch (err) {
      setError(describeApiError(err, 'Could not update this invoice.'));
    }
  }

  /**
   * Add a supplier nobody has bought from before, and put this invoice on it.
   *
   * `typed` is whatever was in the picker's search box, falling back to the
   * name the scan read. Both matter: an invoice whose letterhead was missed
   * entirely used to leave a reviewer stuck, because adding a supplier was
   * only offered when the scan had read a name to offer - a staff member with
   * an unreadable letterhead could pick from the list or give up, and the list
   * is admin-managed.
   */
  async function onAddSupplier(typed: string) {
    const name = typed.trim() || invoice.supplier_name.trim();
    if (!name) {
      setError('Type the supplier name to add them.');
      return;
    }
    setError(null);
    try {
      const created = await createSupplier.mutateAsync(name);
      await assign.mutateAsync({supplier: created.id});
    } catch (err) {
      setError(describeApiError(err, 'Could not add that supplier.'));
    }
  }

  return (
    <Card style={styles.lineCard}>
      <Text style={styles.label}>Supplier</Text>
      <PickerRow
        icon={supplier ? 'checkmark-circle' : 'alert-circle-outline'}
        tone={supplier ? 'done' : 'pending'}
        title={supplier ? supplier.name : 'Not set'}
        hint={
          invoice.supplier_name
            ? `Invoice says: ${invoice.supplier_name}`
            : 'Nothing readable on the invoice'
        }
        actionLabel={supplier ? 'Change' : 'Choose'}
        onPress={() => setPicking('supplier')}
        disabled={locked}
      />

      <Text style={styles.label}>Delivered to</Text>
      <PickerRow
        icon={warehouse ? 'checkmark-circle' : 'ellipse-outline'}
        tone={warehouse ? 'done' : 'pending'}
        title={warehouse ? warehouse.name : 'Not set'}
        hint={
          invoice.delivery_location
            ? `Invoice says: ${invoice.delivery_location}`
            : 'Optional - where this delivery went'
        }
        actionLabel={warehouse ? 'Change' : 'Choose'}
        onPress={() => setPicking('warehouse')}
        disabled={locked}
      />

      <PickerSheet
        visible={picking === 'supplier'}
        title="Who supplied this?"
        searchPlaceholder="Search suppliers"
        choices={supplierList.map(candidate => ({value: candidate.id, label: candidate.name}))}
        selected={invoice.supplier}
        emptyLabel="No supplier by that name yet - add them below."
        createLabel={query =>
          `Add "${query || invoice.supplier_name || 'new supplier'}" as a supplier`
        }
        onCreate={onAddSupplier}
        creating={createSupplier.isPending}
        onSelect={value => onAssign({supplier: value})}
        onClose={() => setPicking(null)}
      />

      <PickerSheet
        visible={picking === 'warehouse'}
        title="Where did it go?"
        searchPlaceholder="Search storage areas"
        choices={warehouseList.map(candidate => ({value: candidate.id, label: candidate.name}))}
        selected={invoice.warehouse}
        // Storage areas are places someone set up once, not something to
        // invent mid-review - the staff API will not create one either.
        emptyLabel="No storage areas set up yet. A manager can add them."
        onSelect={value => onAssign({warehouse: value})}
        onClose={() => setPicking(null)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
}): React.JSX.Element {
  return (
    <View style={styles.totalsRow}>
      <View style={styles.totalsLabel}>
        <Text style={[styles.totalsLabelText, strong && styles.totalsStrong]}>{label}</Text>
        {hint ? <Text style={styles.totalsHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.totalsValue, strong && styles.totalsStrong]}>{value}</Text>
    </View>
  );
}

/**
 * What the lines come to, and what the invoice itself prints.
 *
 * Both, because they are different numbers and the difference matters. The
 * lines are what goes into stock and into what the restaurant has spent on
 * each product; the printed total is what the supplier will be paid, VAT
 * included. Showing only the first - which is what this screen used to do,
 * under the label "Invoice total" - made a VAT invoice look like it had been
 * read wrong, because the figure on screen was never the figure on the paper.
 *
 * Every printed row is optional. Plenty of invoices show no VAT at all, and a
 * row that says nothing is worse than no row, so each appears only when the
 * invoice actually carried that figure.
 */
function TotalsCard({invoice}: {invoice: InvoiceScan}): React.JSX.Element | null {
  const hasLines = invoice.lines_total !== null && invoice.line_items.length > 0;
  const printed = [
    invoice.stated_subtotal !== null && {label: 'Goods', value: invoice.stated_subtotal},
    invoice.stated_tax !== null && {label: 'VAT', value: invoice.stated_tax},
  ].filter(Boolean) as {label: string; value: string}[];

  if (!hasLines && printed.length === 0 && invoice.stated_total === null) {
    return null;
  }

  return (
    <Card style={styles.totalsCard}>
      <Text style={styles.totalsTitle}>Totals</Text>

      {hasLines ? (
        <TotalRow
          label="These lines"
          value={formatCurrency(invoice.lines_total as string)}
          hint="What goes into stock and spend"
        />
      ) : null}

      {printed.length > 0 || invoice.stated_total !== null ? (
        <>
          <View style={styles.totalsDivider} />
          {printed.map(row => (
            <TotalRow key={row.label} label={row.label} value={formatCurrency(row.value)} />
          ))}
          {invoice.stated_total !== null ? (
            <TotalRow
              label="Invoice total"
              value={formatCurrency(invoice.stated_total)}
              hint="As printed, VAT included"
              strong
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.totalsNote}>
          No printed totals could be read off this invoice, so there is nothing to check these lines
          against.
        </Text>
      )}

      {invoice.stated_tax === null && invoice.stated_total !== null ? (
        <Text style={styles.totalsNote}>No VAT is shown on this invoice.</Text>
      ) : null}
    </Card>
  );
}

/** One scanned invoice's line items - matching each to a stock item,
 * correcting whatever the AI misread, and confirming (which applies every
 * matched line's quantity to stock, see the backend's confirm_invoice) or
 * discarding it. Locked once confirmed or discarded - see `locked` below. */
export function InvoiceReviewScreen(): React.JSX.Element {
  const {
    params: {invoiceId},
  } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const invoice = useInvoiceScan(invoiceId);
  const items = useInventoryItems();
  const rescan = useRescanInvoice();
  const confirm = useConfirmInvoice();
  const discard = useDiscardInvoice();
  const [error, setError] = useState<string | null>(null);

  if (invoice.isLoading || items.isLoading) {
    return <LoadingView />;
  }
  if (invoice.error || items.error || !invoice.data) {
    return (
      <ErrorState
        message={describeApiError(invoice.error ?? items.error, 'Could not load this invoice.')}
        onRetry={() => {
          invoice.refetch();
          items.refetch();
        }}
      />
    );
  }

  const data = invoice.data;
  const locked = data.status !== 'PENDING';
  const itemList = items.data?.results ?? [];
  const allMatched = data.line_items.length > 0 && data.line_items.every(line => line.matched_item);

  async function onConfirm() {
    setError(null);
    try {
      await confirm.mutateAsync(invoiceId);
      navigation.goBack();
    } catch (err) {
      setError(describeApiError(err, 'Could not confirm this invoice.'));
    }
  }

  async function onDiscard() {
    setError(null);
    try {
      await discard.mutateAsync(invoiceId);
      navigation.goBack();
    } catch (err) {
      setError(describeApiError(err, 'Could not discard this invoice.'));
    }
  }

  async function onRescan() {
    setError(null);
    try {
      await rescan.mutateAsync(invoiceId);
    } catch (err) {
      setError(describeApiError(err, 'Could not rescan this invoice.'));
    }
  }

  const scanning = isScanInProgress(data.scan_state);

  return (
    <Screen>
      {data.content_type === 'application/pdf' ? (
        <View style={[styles.photo, styles.pdfPlaceholder]}>
          <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
          <Text style={styles.hint}>PDF invoice</Text>
        </View>
      ) : (
        <Image source={{uri: data.photo}} style={styles.photo} />
      )}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{data.supplier_name || 'Invoice review'}</Text>
        <Badge label={data.status} tone={STATUS_TONE[data.status] ?? 'neutral'} />
      </View>
      {data.invoice_date ? <Text style={styles.hint}>{formatDate(data.invoice_date)}</Text> : null}

      {scanning ? (
        <Card style={styles.scanningCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>
            Reading this invoice - the items will appear here in a moment. You can leave this screen
            and come back.
          </Text>
        </Card>
      ) : null}

      {data.scan_error ? (
        <Card>
          <Text style={styles.error}>{data.scan_error}</Text>
          <Button title="Try scanning again" onPress={onRescan} loading={rescan.isPending} />
        </Card>
      ) : null}

      {!scanning && !data.scan_error && data.line_items.length === 0 ? (
        <Card>
          <Text style={styles.hint}>
            Nothing was read off this invoice. Try scanning again, or add the items by hand.
          </Text>
          <Button title="Try scanning again" onPress={onRescan} loading={rescan.isPending} />
        </Card>
      ) : null}

      {data.status === 'DUPLICATE' ? (
        <Card>
          <Text style={styles.error}>
            This is the same file as an invoice already uploaded, so it has not been read.
            Confirming it would count the same delivery twice.
          </Text>
        </Card>
      ) : data.duplicate_of ? (
        <Card>
          <Text style={styles.warning}>
            An invoice with this number from this supplier has been uploaded before. It has still
            been read, so you can compare the two before deciding.
          </Text>
        </Card>
      ) : null}

      {data.reconciliation.status === 'mismatch' ? (
        <Card>
          <Text style={styles.warning}>
            These lines add up to {formatCurrency(data.reconciliation.actual ?? 0)}, but the invoice
            says {formatCurrency(data.reconciliation.expected ?? 0)} - a difference of{' '}
            {formatCurrency(data.reconciliation.difference ?? 0)}.
          </Text>
          <Text style={styles.hint}>
            Worth checking a quantity or price before confirming. Delivery charges, discounts and
            deposits can explain it too.
          </Text>
        </Card>
      ) : null}

      <SourceCard invoice={data} locked={locked} />

      {data.line_items.map((line, index) => (
        <FadeIn key={line.id} delay={index * 40}>
          <LineItemCard
            line={line}
            index={index}
            items={itemList}
            invoiceId={invoiceId}
            locked={locked}
          />
        </FadeIn>
      ))}

      <TotalsCard invoice={data} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!locked ? (
        <>
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button
                title="Discard"
                variant="secondary"
                onPress={onDiscard}
                loading={discard.isPending}
              />
            </View>
            <View style={styles.actionButton}>
              <Button
                title="Confirm"
                onPress={onConfirm}
                loading={confirm.isPending}
                disabled={!allMatched}
              />
            </View>
          </View>
          {!allMatched ? (
            <Text style={styles.hint}>
              Match every line to an inventory item before confirming.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: {width: '100%', height: 180, borderRadius: radii.lg, backgroundColor: colors.surface},
  pdfPlaceholder: {alignItems: 'center', justifyContent: 'center', gap: spacing.xs},
  scanningCard: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  totalsCard: {gap: spacing.xs},
  totalsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 3,
  },
  totalsLabel: {flex: 1, gap: 1},
  totalsLabelText: {fontSize: 14, color: colors.textMuted},
  totalsValue: {fontSize: 15, color: colors.text, fontVariant: ['tabular-nums']},
  totalsStrong: {fontSize: 18, fontWeight: '700', color: colors.primary},
  totalsHint: {fontSize: 11, color: colors.textMuted},
  totalsDivider: {height: 1, backgroundColor: colors.border, marginVertical: spacing.xs},
  totalsNote: {fontSize: 12, color: colors.textMuted, marginTop: spacing.xs},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm},
  hint: {fontSize: 12, color: colors.textMuted},
  lineHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  lineNumber: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  removeButton: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  removeLabel: {fontSize: 12, color: colors.textMuted},
  lineMaths: {fontSize: 12, color: colors.textMuted},
  lineMathsTotal: {color: colors.text, fontWeight: '700'},
  // Unmatched is the state that needs doing something about, so it is the one
  // that carries a colour.
  lineCard: {gap: spacing.sm},
  pairRow: {flexDirection: 'row', gap: spacing.sm},
  pairField: {flex: 1},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  error: {color: colors.danger, fontSize: 12},
  warning: {color: colors.warning, fontSize: 12},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm},
  actionButton: {flexGrow: 1, flexBasis: 120},
});
