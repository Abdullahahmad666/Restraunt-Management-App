import {Keyboard, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';

import {PickerSheet} from '../src/components/PickerSheet';

const CHOICES = [
  {value: 'a', label: 'Bidfood'},
  {value: 'b', label: 'Brakes'},
];

function sheet(props: Partial<React.ComponentProps<typeof PickerSheet>> = {}) {
  return (
    <PickerSheet
      visible
      title="Who supplied this?"
      choices={CHOICES}
      onSelect={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('adding something that is not in the list', () => {
  it('is not offered when there is no name to add', async () => {
    // The bug this replaces: the sheet offered `Add "new supplier"` on an
    // empty box, and tapping it produced "type the supplier name" - about a
    // field the person could not see, because the search box was it.
    await render(
      sheet({
        create: {
          nameFor: query => query.trim() || null,
          label: name => `Add "${name}"`,
          onCreate: jest.fn(),
        },
      }),
    );

    expect(screen.queryByText(/^Add "/)).toBeNull();
    expect(screen.getByText(/Type a name above/)).toBeTruthy();
  });

  it('offers what was typed, once something has been', async () => {
    const onCreate = jest.fn();
    await render(
      sheet({
        create: {nameFor: query => query.trim() || null, label: name => `Add "${name}"`, onCreate},
      }),
    );

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(/type a new name/i), '  Nisbets  ');
    });
    await fireEvent.press(screen.getByText('Add "Nisbets"'));

    // Trimmed, and resolved by the caller rather than passed on raw.
    expect(onCreate).toHaveBeenCalledWith('Nisbets');
  });

  it('falls back to a name the caller already has', async () => {
    // An invoice whose supplier the scan did read: the option stands before
    // anybody types, offering that name.
    await render(
      sheet({
        create: {
          nameFor: query => query.trim() || 'GIRO FOOD LTD',
          label: name => `Add "${name}"`,
          onCreate: jest.fn(),
        },
      }),
    );

    expect(screen.getByText('Add "GIRO FOOD LTD"')).toBeTruthy();
  });

  it('says nothing about adding when the caller cannot', async () => {
    // Storage areas: the staff API will not create one, so the sheet must not
    // suggest it is possible.
    await render(sheet());

    expect(screen.queryByText(/^Add "/)).toBeNull();
    expect(screen.queryByText(/Type a name above/)).toBeNull();
  });
});

describe('searching', () => {
  it('narrows to what matches, case regardless', async () => {
    await render(sheet());

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(/search/i), 'bid');
    });

    expect(screen.getByText('Bidfood')).toBeTruthy();
    expect(screen.queryByText('Brakes')).toBeNull();
  });
});

describe('getting out of it, and out of the keyboard', () => {
  it('closes from the button rather than only by guessing at the backdrop', async () => {
    const onClose = jest.fn();
    await render(sheet({onClose}));

    await fireEvent.press(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('clears the search when it closes', async () => {
    // Otherwise reopening shows the last search's results, which look like
    // the whole list until somebody notices the box is not empty.
    const onClose = jest.fn();
    const view = await render(sheet({onClose}));

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(/search/i), 'bid');
    });
    await fireEvent.press(screen.getByLabelText('Close'));
    await view.rerender(sheet({onClose, visible: true}));

    expect(screen.getByPlaceholderText(/search/i).props.value).toBe('');
    expect(screen.getByText('Brakes')).toBeTruthy();
  });

  it('lifts itself clear when the keyboard appears', async () => {
    // The failure this fixes: the sheet sits at the bottom of the screen,
    // which is where the keyboard opens, so the search box ends up underneath
    // it and somebody types blind into a field they cannot see.
    const listeners: Record<string, (event: unknown) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      handler: (payload: unknown) => void,
    ) => {
      listeners[event] = handler;
      return {remove: jest.fn()};
    }) as never);

    await render(sheet());
    const before = StyleSheet.flatten(screen.getByTestId('picker-sheet').props.style);

    await act(async () => {
      listeners.keyboardDidShow?.({endCoordinates: {height: 320}});
    });

    const after = StyleSheet.flatten(screen.getByTestId('picker-sheet').props.style);
    // Padded clear of the keys, and taller, because the keyboard has taken
    // the bottom third of the screen and the list still needs somewhere to be.
    expect(after.paddingBottom).toBe(320);
    expect(after.maxHeight).toBeGreaterThan(before.maxHeight as number);
  });
});
