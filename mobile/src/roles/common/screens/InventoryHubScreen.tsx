import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Ionicons} from '@expo/vector-icons';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {PressableScale} from '../../../components/PressableScale';
import {Screen} from '../../../components/Screen';
import {SegmentedToggle, type SegmentedOption} from '../../../components/SegmentedToggle';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {
  captureInvoice,
  describePermissionDenied,
  PermissionDenied,
  type CaptureSource,
} from '../../../features/inventory/capture';
import {
  useAdjustStock,
  useInventoryItems,
  useInvoiceScans,
  useStockMovements,
  useUploadInvoice,
} from '../../../features/inventory/hooks';
import {STOCK_MOVEMENT_REASON_LABELS} from '../../../features/inventory/types';
import type {InventoryItem, StockMovementReason} from '../../../features/inventory/types';
import type {InventoryStackParamList} from '../../../navigation/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing} from '../../../theme';
import {isAdmin} from '../../../types/roles';
import {formatCurrency, formatDateTime} from '../../../utils/format';

type Nav = NativeStackNavigationProp<InventoryStackParamList>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The three ways an invoice gets in.
 *
 * Peers, drawn the same. They used to be one filled button and two outlined
 * ones, which in this palette is how a *chosen* thing looks - so "Take photo"
 * read as already selected, and tapping either of the others left it looking
 * that way.
 */
const SCAN_OPTIONS: {source: CaptureSource; label: string; icon: IconName}[] = [
  {source: 'camera', label: 'Take photo', icon: 'camera-outline'},
  {source: 'library', label: 'From gallery', icon: 'images-outline'},
  {source: 'document', label: 'Upload a PDF', icon: 'document-text-outline'},
];

/** Where a manager goes from here. Admin-only: the screens behind these are
 * all IsAdmin on the API, and staff are shown the stock list alone. */
const MANAGE_LINKS: {
  route: 'PurchaseHistory' | 'ManageSources' | 'ManageInventoryItems';
  label: string;
  hint: string;
  icon: IconName;
}[] = [
  {
    route: 'PurchaseHistory',
    label: 'Purchases',
    hint: 'Purchase history',
    icon: 'trending-up-outline',
  },
  {
    route: 'ManageSources',
    label: 'Suppliers',
    hint: 'Suppliers and storage areas',
    icon: 'business-outline',
  },
  {
    route: 'ManageInventoryItems',
    label: 'Items',
    hint: 'Manage inventory items',
    icon: 'cube-outline',
  },
];

const QUICK_REASONS: (SegmentedOption<StockMovementReason> & {sign: 1 | -1})[] = [
  {value: 'DELIVERY', label: 'Add stock', icon: 'arrow-down-circle-outline', sign: 1},
  {value: 'WASTE', label: 'Remove (waste)', icon: 'trash-outline', sign: -1},
];

/**
 * One of the three, with the press dip every other control has and an amber
 * outline for as long as its upload is running.
 *
 * Which one was tapped is the whole point: a picker takes a moment to open,
 * and a file takes longer than that to upload, so without it the screen sits
 * there looking like the tap missed. The other two go quiet meanwhile rather
 * than all three spinning at once, which is what they used to do - every
 * button shared one `loading` flag, so the app appeared to be doing three
 * things when it was doing one.
 */
function ScanOption({
  option,
  busy,
  disabled,
  onPress,
}: {
  option: (typeof SCAN_OPTIONS)[number];
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{busy, disabled: busy || disabled}}
      accessibilityLabel={option.label}
      style={[styles.scanOption, busy && styles.scanOptionBusy, disabled && styles.scanOptionOff]}>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name={option.icon} size={22} color={colors.primary} />
      )}
      <Text style={styles.scanOptionLabel} numberOfLines={2}>
        {option.label}
      </Text>
    </PressableScale>
  );
}

/** One figure with its name above it. Four of these say more about a stock
 * item than the one line the row used to carry. */
function Fact({label, value}: {label: string; value: string}): React.JSX.Element {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Where this item's stock has been going.
 *
 * The number on the row is a running total and says nothing about how it got
 * there. "12kg" could be a delivery this morning or a count nobody has touched
 * in a month, and only one of those is worth acting on. Each line says what
 * moved it, when, and who did it.
 *
 * Fetched when the row opens rather than with the list: one restaurant can
 * hold hundreds of items, and a history request per row on mount would be
 * hundreds of requests to show nothing anybody asked for.
 */
function MovementHistory({itemId, unit}: {itemId: string; unit: string}): React.JSX.Element {
  const movements = useStockMovements(itemId);

  if (movements.isLoading) {
    return <ActivityIndicator color={colors.primary} style={styles.historyLoading} />;
  }

  const recent = (movements.data?.results ?? []).slice(0, 5);
  if (recent.length === 0) {
    return (
      <Text style={styles.historyEmpty}>
        Nothing has moved yet. Confirming a scanned invoice adds to this, as does an adjustment
        below.
      </Text>
    );
  }

  return (
    <View style={styles.history}>
      <Text style={styles.historyTitle}>Recent movements</Text>
      {recent.map(movement => {
        const delta = Number(movement.quantity_delta);
        const incoming = delta >= 0;
        return (
          <View key={movement.id} style={styles.movement}>
            <Text style={[styles.movementDelta, incoming ? styles.deltaIn : styles.deltaOut]}>
              {incoming ? '+' : '-'}
              {Math.abs(delta)} {unit}
            </Text>
            <View style={styles.movementText}>
              <Text style={styles.movementReason} numberOfLines={1}>
                {STOCK_MOVEMENT_REASON_LABELS[movement.reason] ?? movement.reason}
              </Text>
              <Text style={styles.movementMeta} numberOfLines={1}>
                {formatDateTime(movement.created_at)}
                {movement.recorded_by_name ? ` · ${movement.recorded_by_name}` : ''}
                {movement.note ? ` · ${movement.note}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One stock item: a line you can open for its figures, its recent movements
 * and a way to correct the count.
 *
 * Which one is open is the list's business rather than each row's. Rows that
 * each remembered their own state left every one you had ever tapped standing
 * open behind you, so the thing you just opened could be several screens down
 * from where you were looking.
 */
function ItemRow({
  item,
  open,
  onToggle,
}: {
  item: InventoryItem;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const adjust = useAdjustStock();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<StockMovementReason>('DELIVERY');
  const [error, setError] = useState<string | null>(null);

  // A half-typed quantity belongs to the moment it was typed in. Left behind,
  // it reappears the next time this row is opened, against a count that has
  // moved on since.
  useEffect(() => {
    if (!open) {
      setAmount('');
      setError(null);
    }
  }, [open]);

  async function onSave() {
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }
    setError(null);
    const sign = QUICK_REASONS.find(r => r.value === reason)?.sign ?? 1;
    try {
      await adjust.mutateAsync({item: item.id, quantity_delta: parsed * sign, reason});
      setAmount('');
      onToggle();
    } catch (err) {
      setError(describeApiError(err, 'Could not update stock.'));
    }
  }

  return (
    <Card>
      <PressableScale style={styles.row} onPress={onToggle}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.hint}>
            {item.quantity_on_hand} {item.unit}
            {item.par_level ? ` (par ${item.par_level})` : ''}
          </Text>
        </View>
        {item.is_below_par ? <Badge label="Low stock" tone="warning" /> : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </PressableScale>

      {open ? (
        <View style={styles.editor}>
          <View style={styles.factRow}>
            <Fact label="In stock" value={`${item.quantity_on_hand} ${item.unit}`} />
            <Fact
              label="Par level"
              value={item.par_level ? `${item.par_level} ${item.unit}` : '-'}
            />
            <Fact
              label="Unit cost"
              value={item.cost_per_unit ? formatCurrency(item.cost_per_unit) : '-'}
            />
            <Fact
              label="Stock value"
              value={
                item.cost_per_unit
                  ? formatCurrency(Number(item.cost_per_unit) * Number(item.quantity_on_hand))
                  : '-'
              }
            />
          </View>

          <MovementHistory itemId={item.id} unit={item.unit} />

          <View style={styles.adjustBlock}>
            <Text style={styles.adjustTitle}>Adjust stock</Text>
            {/* Two directions, one of which subtracts - worth showing both at
                once and sliding between them, because picking the wrong one
                moves stock the wrong way. */}
            <SegmentedToggle
              options={QUICK_REASONS}
              value={reason}
              onChange={setReason}
              accessibilityLabel="Add stock or remove it"
              compact
            />
            <TextField
              label={`Quantity (${item.unit})`}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Save" onPress={onSave} loading={adjust.isPending} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** Stock levels, a "scan an invoice" shortcut, and any invoices still
 * awaiting review - shared by staff and admin like the compliance hubs:
 * both roles view and log stock the same way, only managing an item's par
 * level/deactivating one is admin-only (see ManageInventoryItemsScreen). */
export function InventoryHubScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const items = useInventoryItems();
  const pending = useInvoiceScans('PENDING');
  const uploadInvoice = useUploadInvoice();
  const [error, setError] = useState<string | null>(null);
  // Which of the three is working, rather than merely that something is.
  const [busySource, setBusySource] = useState<CaptureSource | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const canManageItems = useAuthStore(state => Boolean(state.user && isAdmin(state.user.role)));

  async function onScan(source: CaptureSource) {
    setError(null);
    setBusySource(source);
    try {
      const file = await captureInvoice(source);
      if (!file) {
        return;
      }
      const invoice = await uploadInvoice.mutateAsync(file);
      // The read has only been queued - the review screen polls for it.
      navigation.navigate('InvoiceReview', {invoiceId: invoice.id});
    } catch (err) {
      if (err instanceof PermissionDenied) {
        setError(describePermissionDenied(err.source));
        return;
      }
      setError(describeApiError(err, 'Could not upload that invoice.'));
    } finally {
      // Runs on the way out too. The screen stays mounted under the review
      // screen we navigate to, and coming back to three dead buttons would be
      // worse than the flicker of clearing it.
      setBusySource(null);
    }
  }

  if (items.isLoading || pending.isLoading) {
    return <LoadingView />;
  }
  if (items.error || pending.error) {
    return (
      <ErrorState
        message={describeApiError(items.error ?? pending.error, 'Could not load inventory.')}
        onRetry={() => {
          items.refetch();
          pending.refetch();
        }}
      />
    );
  }

  const itemList = items.data?.results ?? [];
  const pendingList = pending.data?.results ?? [];

  return (
    <Screen
      onRefresh={() => {
        items.refetch();
        pending.refetch();
      }}
      refreshing={items.isRefetching || pending.isRefetching}>
      {/* Three places to go, drawn as such. They were three amber words in a
          row, which in this app is how a link inside a sentence looks - so
          they read as a filter on the list below, or as nothing at all, rather
          than as the way into three other screens. */}
      {canManageItems ? (
        <View style={styles.manageRow}>
          {MANAGE_LINKS.map(link => (
            <PressableScale
              key={link.route}
              onPress={() => navigation.navigate(link.route)}
              accessibilityRole="button"
              accessibilityLabel={link.hint}
              style={styles.manageTile}>
              <Ionicons name={link.icon} size={20} color={colors.primary} />
              <Text style={styles.manageLabel} numberOfLines={1}>
                {link.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <Card style={styles.scanCard}>
        <Text style={styles.hint}>
          Photograph a delivery invoice, or pick a PDF a supplier sent you - the app reads off the
          items, quantities and prices for you to check before they're added to stock.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttonRow}>
          {SCAN_OPTIONS.map(option => (
            <ScanOption
              key={option.source}
              option={option}
              busy={busySource === option.source}
              disabled={busySource !== null && busySource !== option.source}
              onPress={() => onScan(option.source)}
            />
          ))}
        </View>
      </Card>

      {pendingList.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Awaiting review</Text>
          {pendingList.map((invoice, index) => (
            <FadeIn key={invoice.id} delay={index * 40}>
              <Pressable
                onPress={() => navigation.navigate('InvoiceReview', {invoiceId: invoice.id})}>
                <Card style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{invoice.supplier_name || 'Unknown supplier'}</Text>
                    <Text style={styles.hint}>
                      {invoice.scan_error
                        ? 'Could not read this invoice'
                        : `${invoice.line_items.length} item${
                            invoice.line_items.length === 1 ? '' : 's'
                          } to review`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Card>
              </Pressable>
            </FadeIn>
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Stock</Text>
      {itemList.length === 0 ? (
        <EmptyState
          title="No stock items yet"
          body="Scan your first invoice - a manager can also add items by hand."
        />
      ) : (
        itemList.map((item, index) => (
          <FadeIn key={item.id} delay={index * 30}>
            <ItemRow
              item={item}
              open={openItem === item.id}
              onToggle={() => setOpenItem(current => (current === item.id ? null : item.id))}
            />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  manageRow: {flexDirection: 'row', gap: spacing.sm},
  // Icon above label, not beside it. Side by side, an icon and a chevron and
  // their gaps left about 48px for a word that wants 62, so the longest of the
  // three - "Purchases" - came out as "Purcha...". Stacked, the label has the
  // tile's full width and all three fit at any phone size.
  manageTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manageLabel: {fontSize: 13, fontWeight: '600', color: colors.text},
  sectionTitle: {fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  buttonRow: {flexDirection: 'row', gap: spacing.sm},
  scanOption: {
    // Equal thirds: three of anything in a row on a narrow phone only works
    // if none of them is wider than the others.
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  scanOptionBusy: {borderColor: colors.primary},
  scanOptionOff: {opacity: 0.4},
  scanOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  scanCard: {gap: spacing.sm},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  rowText: {flex: 1},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  fact: {flexBasis: '47%', flexGrow: 1, gap: 2},
  factRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  factLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  factValue: {fontSize: 15, fontWeight: '600', color: colors.text},
  history: {gap: spacing.xs},
  historyTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  historyLoading: {alignSelf: 'flex-start'},
  historyEmpty: {fontSize: 12, color: colors.textMuted},
  movement: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  movementDelta: {fontSize: 13, fontWeight: '700', minWidth: 74},
  deltaIn: {color: colors.success},
  deltaOut: {color: colors.warning},
  movementText: {flex: 1},
  movementReason: {fontSize: 13, color: colors.text},
  movementMeta: {fontSize: 11, color: colors.textMuted},
  adjustBlock: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  adjustTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  editor: {marginTop: spacing.sm, gap: spacing.sm},
  error: {color: colors.danger, fontSize: 12},
});
