import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/** Past checks and corrective actions. Waiting on the compliance app's backend. */
export function ComplianceHistoryScreen(): React.JSX.Element {
  return (
    <ComingSoon
      title="Compliance history"
      body="The compliance app has no backend yet - once it does, past checks and corrective actions will show up here."
    />
  );
}
