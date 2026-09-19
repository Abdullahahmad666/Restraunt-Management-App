import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {Ionicons} from '@expo/vector-icons';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
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

const QUICK_REASONS: {value: StockMovementReason; label: string; sign: 1 | -1}[] = [
  {value: 'DELIVERY', label: 'Add stock', sign: 1},
  {value: 'WASTE', label: 'Remove (waste)', sign: -1},
];

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
      <Pressable style={styles.row} onPress={() => setEditing(current => !current)}>
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
      </Pressable>

      {editing ? (
        <View style={styles.editor}>
          <View style={styles.chipRow}>
            {QUICK_REASONS.map(option => (
              <Pressable
                key={option.value}
                onPress={() => setReason(option.value)}
                style={[styles.chip, reason === option.value && styles.chipActive]}>
                <Text style={[styles.chipLabel, reason === option.value && styles.chipLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
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
  const canManageItems = useAuthStore(state => Boolean(state.user && isAdmin(state.user.role)));

  async function onScan(fromCamera: boolean) {
    setError(null);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        fromCamera ? 'Camera access is off for Invisiko.' : 'Photo access is off for Invisiko.',
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({quality: 0.7})
      : await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 0.7});
    if (result.canceled || !result.assets[0]) {
      return;
    }
    try {
      const invoice = await uploadInvoice.mutateAsync(result.assets[0].uri);
      navigation.navigate('InvoiceReview', {invoiceId: invoice.id});
    } catch (err) {
      setError(describeApiError(err, 'Could not upload that invoice.'));
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
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Inventory</Text>
        {canManageItems ? (
          <Pressable onPress={() => navigation.navigate('ManageInventoryItems')} hitSlop={8}>
            <Text style={styles.manageLink}>Manage items</Text>
          </Pressable>
        ) : null}
      </View>

      <Card style={styles.scanCard}>
        <Text style={styles.hint}>
          Photograph a delivery invoice - the app reads off the items, quantities and prices for you
          to check before they're added to stock.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.chipRow}>
          <View style={styles.scanButton}>
            <Button
              title="Take photo"
              onPress={() => onScan(true)}
              loading={uploadInvoice.isPending}
            />
          </View>
          <View style={styles.scanButton}>
            <Button
              title="Choose photo"
              variant="secondary"
              onPress={() => onScan(false)}
              loading={uploadInvoice.isPending}
            />
          </View>
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
          body="Scan your first invoice, or add items from Manage inventory."
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {fontSize: 20, fontWeight: '700', color: colors.text},
  manageLink: {fontSize: 13, color: colors.primary, fontWeight: '600'},
  sectionTitle: {fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm},
  scanCard: {gap: spacing.sm},
  scanButton: {flexGrow: 1, flexBasis: 120},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  rowText: {flex: 1},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  editor: {marginTop: spacing.sm, gap: spacing.sm},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipLabel: {fontSize: 13, color: colors.text},
  chipLabelActive: {color: '#FFFFFF', fontWeight: '600'},
  error: {color: colors.danger, fontSize: 12},
});
