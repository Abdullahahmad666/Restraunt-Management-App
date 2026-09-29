import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/** Equipment and temperature thresholds. Waiting on the equipment app's backend. */
export function EquipmentScreen(): React.JSX.Element {
  return (
    <ComingSoon
      title="Equipment"
      body="Service history and temperature limits for your equipment will live here. Nothing to set up yet."
    />
  );
}
