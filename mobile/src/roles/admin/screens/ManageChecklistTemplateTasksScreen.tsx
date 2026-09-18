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
  useAdminChecklistTasks,
  useCreateChecklistTask,
  useUpdateChecklistTask,
} from '../../../features/compliance/hooks';
import type {AdminChecklistTask} from '../../../features/compliance/types';
import type {AdminStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';

type Route = RouteProp<AdminStackParamList, 'ManageChecklistTemplateTasks'>;

function TaskRow({task}: {task: AdminChecklistTask}): React.JSX.Element {
  const toggleActive = useUpdateChecklistTask();
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    setError(null);
    try {
      await toggleActive.mutateAsync({id: task.id, input: {is_active: !task.is_active}});
    } catch (err) {
      setError(describeApiError(err, 'Could not update that task.'));
    }
  }

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.itemText}>{task.text}</Text>
        {!task.is_active ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={task.is_active ? 'Deactivate' : 'Reactivate'}
        variant="secondary"
        onPress={onToggle}
        loading={toggleActive.isPending}
      />
    </Card>
  );
}

/** Add, deactivate, or reactivate one line on a named daily/weekly/monthly
 * checklist - same deactivate-don't-delete reasoning as
 * ManageChecklistScreen (a past period's completion still points at the
 * task that was ticked, even once retired). */
export function ManageChecklistTemplateTasksScreen(): React.JSX.Element {
  const {
    params: {templateId, templateName},
  } = useRoute<Route>();
  const tasks = useAdminChecklistTasks(templateId);
  const create = useCreateChecklistTask();

  const [newText, setNewText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (!newText.trim()) {
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({template: templateId, text: newText.trim()});
      setNewText('');
    } catch (err) {
      setError(describeApiError(err, 'Could not add that task.'));
    }
  }

  if (tasks.isLoading) {
    return <LoadingView />;
  }
  if (tasks.error) {
    return (
      <ErrorState
        message={describeApiError(tasks.error, 'Could not load this checklist.')}
        onRetry={() => tasks.refetch()}
      />
    );
  }

  const taskList = tasks.data?.results ?? [];

  return (
    <Screen onRefresh={() => tasks.refetch()} refreshing={tasks.isRefetching}>
      <Text style={styles.heading}>{templateName}</Text>

      {taskList.length === 0 ? (
        <EmptyState title="No tasks yet" body="Add the first one below." />
      ) : (
        taskList.map((task, index) => (
          <FadeIn key={task.id} delay={index * 40}>
            <TaskRow task={task} />
          </FadeIn>
        ))
      )}

      <Card style={styles.addCard}>
        <TextField
          label="New task"
          placeholder="e.g. Clean and disinfect toilets"
          value={newText}
          onChangeText={setNewText}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Add task" onPress={onAdd} loading={create.isPending} />
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
