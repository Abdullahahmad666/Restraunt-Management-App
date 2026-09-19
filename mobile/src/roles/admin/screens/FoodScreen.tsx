import React from 'react';

import {InventoryHubScreen} from '../../common/screens/InventoryHubScreen';

/** The admin "Food" tab - stock levels and scanning delivery invoices. Menu
 * management and food wastage tracking may join this tab later; inventory
 * is the first piece built here. */
export function FoodScreen(): React.JSX.Element {
  return <InventoryHubScreen />;
}
