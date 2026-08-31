import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/** What to do after a failed check. Waiting on the compliance app's backend. */
export function CorrectiveActionScreen(): React.JSX.Element {
  return (
    <ComingSoon
      title="Corrective action"
      body="The compliance app has no backend yet - once it does, a failed check will route here."
    />
  );
}
