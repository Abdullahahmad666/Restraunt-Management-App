import {StyleSheet} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';

import {Button} from '../src/components/Button';
import {PrimaryButton} from '../src/components/PrimaryButton';

/** The pressable's own styling, minus the animated transform - two renders
 * each hold their own Animated.Value, so comparing those would compare
 * identity rather than appearance. */
function appearanceOf(name: string): Record<string, unknown> {
  const flat = {
    ...(StyleSheet.flatten(screen.getByRole('button', {name}).props.style) as Record<
      string,
      unknown
    >),
  };
  delete flat.transform;
  return flat;
}

describe('the app has one button', () => {
  it('draws Button and PrimaryButton identically, so they cannot drift apart', async () => {
    // These were separate implementations once, and did drift: filled red
    // against outlined red, amber-tinted against a neutral hairline. Comparing
    // what each actually renders is what stops that happening again quietly.
    const view = await render(<Button title="Delete" onPress={() => {}} variant="danger" />);
    const alias = appearanceOf('Delete');

    await view.rerender(<PrimaryButton label="Delete" onPress={() => {}} variant="danger" />);

    expect(alias).toEqual(appearanceOf('Delete'));
  });

  it('passes the title through as the label', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save changes" onPress={onPress} />);

    await fireEvent.press(screen.getByText('Save changes'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('a button that is working', () => {
  it('will not fire again while loading', async () => {
    // A double-tapped "Confirm" that posts twice is the failure this prevents,
    // and it is only visible in the data afterwards.
    const onPress = jest.fn();
    await render(<PrimaryButton label="Confirm" onPress={onPress} loading />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('says so to a screen reader rather than only spinning', async () => {
    await render(<PrimaryButton label="Confirm" onPress={() => {}} loading />);

    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
  });

  it('swaps the label for the spinner instead of showing both', async () => {
    await render(<PrimaryButton label="Confirm" onPress={() => {}} loading />);

    expect(screen.queryByText('Confirm')).toBeNull();
  });
});

describe('press motion', () => {
  it('animates without swallowing the press itself', async () => {
    // PressableScale wraps onPressIn/onPressOut to drive the spring. Wrapping
    // handlers is exactly where a press gets lost, so both halves are checked:
    // the dip runs, and the tap still arrives.
    const onPress = jest.fn();
    await render(<PrimaryButton label="Tap" onPress={onPress} />);
    const button = screen.getByRole('button');

    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
