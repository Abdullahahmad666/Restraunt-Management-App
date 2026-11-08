import {StyleSheet} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';

import {ErrorState} from '../src/components/ErrorState';

describe('what a screen shows when it could not load', () => {
  it('says what happened and offers one button', async () => {
    await render(<ErrorState message="No connection. Check your internet." onRetry={jest.fn()} />);

    expect(screen.getByText('No connection. Check your internet.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('leaves the button out when there is nothing to retry', async () => {
    await render(<ErrorState message="Could not load." />);

    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('retries when pressed', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Could not load." onRetry={onRetry} />);

    await fireEvent.press(screen.getByText('Try again'));

    expect(onRetry).toHaveBeenCalled();
  });

  it('centres the retry button under the message', async () => {
    // It did not. `alignSelf: 'stretch'` overrode the container's
    // alignItems, and a stretched item capped by maxWidth stays anchored to
    // the start - so the button sat against the container's left padding
    // while the icon and message above it were centred. Pinned here because
    // the symptom only shows on a screen wider than the cap, which is every
    // real phone and no unit test that merely renders the thing.
    await render(<ErrorState message="Could not load." onRetry={jest.fn()} />);

    const style = StyleSheet.flatten(screen.getByTestId('error-retry').props.style) ?? {};

    expect(style.alignSelf).not.toBe('stretch');
    expect(style.maxWidth).toBe(280);
  });
});
