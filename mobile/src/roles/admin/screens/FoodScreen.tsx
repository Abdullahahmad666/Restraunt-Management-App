import React from 'react';

import {ComingSoon} from '../../../components/ComingSoon';

/**
 * Placeholder for food wastage tracking and menu management - neither has a
 * backend yet, so this tab exists to hold their place rather than pretend
 * they're built.
 *
 * ComingSoon rather than EmptyState: an empty state says "you have nothing
 * here yet", which invites someone to go add something. Nothing can be added
 * until the backend exists.
 */
export function FoodScreen(): React.JSX.Element {
  return (
    <ComingSoon
      icon="fast-food"
      title="Food & menu"
      body="Tracking what gets thrown away, and managing your menu, will live here."
    />
  );
}
