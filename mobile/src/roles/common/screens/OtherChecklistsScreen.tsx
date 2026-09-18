import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
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
  useChecklistTemplates,
} from '../../../features/compliance/hooks';
import {FREQUENCY_LABELS} from '../../../features/compliance/types';
import type {ChecklistFrequency, ChecklistTemplate} from '../../../features/compliance/types';
import type {ComplianceStackParamList} from '../../../navigation/types';
import {colors, radii, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<ComplianceStackParamList>;

const FREQUENCIES: ChecklistFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

function TemplateRow({
  template,
  onPress,
}: {
  template: ChecklistTemplate;
  onPress: () => void;
}): React.JSX.Element {
  const tasks = useChecklistTasks(template.id);
  const completions = useChecklistTaskCompletions(template.id);

  const total = tasks.data?.results.length ?? 0;
  const done = completions.data?.results.length ?? 0;
  const subtitle = total === 0 ? 'No tasks yet' : `${done} of ${total} done`;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{template.name}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

/** The daily/weekly/monthly checklists ("Toilet Cleaning", "Monthly Deep
 * Clean") - a manager can register any number per frequency, unlike the
 * single opening/closing checklist. Shared by staff and admin like
 * RoutineScreen/ChecklistScreen - both view and complete tasks the same way,
 * only adding/editing a checklist itself is admin-only. */
export function OtherChecklistsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [frequency, setFrequency] = useState<ChecklistFrequency>('DAILY');
  const templates = useChecklistTemplates(frequency);

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
      <Text style={styles.heading}>Other checklists</Text>

      <View style={styles.filterRow}>
        {FREQUENCIES.map(value => (
          <Pressable
            key={value}
            onPress={() => setFrequency(value)}
            style={[styles.chip, frequency === value && styles.chipActive]}>
            <Text style={[styles.chipLabel, frequency === value && styles.chipLabelActive]}>
              {FREQUENCY_LABELS[value]}
            </Text>
          </Pressable>
        ))}
      </View>

      {templateList.length === 0 ? (
        <EmptyState
          title="No checklists yet"
          body={`Ask your manager to add a ${FREQUENCY_LABELS[frequency].toLowerCase()} checklist.`}
        />
      ) : (
        templateList.map((template, index) => (
          <FadeIn key={template.id} delay={index * 40}>
            <TemplateRow
              template={template}
              onPress={() =>
                navigation.navigate('ChecklistTemplateTasks', {
                  templateId: template.id,
                  templateName: template.name,
                })
              }
            />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 20, fontWeight: '700', color: colors.text},
  filterRow: {flexDirection: 'row', gap: spacing.xs},
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
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  rowText: {flex: 1},
  rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
  rowSubtitle: {fontSize: 12, color: colors.textMuted, marginTop: 2},
});
