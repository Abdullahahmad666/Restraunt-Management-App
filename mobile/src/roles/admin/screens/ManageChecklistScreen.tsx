import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';

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
  useAdminChecklistItems,
  useCreateChecklistItem,
  useUpdateChecklistItem,
} from '../../../features/compliance/hooks';
import {ROUTINE_LABELS} from '../../../features/compliance/types';
import type {AdminChecklistItem} from '../../../features/compliance/types';
import type {AdminStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';

type Route = RouteProp<AdminStackParamList, 'ManageChecklist'>;

function ItemRow({item}: {item: AdminChecklistItem}): React.JSX.Element {
  const toggleActive = useUpdateChecklistItem();
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    setError(null);
    try {
      await toggleActive.mutateAsync({id: item.id, input: {is_active: !item.is_active}});
    } catch (err) {
      setError(describeApiError(err, 'Could not update that item.'));
    }
  }

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.itemText}>{item.text}</Text>
        {!item.is_active ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={item.is_active ? 'Deactivate' : 'Reactivate'}
        variant="secondary"
        onPress={onToggle}
        loading={toggleActive.isPending}
      />
    </Card>
  );
}

/** Add, deactivate, or reactivate a line on the opening or closing
 * checklist. Deactivating rather than deleting keeps a past day's
 * completions meaningful even once an item's retired - see the backend
 * serializer's comment for why. */
export function ManageChecklistScreen(): React.JSX.Element {
  const {
    params: {routine},
  } = useRoute<Route>();
  const items = useAdminChecklistItems(routine);
  const create = useCreateChecklistItem();

  const [newText, setNewText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (!newText.trim()) {
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({routine, text: newText.trim()});
      setNewText('');
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
        message={describeApiError(items.error, 'Could not load the checklist.')}
        onRetry={() => items.refetch()}
      />
    );
  }

  const itemList = items.data?.results ?? [];

  return (
    <Screen onRefresh={() => items.refetch()} refreshing={items.isRefetching}>
      <Text style={styles.heading}>{ROUTINE_LABELS[routine]} checklist</Text>

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
          label="New item"
          placeholder="e.g. Floors swept and clean"
          value={newText}
          onChangeText={setNewText}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Add to checklist" onPress={onAdd} loading={create.isPending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  itemText: {fontSize: 15, color: colors.text, flex: 1, marginRight: spacing.sm},
  error: {color: colors.danger, fontSize: 12},
  addCard: {gap: spacing.sm},
});
