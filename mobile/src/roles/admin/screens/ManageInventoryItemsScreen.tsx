import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

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
  useAdminInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from '../../../features/inventory/hooks';
import type {AdminInventoryItem} from '../../../features/inventory/types';
import {colors, spacing} from '../../../theme';

function ItemRow({item}: {item: AdminInventoryItem}): React.JSX.Element {
  const update = useUpdateInventoryItem();
  const [parLevel, setParLevel] = useState(item.par_level ?? '');
  const [error, setError] = useState<string | null>(null);

  async function onSavePar() {
    setError(null);
    try {
      await update.mutateAsync({id: item.id, input: {par_level: parLevel || null}});
    } catch (err) {
      setError(describeApiError(err, 'Could not save that par level.'));
    }
  }

  async function onToggleActive() {
    setError(null);
    try {
      await update.mutateAsync({id: item.id, input: {is_active: !item.is_active}});
    } catch (err) {
      setError(describeApiError(err, 'Could not update that item.'));
    }
  }

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.itemText}>{item.name}</Text>
          <Text style={styles.hint}>
            {item.quantity_on_hand} {item.unit} on hand
            {item.cost_per_unit ? ` · £${item.cost_per_unit}/${item.unit}` : ''}
          </Text>
        </View>
        {!item.is_active ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>

      <TextField
        label={`Par level (${item.unit}) - optional`}
        keyboardType="decimal-pad"
        placeholder="e.g. 5"
        value={parLevel}
        onChangeText={setParLevel}
        onBlur={onSavePar}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={item.is_active ? 'Deactivate' : 'Reactivate'}
        variant="secondary"
        onPress={onToggleActive}
        loading={update.isPending}
      />
    </Card>
  );
}

/** Setting a stock item's low-stock threshold, or retiring one - adding a
 * new item can also be done inline while matching an invoice line (see
 * InvoiceReviewScreen), but a threshold is a manager decision made here. */
export function ManageInventoryItemsScreen(): React.JSX.Element {
  const items = useAdminInventoryItems();
  const create = useCreateInventoryItem();

  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (!newName.trim() || !newUnit.trim()) {
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({name: newName.trim(), unit: newUnit.trim()});
      setNewName('');
      setNewUnit('');
    } catch (err) {
      setError(describeApiError(err, 'Could not add that item.'));
    }
  }

  if (items.isLoading) {
    return <LoadingView />;
  }
  if (items.error) {
    return (
      <ErrorState
        message={describeApiError(items.error, 'Could not load inventory items.')}
        onRetry={() => items.refetch()}
      />
    );
  }

  const itemList = items.data?.results ?? [];

  return (
    <Screen onRefresh={() => items.refetch()} refreshing={items.isRefetching}>
      <Text style={styles.heading}>Manage inventory items</Text>

      {itemList.length === 0 ? (
        <EmptyState title="No items yet" body="Add the first one below." />
      ) : (
        itemList.map((item, index) => (
          <FadeIn key={item.id} delay={index * 40}>
            <ItemRow item={item} />
          </FadeIn>
        ))
      )}

      <Card style={styles.addCard}>
        <TextField
          label="New item name"
          placeholder="e.g. Chicken Breast"
          value={newName}
          onChangeText={setNewName}
        />
        <TextField
          label="Unit"
          placeholder="e.g. kg, litre, each"
          value={newUnit}
          onChangeText={setNewUnit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Add item" onPress={onAdd} loading={create.isPending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowText: {flex: 1, marginRight: spacing.sm},
  itemText: {fontSize: 15, fontWeight: '600', color: colors.text},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  error: {color: colors.danger, fontSize: 12},
  addCard: {gap: spacing.sm},
});
