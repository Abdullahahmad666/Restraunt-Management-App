import {fireEvent, render, screen} from '@testing-library/react-native';

import {DeleteAccountDialog} from '../src/components/DeleteAccountDialog';
import type {DeletionPlan} from '../src/features/auth/api';

const NOTHING_RETAINED: DeletionPlan = {
  hard_delete: true,
  deletes_restaurant: false,
  requires_name_confirmation: false,
  restaurant_name: null,
  staff_accounts: 0,
  attendance_records: 0,
  compliance_records: 0,
};

const RECORDS_RETAINED: DeletionPlan = {
  ...NOTHING_RETAINED,
  hard_delete: false,
};

const TEARS_DOWN: DeletionPlan = {
  hard_delete: true,
  deletes_restaurant: true,
  requires_name_confirmation: true,
  restaurant_name: 'The Clay Oven',
  staff_accounts: 4,
  attendance_records: 312,
  compliance_records: 57,
};

function dialog(props: Partial<React.ComponentProps<typeof DeleteAccountDialog>> = {}) {
  return (
    <DeleteAccountDialog
      visible
      plan={NOTHING_RETAINED}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      {...props}
    />
  );
}

describe('confirming before anything is destroyed', () => {
  it('will not delete without a password', async () => {
    const onConfirm = jest.fn();
    await render(dialog({onConfirm}));

    await fireEvent.press(screen.getByText('Delete my account'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('deletes once a password is typed', async () => {
    const onConfirm = jest.fn();
    await render(dialog({onConfirm}));

    await fireEvent.changeText(screen.getByTestId('delete-password'), 'my-password');
    await fireEvent.press(screen.getByText('Delete my account'));

    expect(onConfirm).toHaveBeenCalledWith('my-password', undefined);
  });

  it('hides the password being typed', async () => {
    await render(dialog());

    expect(screen.getByTestId('delete-password').props.secureTextEntry).toBe(true);
  });

  it('shows a server error next to the box it came from', async () => {
    await render(dialog({error: 'That password is not correct.'}));

    expect(screen.getByTestId('delete-error')).toBeTruthy();
    expect(screen.getByText('That password is not correct.')).toBeTruthy();
  });

  it('asks for nothing while it is still finding out what would go', async () => {
    await render(dialog({plan: null, loading: true}));

    expect(screen.queryByTestId('delete-password')).toBeNull();
    expect(screen.getByText(/Checking what this would delete/)).toBeTruthy();
  });
});

describe('telling the truth about what survives', () => {
  it('says the hours stay when records have to be retained', async () => {
    await render(dialog({plan: RECORDS_RETAINED}));

    // The disclosure Apple's guideline is conditional on, and the honest
    // answer regardless: a button saying "delete" must not leave payroll
    // rows behind without mentioning it.
    expect(screen.getByText(/hours you worked/)).toBeTruthy();
    expect(screen.getByText(/Former team member/)).toBeTruthy();
  });

  it('does not promise retention when there is nothing to retain', async () => {
    await render(dialog({plan: NOTHING_RETAINED}));

    expect(screen.queryByText(/Former team member/)).toBeNull();
    expect(screen.getByText(/everything on it will be permanently deleted/)).toBeTruthy();
  });
});

describe('the last manager of a restaurant', () => {
  it('spells out everything that goes with them', async () => {
    await render(dialog({plan: TEARS_DOWN}));

    expect(screen.getByText(/only manager of The Clay Oven/)).toBeTruthy();
    expect(screen.getByText(/4 staff accounts/)).toBeTruthy();
    expect(screen.getByText(/312 attendance and payroll records/)).toBeTruthy();
    expect(screen.getByText(/57 food-safety records/)).toBeTruthy();
    expect(screen.getByText(/no way to undo this/)).toBeTruthy();
  });

  it('refuses a password alone', async () => {
    const onConfirm = jest.fn();
    await render(dialog({plan: TEARS_DOWN, onConfirm}));

    await fireEvent.changeText(screen.getByTestId('delete-password'), 'my-password');
    await fireEvent.press(screen.getByText('Delete everything'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('sends the typed name through once both are filled in', async () => {
    const onConfirm = jest.fn();
    await render(dialog({plan: TEARS_DOWN, onConfirm}));

    await fireEvent.changeText(screen.getByTestId('delete-restaurant-name'), 'The Clay Oven');
    await fireEvent.changeText(screen.getByTestId('delete-password'), 'my-password');
    await fireEvent.press(screen.getByText('Delete everything'));

    expect(onConfirm).toHaveBeenCalledWith('my-password', 'The Clay Oven');
  });

  it('does not ask for a name when no restaurant is going', async () => {
    await render(dialog({plan: RECORDS_RETAINED}));

    expect(screen.queryByTestId('delete-restaurant-name')).toBeNull();
  });

  it('labels the button for what it actually does', async () => {
    await render(dialog({plan: TEARS_DOWN}));

    // "Delete my account" would be a lie on this path - it deletes four
    // other people's accounts too.
    expect(screen.getByText('Delete everything')).toBeTruthy();
    expect(screen.queryByText('Delete my account')).toBeNull();
  });
});

describe('while it is working', () => {
  it('cannot be cancelled half-way through', async () => {
    const onCancel = jest.fn();
    await render(dialog({busy: true, onCancel}));

    await fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cannot be fired a second time, because there is no label left to press', async () => {
    await render(dialog({busy: true}));

    // PrimaryButton swaps its label for a spinner while loading, so a second
    // tap has nothing to land on - which is the behaviour being relied on
    // here, not an accident worth working around.
    expect(screen.queryByText('Delete my account')).toBeNull();
  });

  it('does not keep the password around after being reopened', async () => {
    const view = await render(dialog());
    await fireEvent.changeText(screen.getByTestId('delete-password'), 'my-password');

    await view.rerender(dialog({visible: false}));
    await view.rerender(dialog({visible: true}));

    expect(screen.getByTestId('delete-password').props.value).toBe('');
  });
});
