import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';

import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {
  useChecklistCompletions,
  useChecklistItems,
  useCompleteChecklistItem,
  useUncompleteChecklistItem,
} from '../../../features/compliance/hooks';
import {ROUTINE_LABELS} from '../../../features/compliance/types';
import type {ChecklistCompletion, ChecklistItem} from '../../../features/compliance/types';
import type {ComplianceStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';

type Route = RouteProp<ComplianceStackParamList, 'Checklist'>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ChecklistRow({
  item,
  completion,
  date,
}: {
  item: ChecklistItem;
  completion: ChecklistCompletion | undefined;
  date: string;
}): React.JSX.Element {
  const complete = useCompleteChecklistItem();
  const uncomplete = useUncompleteChecklistItem();
  const [error, setError] = useState<string | null>(null);
  const pending = complete.isPending || uncomplete.isPending;

  async function onToggle() {
    setError(null);
    try {
      if (completion) {
        await uncomplete.mutateAsync(completion.id);
      } else {
        await complete.mutateAsync({checklist_item: item.id, date});
      }
    } catch (err) {
      setError(describeApiError(err, 'Could not update that check.'));
    }
  }

  return (
    <Card>
      <Pressable style={styles.row} onPress={onToggle} disabled={pending}>
        <View style={[styles.checkbox, completion && styles.checkboxDone]}>
          {completion ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.itemText, completion && styles.itemTextDone]}>{item.text}</Text>
          {completion ? (
            <Text style={styles.hint}>
              {completion.completed_by_name} at {formatTime(completion.completed_at)}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

/** The opening or closing checklist, ticked off by the whole team, see
 * apps.compliance.services.completion on the backend for why tapping an
 * already-done item twice never errors, and unticking one is a plain
 * delete - a completion either exists for today or it doesn't. */
export function ChecklistScreen(): React.JSX.Element {
  const {
    params: {routine},
  } = useRoute<Route>();
  const date = todayIso();

  const items = useChecklistItems(routine);
  const completions = useChecklistCompletions(date);

  if (items.isLoading || completions.isLoading) {
    return <LoadingView />;
  }
  if (items.error || completions.error) {
    return (
      <ErrorState
        message={describeApiError(
          items.error ?? completions.error,
          'Could not load the checklist.',
        )}
        onRetry={() => {
          items.refetch();
          completions.refetch();
        }}
      />
    );
  }

  const completionByItem = new Map(
    (completions.data?.results ?? []).map(completion => [completion.checklist_item, completion]),
  );
  const itemList = items.data?.results ?? [];

  return (
    <Screen onRefresh={() => completions.refetch()} refreshing={completions.isRefetching}>
      <Text style={styles.heading}>{ROUTINE_LABELS[routine]} checklist</Text>

      {itemList.length === 0 ? (
        <EmptyState
          title="No checklist items yet"
          body="Ask your manager to add them in Manage compliance."
        />
      ) : (
        itemList.map((item, index) => (
          <FadeIn key={item.id} delay={index * 40}>
            <ChecklistRow item={item} completion={completionByItem.get(item.id)} date={date} />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {backgroundColor: colors.success, borderColor: colors.success},
  rowText: {flex: 1},
  itemText: {fontSize: 15, color: colors.text},
  itemTextDone: {color: colors.textMuted, textDecorationLine: 'line-through'},
  hint: {fontSize: 12, color: colors.textMuted, marginTop: 2},
  error: {color: colors.danger, fontSize: 12, marginTop: spacing.xs},
});
