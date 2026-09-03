import React from 'react';

import {EmptyState} from '../../../components/EmptyState';
import {Screen} from '../../../components/Screen';

/**
 * Placeholder for food wastage tracking and menu management - neither has a
 * backend yet, so this tab exists to hold their place rather than pretend
 * they're built.
 */
export function FoodScreen(): React.JSX.Element {
  return (
    <Screen>
      <EmptyState
        title="Food wastage & menu management"
        body="This is coming soon - tracking what gets thrown away and managing your menu will live here."
      />
    </Screen>
  );
}
