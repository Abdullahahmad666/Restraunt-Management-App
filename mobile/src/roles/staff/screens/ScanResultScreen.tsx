import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Badge} from '../../../components/Badge';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {colors, spacing} from '../../../theme';
import {formatTime} from '../../../utils/format';
import type {StaffStackParamList} from '../../../navigation/types';

type Route = RouteProp<StaffStackParamList, 'ScanResult'>;
type Nav = NativeStackNavigationProp<StaffStackParamList>;

const COPY: Record<Route['params']['action'], {heading: string; body: string}> = {
  check_in: {heading: "You're checked in", body: 'Have a good shift.'},
  check_out: {heading: "You're checked out", body: 'See you next time.'},
  already_checked_in: {
    heading: "You're already checked in",
    body: 'That scan was too soon after your check-in to count as a checkout - just a double tap.',
  },
};

/** Confirmation after a scan: checked in or checked out, and at what time. */
export function ScanResultScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const {action, log} = params;
  const copy = COPY[action];

  return (
    <View style={styles.container}>
      <Badge
        label={log.status === 'OPEN' ? 'On shift' : 'Shift ended'}
        tone={log.status === 'OPEN' ? 'success' : 'neutral'}
      />
      <Text style={styles.heading}>{copy.heading}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <Card>
        <Text style={styles.row}>Checked in: {formatTime(log.clock_in_at)}</Text>
        {log.clock_out_at ? (
          <Text style={styles.row}>Checked out: {formatTime(log.clock_out_at)}</Text>
        ) : null}
      </Card>

      <Button title="Done" onPress={() => navigation.navigate('StaffTabs', {screen: 'Scan'})} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center'},
  heading: {fontSize: 26, fontWeight: '700', color: colors.text},
  body: {fontSize: 15, color: colors.textMuted},
  row: {fontSize: 15, color: colors.text},
});
