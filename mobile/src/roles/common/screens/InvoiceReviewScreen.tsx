import React, {useState} from 'react';
import {ActivityIndicator, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {FilterChip} from '../../../components/FilterChip';
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
  items,
  invoiceId,
  locked,
}: {
  line: InvoiceLineItem;
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

  async function onCreateAndMatch() {
    setError(null);
    try {
      const created = await createItem.mutateAsync({
        name: rawName.trim() || line.raw_name,
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

  return (
    <Card style={styles.lineCard}>
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

      <Text style={styles.label}>Match to inventory item</Text>
      <View style={styles.chipRow}>
        {items.map(item => (
          <FilterChip
            key={item.id}
            label={item.name}
            selected={line.matched_item === item.id}
            disabled={locked}
            onPress={() => onMatch(item.id)}
          />
        ))}
      </View>

      {!line.matched_item && !locked ? (
        <Button
          title={`+ New item: ${rawName || line.raw_name}`}
          variant="secondary"
          onPress={onCreateAndMatch}
          loading={createItem.isPending}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!locked ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.removeLink}>Remove this line</Text>
        </Pressable>
      ) : null}
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

  const supplierList = suppliers.data?.results ?? [];
  const warehouseList = warehouses.data?.results ?? [];

  async function onAssign(input: {supplier?: string | null; warehouse?: string | null}) {
    setError(null);
    try {
      await assign.mutateAsync(input);
    } catch (err) {
      setError(describeApiError(err, 'Could not update this invoice.'));
    }
  }

  async function onAddSupplier() {
    setError(null);
    try {
      const created = await createSupplier.mutateAsync(invoice.supplier_name);
      await assign.mutateAsync({supplier: created.id});
    } catch (err) {
      setError(describeApiError(err, 'Could not add that supplier.'));
    }
  }

  // Offered only when the scan read a name that matches nothing we have -
  // adding a supplier called "" helps nobody.
  const canAddScannedSupplier =
    !locked && !invoice.supplier && invoice.supplier_name.trim().length > 0;

  return (
    <Card style={styles.lineCard}>
      <Text style={styles.label}>Supplier</Text>
      {invoice.supplier_name ? (
        <Text style={styles.hint}>Read from the invoice: {invoice.supplier_name}</Text>
      ) : null}
      <View style={styles.chipRow}>
        {supplierList.map(supplier => {
          const selected = invoice.supplier === supplier.id;
          return (
            <FilterChip
              key={supplier.id}
              label={supplier.name}
              selected={selected}
              disabled={locked}
              onPress={() => onAssign({supplier: selected ? null : supplier.id})}
            />
          );
        })}
      </View>
      {canAddScannedSupplier ? (
        <Button
          title={`+ New supplier: ${invoice.supplier_name}`}
          variant="secondary"
          onPress={onAddSupplier}
          loading={createSupplier.isPending}
        />
      ) : null}

      <Text style={styles.label}>Delivered to</Text>
      {warehouseList.length === 0 ? (
        <Text style={styles.hint}>No storage areas set up yet - a manager can add them.</Text>
      ) : (
        <View style={styles.chipRow}>
          {warehouseList.map(warehouse => {
            const selected = invoice.warehouse === warehouse.id;
            return (
              <FilterChip
                key={warehouse.id}
                label={warehouse.name}
                selected={selected}
                disabled={locked}
                onPress={() => onAssign({warehouse: selected ? null : warehouse.id})}
              />
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
          <LineItemCard line={line} items={itemList} invoiceId={invoiceId} locked={locked} />
        </FadeIn>
      ))}

      {data.lines_total !== null && data.line_items.length > 0 ? (
        <Card style={styles.totalRow}>
          <Text style={styles.label}>Invoice total</Text>
          <Text style={styles.total}>{formatCurrency(data.lines_total)}</Text>
        </Card>
      ) : null}

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
  totalRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  total: {fontSize: 20, fontWeight: '700', color: colors.primary},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heading: {fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm},
  hint: {fontSize: 12, color: colors.textMuted},
  lineCard: {gap: spacing.sm},
  pairRow: {flexDirection: 'row', gap: spacing.sm},
  pairField: {flex: 1},
  label: {fontSize: 13, fontWeight: '600', color: colors.textMuted},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  removeLink: {fontSize: 12, color: colors.danger, fontWeight: '600'},
  error: {color: colors.danger, fontSize: 12},
  warning: {color: colors.warning, fontSize: 12},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm},
  actionButton: {flexGrow: 1, flexBasis: 120},
});
