import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {useSetRate, useRates} from '../../../features/payroll/hooks';
import {useCreateStaff, useStaffAccounts, useUpdateStaff} from '../../../features/staff/hooks';
import type {StaffAccount} from '../../../features/staff/types';
import {colors, spacing} from '../../../theme';
import {fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** Admin-only: add staff, edit their details, set pay rates, deactivate accounts. */
export function StaffManagementScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const staff = useStaffAccounts();
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (staff.isLoading) {
    return <LoadingView />;
  }
  if (staff.error) {
    return (
      <ErrorState
        message={describeApiError(staff.error, 'Could not load staff.')}
        onRetry={() => staff.refetch()}
      />
    );
  }

  return (
    <Screen onRefresh={() => staff.refetch()} refreshing={staff.isRefetching}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Team</Text>
        <Button
          title="Check-in QR"
          variant="secondary"
          onPress={() => navigation.navigate('StaffBarcode')}
        />
      </View>

      {adding ? (
        <AddStaffForm onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
      ) : (
        <Button title="Add staff member" onPress={() => setAdding(true)} />
      )}

      {staff.data?.results.length === 0 ? (
        <EmptyState title="No staff yet" body="Add your first team member above." />
      ) : (
        staff.data?.results.map(member => (
          <StaffRow
            key={member.id}
            member={member}
            expanded={expandedId === member.id}
            onToggle={() => setExpandedId(expandedId === member.id ? null : member.id)}
          />
        ))
      )}
    </Screen>
  );
}

function AddStaffForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const createStaff = useCreateStaff();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    try {
      await createStaff.mutateAsync({email, first_name: firstName, last_name: lastName, phone});
      onDone();
    } catch (err) {
      setError(describeApiError(err, 'Could not add this staff member.'));
    }
  }

  return (
    <Card>
      <TextField label="First name" value={firstName} onChangeText={setFirstName} />
      <TextField label="Last name" value={lastName} onChangeText={setLastName} />
      <TextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Phone (optional)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Text style={styles.note}>
        No password set here generates one automatically - there's no "forgot password" screen yet,
        so tell the new starter to ask you for it.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.formActions}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
        <Button
          title="Add"
          onPress={onSubmit}
          loading={createStaff.isPending}
          disabled={!firstName || !lastName || !email}
        />
      </View>
    </Card>
  );
}

function StaffRow({
  member,
  expanded,
  onToggle,
}: {
  member: StaffAccount;
  expanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const updateStaff = useUpdateStaff();
  const rates = useRates();
  const setRate = useSetRate();
  const [rate1, setRate1] = useState('');
  const [rate2, setRate2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const existingRate = rates.data?.results.find(rate => rate.staff === member.id);

  async function onToggleActive() {
    try {
      await updateStaff.mutateAsync({id: member.id, is_active: !member.is_active});
    } catch (err) {
      setError(describeApiError(err, 'Could not update this account.'));
    }
  }

  async function onSaveRate() {
    setError(null);
    try {
      await setRate.mutateAsync({
        staff: member.id,
        rate_1: rate1 || existingRate?.rate_1 || '0',
        rate_2: rate2 || existingRate?.rate_2 || '0',
        existingId: existingRate?.id,
      });
      setRate1('');
      setRate2('');
    } catch (err) {
      setError(describeApiError(err, 'Could not save pay rates.'));
    }
  }

  return (
    <Card>
      <Pressable style={styles.rowHeader} onPress={onToggle}>
        <View>
          <Text style={styles.rowTitle}>{fullName(member)}</Text>
          <Text style={styles.rowBody}>{member.email}</Text>
        </View>
        <Badge
          label={member.is_active ? 'Active' : 'Deactivated'}
          tone={member.is_active ? 'success' : 'neutral'}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.expanded}>
          <Text style={styles.rowBody}>Phone: {member.phone || 'Not set'}</Text>
          <Text style={styles.rowBody}>
            Current rates:{' '}
            {existingRate ? `£${existingRate.rate_1} / £${existingRate.rate_2}` : 'Not set'}
          </Text>

          <TextField
            label="Rate 1 (£/hr)"
            keyboardType="decimal-pad"
            placeholder={existingRate?.rate_1 ?? '11.50'}
            value={rate1}
            onChangeText={setRate1}
          />
          <TextField
            label="Rate 2 (£/hr)"
            keyboardType="decimal-pad"
            placeholder={existingRate?.rate_2 ?? '10.00'}
            value={rate2}
            onChangeText={setRate2}
          />
          <Button
            title="Save rates"
            variant="secondary"
            onPress={onSaveRate}
            loading={setRate.isPending}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            <Button
              title="Add shift"
              variant="secondary"
              onPress={() => navigation.navigate('AttendanceEdit', {staffId: member.id})}
            />
            <Button
              title={member.is_active ? 'Deactivate' : 'Reactivate'}
              variant="danger"
              onPress={onToggleActive}
              loading={updateStaff.isPending}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  heading: {fontSize: 24, fontWeight: '700', color: colors.text},
  rowHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  rowTitle: {fontSize: 16, fontWeight: '600', color: colors.text},
  rowBody: {fontSize: 13, color: colors.textMuted},
  expanded: {marginTop: spacing.sm, gap: spacing.sm},
  formActions: {flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end'},
  note: {fontSize: 12, color: colors.textMuted},
  error: {color: colors.danger},
});
