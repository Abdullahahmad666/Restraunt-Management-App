import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/** Equipment and temperature thresholds. Waiting on the equipment app's backend. */
export function EquipmentScreen(): React.JSX.Element {
  return (
    <ComingSoon
      icon="thermometer"
      title="Equipment"
      body="The equipment app has no backend yet - once it does, temperature thresholds and service history will show up here."
    />
  );
}
