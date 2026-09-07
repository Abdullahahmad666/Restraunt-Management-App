import React from 'react';

import {PrimaryButton} from './PrimaryButton';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

/**
 * The same button as PrimaryButton, under the name the role screens use.
 *
 * There were genuinely two button components, and they disagreed: this one
 * put white text on amber (which fails contrast - amber is bright, hence
 * `onPrimary` being navy) and drew `secondary` as a filled surface with an
 * amber border, where the auth screens drew it as transparent with a muted
 * one. Two looks for the same control, split along which half of the app you
 * happened to be in - so a screen could not be moved between them without
 * changing appearance.
 *
 * Kept as an alias rather than resolved by renaming call sites in twenty
 * screens: the two names read naturally in their own contexts (`title` for a
 * row of actions, `label` for a form's one submit), and collapsing them would
 * be a diff across the whole app for no behavioural gain.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps): React.JSX.Element {
  return (
    <PrimaryButton
      label={title}
      onPress={onPress}
      variant={variant}
      loading={loading}
      disabled={disabled}
    />
  );
}
