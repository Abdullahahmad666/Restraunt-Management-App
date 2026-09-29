import React from 'react';

import {PrimaryButton, type ButtonVariant} from './PrimaryButton';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * PrimaryButton under a second name, kept because two dozen screens import it.
 *
 * It used to be a separate implementation, and the two drifted: this one filled
 * `danger` solid red where the other outlined it, and tinted `secondary` amber
 * where the other used a neutral hairline. Two buttons that looked different
 * for no reason a user could name, picked between by whichever import the
 * screen happened to have.
 *
 * New screens should import PrimaryButton directly; this exists so that is a
 * tidy-up rather than a prerequisite.
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
