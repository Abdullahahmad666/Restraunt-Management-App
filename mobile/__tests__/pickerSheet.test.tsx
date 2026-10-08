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
