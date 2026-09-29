import React, {useState} from 'react';
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
  useUploadInvoice,
} from '../../../features/inventory/hooks';
import type {InventoryItem, StockMovementReason} from '../../../features/inventory/types';
import type {InventoryStackParamList} from '../../../navigation/types';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing} from '../../../theme';
import {isAdmin} from '../../../types/roles';

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

function ItemRow({item}: {item: InventoryItem}): React.JSX.Element {
  const adjust = useAdjustStock();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<StockMovementReason>('DELIVERY');
  const [error, setError] = useState<string | null>(null);

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
      setEditing(false);
    } catch (err) {
      setError(describeApiError(err, 'Could not update stock.'));
    }
  }

  return (
    <Card>
      <PressableScale style={styles.row} onPress={() => setEditing(current => !current)}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.hint}>
            {item.quantity_on_hand} {item.unit}
            {item.par_level ? ` (par ${item.par_level})` : ''}
          </Text>
        </View>
        {item.is_below_par ? <Badge label="Low stock" tone="warning" /> : null}
        <Ionicons
          name={editing ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </PressableScale>

      {editing ? (
        <View style={styles.editor}>
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
      {canManageItems ? (
        <View style={styles.headerLinks}>
          <Pressable onPress={() => navigation.navigate('PurchaseHistory')} hitSlop={8}>
            <Text style={styles.manageLink}>Purchases</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('ManageSources')} hitSlop={8}>
            <Text style={styles.manageLink}>Suppliers</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('ManageInventoryItems')} hitSlop={8}>
            <Text style={styles.manageLink}>Items</Text>
          </Pressable>
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
            <ItemRow item={item} />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLinks: {flexDirection: 'row', gap: spacing.md},
  manageLink: {fontSize: 13, color: colors.primary, fontWeight: '600'},
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
  editor: {marginTop: spacing.sm, gap: spacing.sm},
  error: {color: colors.danger, fontSize: 12},
});
