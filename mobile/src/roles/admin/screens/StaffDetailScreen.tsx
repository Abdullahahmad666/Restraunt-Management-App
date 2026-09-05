import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {useSetRate, useRates} from '../../../features/payroll/hooks';
import {useStaffAccounts, useUpdateStaff} from '../../../features/staff/hooks';
import {colors} from '../../../theme';
import {fullName} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'StaffDetail'>;
type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** One staff member: their info, pay rates, and a way into their shifts -
 * everything that used to be crammed into an expanding roster row. */
export function StaffDetailScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const staff = useStaffAccounts();
  const updateStaff = useUpdateStaff();
  const rates = useRates();
  const setRate = useSetRate();

  const [rate1, setRate1] = useState('');
  const [rate2, setRate2] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (staff.isLoading) {
    return <LoadingView />;
  }

  const member = staff.data?.results.find(person => person.id === params.staffId);
  if (!member) {
    return <ErrorState message="That staff member could not be found." />;
  }

  const existingRate = rates.data?.results.find(rate => rate.staff === member.id);

  async function onToggleActive() {
    try {
      await updateStaff.mutateAsync({id: member!.id, is_active: !member!.is_active});
    } catch (err) {
      setError(describeApiError(err, 'Could not update this account.'));
    }
  }

  async function onSaveRate() {
    setError(null);
    try {
      await setRate.mutateAsync({
        staff: member!.id,
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
    <Screen scroll>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>{fullName(member)}</Text>
          <Text style={styles.hint}>{member.email}</Text>
        </View>
        <Badge
          label={member.is_active ? 'Active' : 'Deactivated'}
          tone={member.is_active ? 'success' : 'neutral'}
        />
      </View>

      <Text style={styles.hint}>Phone: {member.phone || 'Not set'}</Text>

      <Card>
        <Text style={styles.cardTitle}>Pay rates</Text>
        <Text style={styles.hint}>
          Current: {existingRate ? `£${existingRate.rate_1} / £${existingRate.rate_2}` : 'Not set'}
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
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Shifts</Text>
        <Text style={styles.hint}>Add, review or remove this person's upcoming shifts.</Text>
        <Button
          title="Manage shifts"
          variant="secondary"
          onPress={() => navigation.navigate('AttendanceEdit', {staffId: member.id})}
        />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={member.is_active ? 'Deactivate' : 'Reactivate'}
        variant="danger"
        onPress={onToggleActive}
        loading={updateStaff.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  hint: {fontSize: 13, color: colors.textMuted},
  cardTitle: {fontSize: 16, fontWeight: '600', color: colors.text},
  error: {color: colors.danger},
});
