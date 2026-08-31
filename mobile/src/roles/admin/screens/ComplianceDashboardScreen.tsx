import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/** Today's checks across the restaurant. Waiting on the compliance app's backend. */
export function ComplianceDashboardScreen(): React.JSX.Element {
  return (
    <ComingSoon
      title="Compliance"
      body="The compliance app has no backend yet - once it does, today's checks across the team will show up here."
    />
  );
}
