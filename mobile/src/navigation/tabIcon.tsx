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
  return function renderTabIcon({
    focused,
    color,
    size = TAB_ICON_SIZE,
  }: {
    focused: boolean;
    color: string;
    size?: number;
  }) {
    // The size is honoured rather than fixed: the active icon is lifted into a
    // circle of its own by FloatingTabBar, and a glyph sized for a row of five
    // looks lost in there.
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  };
}
