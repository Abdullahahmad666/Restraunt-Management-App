import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/** Today's food-safety checks. Waiting on the compliance app's backend. */
export function DailyChecksScreen(): React.JSX.Element {
  return (
    <ComingSoon
      title="Daily checks"
      body="The compliance app has no backend yet - once it does, today's checklist will show up here."
    />
  );
}
