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
  useChecklistTaskCompletions,
  useChecklistTasks,
  useCompleteChecklistTask,
  useUncompleteChecklistTask,
} from '../../../features/compliance/hooks';
import type {ChecklistTask, ChecklistTaskCompletion} from '../../../features/compliance/types';
import type {ComplianceStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';

type Route = RouteProp<ComplianceStackParamList, 'ChecklistTemplateTasks'>;

function TaskRow({
  task,
  completion,
}: {
  task: ChecklistTask;
  completion: ChecklistTaskCompletion | undefined;
}): React.JSX.Element {
  const complete = useCompleteChecklistTask();
  const uncomplete = useUncompleteChecklistTask();
  const [error, setError] = useState<string | null>(null);
  const pending = complete.isPending || uncomplete.isPending;

  async function onToggle() {
    setError(null);
    try {
      if (completion) {
        await uncomplete.mutateAsync(completion.id);
      } else {
        await complete.mutateAsync(task.id);
      }
    } catch (err) {
      setError(describeApiError(err, 'Could not update that task.'));
    }
  }

  return (
    <Card>
      <Pressable style={styles.row} onPress={onToggle} disabled={pending}>
        <View style={[styles.checkbox, completion && styles.checkboxDone]}>
          {completion ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.itemText, completion && styles.itemTextDone]}>{task.text}</Text>
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

/** One named checklist's tasks ("Toilet Cleaning" -> "Clean and disinfect
 * toilets", "Restock soap") ticked off by the whole team for the current
 * period - today/this week/this month, decided by the backend from the
 * checklist's own frequency, so there's no date to pick here the way
 * ChecklistScreen's opening/closing completions have. */
export function ChecklistTemplateTasksScreen(): React.JSX.Element {
  const {
    params: {templateId, templateName},
  } = useRoute<Route>();

  const tasks = useChecklistTasks(templateId);
  const completions = useChecklistTaskCompletions(templateId);

  if (tasks.isLoading || completions.isLoading) {
    return <LoadingView />;
  }
  if (tasks.error || completions.error) {
    return (
      <ErrorState
        message={describeApiError(
          tasks.error ?? completions.error,
          'Could not load this checklist.',
        )}
        onRetry={() => {
          tasks.refetch();
          completions.refetch();
        }}
      />
    );
  }

  const completionByTask = new Map(
    (completions.data?.results ?? []).map(completion => [completion.task, completion]),
  );
  const taskList = tasks.data?.results ?? [];

  return (
    <Screen onRefresh={() => completions.refetch()} refreshing={completions.isRefetching}>
      <Text style={styles.heading}>{templateName}</Text>

      {taskList.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body="Ask your manager to add them in Manage compliance."
        />
      ) : (
        taskList.map((task, index) => (
          <FadeIn key={task.id} delay={index * 40}>
            <TaskRow task={task} completion={completionByTask.get(task.id)} />
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
