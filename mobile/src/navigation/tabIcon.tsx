import React from 'react';
import {Ionicons} from '@expo/vector-icons';

import {TAB_ICON_SIZE} from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Builds a tab-bar icon renderer.
 *
 * Outline when inactive, filled when active: with five tabs the colour change
 * alone is a weak signal, and the weight difference reads at a glance even
 * before the amber registers. It is also the one cue that survives for anyone
 * who cannot separate the amber from the muted grey.
 */
export function tabIcon(outline: IconName, filled: IconName) {
  return function renderTabIcon({focused, color}: {focused: boolean; color: string}) {
    return <Ionicons name={focused ? filled : outline} size={TAB_ICON_SIZE} color={color} />;
  };
}
