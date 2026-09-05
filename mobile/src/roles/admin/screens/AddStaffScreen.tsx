import React, {useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../../components/Button';
import {Screen} from '../../../components/Screen';
import {TextField} from '../../../components/TextField';
import {describeApiError} from '../../../api/errors';
import {useCreateStaff} from '../../../features/staff/hooks';
import {colors} from '../../../theme';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

/** The manual alternative to an invite link - an admin fills in someone's
 * details directly rather than waiting for them to sign up themselves. */
export function AddStaffScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
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
      navigation.goBack();
    } catch (err) {
      setError(describeApiError(err, 'Could not add this staff member.'));
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Add staff member</Text>

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
        They will be emailed a link to set their own password, so you never have to handle it. The
        link expires after a few hours - if they miss it, they can use "Forgot password?" on the
        sign-in screen.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Add staff member"
        onPress={onSubmit}
        loading={createStaff.isPending}
        disabled={!firstName || !lastName || !email}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 22, fontWeight: '700', color: colors.text},
  note: {fontSize: 12, color: colors.textMuted},
  error: {color: colors.danger},
});
