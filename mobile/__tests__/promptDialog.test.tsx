import {act, fireEvent, render, screen} from '@testing-library/react-native';

import {PromptDialog} from '../src/components/PromptDialog';

function prompt(props: Partial<React.ComponentProps<typeof PromptDialog>> = {}) {
  return (
    <PromptDialog
      visible
      title="Name this document"
      label="Title"
      placeholder="e.g. Food hygiene certificate"
      confirmLabel="Save document"
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      {...props}
    />
  );
}

describe('asking for a name', () => {
  it('puts the field inside the dialog that asks for it', async () => {
    // The failure this exists to prevent: a prompt on top and its field
    // underneath, where the modal covers it. The person is told to type
    // something into a box they cannot see.
    await render(prompt());

    expect(screen.getByText('Name this document')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. Food hygiene certificate')).toBeTruthy();
  });

  it('will not save nothing', async () => {
    const onConfirm = jest.fn();
    await render(prompt({onConfirm}));

    await fireEvent.press(screen.getByText('Save document'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('will not save whitespace either', async () => {
    const onConfirm = jest.fn();
    await render(prompt({onConfirm}));

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(/hygiene/), '   ');
    });
    await fireEvent.press(screen.getByText('Save document'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('hands back what was typed, trimmed', async () => {
    const onConfirm = jest.fn();
    await render(prompt({onConfirm}));

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(/hygiene/), '  Food hygiene certificate ');
    });
    await fireEvent.press(screen.getByText('Save document'));

    expect(onConfirm).toHaveBeenCalledWith('Food hygiene certificate');
  });

  it('forgets the last answer when it reopens', async () => {
    // Otherwise the second certificate quietly gets the first one's name.
    const view = await render(prompt());

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText(/hygiene/), 'Premises licence');
    });
    await view.rerender(prompt({visible: false}));
    await view.rerender(prompt({visible: true}));

    expect(screen.getByPlaceholderText(/hygiene/).props.value).toBe('');
  });
});
