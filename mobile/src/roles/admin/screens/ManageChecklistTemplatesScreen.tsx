import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
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
  useAdminChecklistTemplates,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
} from '../../../features/compliance/hooks';
import {FREQUENCY_LABELS} from '../../../features/compliance/types';
import type {AdminChecklistTemplate} from '../../../features/compliance/types';
import type {AdminStackParamList} from '../../../navigation/types';
import {colors, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;
type Route = RouteProp<AdminStackParamList, 'ManageChecklistTemplates'>;

function TemplateRow({
  template,
  onManageTasks,
}: {
  template: AdminChecklistTemplate;
  onManageTasks: () => void;
}): React.JSX.Element {
  const toggleActive = useUpdateChecklistTemplate();
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    setError(null);
    try {
      await toggleActive.mutateAsync({id: template.id, input: {is_active: !template.is_active}});
    } catch (err) {
      setError(describeApiError(err, 'Could not update that checklist.'));
    }
  }

  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.itemText}>{template.name}</Text>
        {!template.is_active ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.rowActions}>
        <Button title="Manage tasks" variant="secondary" onPress={onManageTasks} />
        <Button
          title={template.is_active ? 'Deactivate' : 'Reactivate'}
          variant="secondary"
          onPress={onToggle}
          loading={toggleActive.isPending}
        />
      </View>
    </Card>
  );
}

/** Registering the restaurant's named daily/weekly/monthly checklists -
 * "Toilet Cleaning", "Monthly Deep Clean" - each frequency can have any
 * number of these, unlike the single opening/closing checklist. Tapping
 * "Manage tasks" leads to ManageChecklistTemplateTasksScreen for that
 * checklist's own lines. */
export function ManageChecklistTemplatesScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {
    params: {frequency},
  } = useRoute<Route>();
  const templates = useAdminChecklistTemplates(frequency);
  const create = useCreateChecklistTemplate();

  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (!newName.trim()) {
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({frequency, name: newName.trim()});
      setNewName('');
    } catch (err) {
      setError(describeApiError(err, 'Could not add that checklist.'));
    }
  }

  if (templates.isLoading) {
    return <LoadingView />;
  }
  if (templates.error) {
    return (
      <ErrorState
        message={describeApiError(templates.error, 'Could not load checklists.')}
        onRetry={() => templates.refetch()}
      />
    );
  }

  const templateList = templates.data?.results ?? [];

  return (
    <Screen onRefresh={() => templates.refetch()} refreshing={templates.isRefetching}>
      <Text style={styles.heading}>{FREQUENCY_LABELS[frequency]} checklists</Text>

      {templateList.length === 0 ? (
        <EmptyState title="No checklists yet" body="Add the first one below." />
      ) : (
        templateList.map((template, index) => (
          <FadeIn key={template.id} delay={index * 40}>
            <TemplateRow
              template={template}
              onManageTasks={() =>
                navigation.navigate('ManageChecklistTemplateTasks', {
                  templateId: template.id,
                  templateName: template.name,
                })
              }
            />
          </FadeIn>
        ))
      )}

      <Card style={styles.addCard}>
        <TextField
          label="New checklist"
          placeholder="e.g. Toilet Cleaning"
          value={newName}
          onChangeText={setNewName}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Add checklist" onPress={onAdd} loading={create.isPending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 18, fontWeight: '700', color: colors.text},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  rowActions: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs},
  itemText: {fontSize: 15, color: colors.text, flex: 1, marginRight: spacing.sm},
  error: {color: colors.danger, fontSize: 12},
  addCard: {gap: spacing.sm},
});
