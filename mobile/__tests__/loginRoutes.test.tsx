import {render, screen} from '@testing-library/react-native';

// `mock`-prefixed, which is the only way jest.mock's factory is allowed to
// reach a variable declared out here.
const mockNavigate = jest.fn();
let mockParams: {who?: 'manager' | 'staff'} | undefined;

jest.mock('@react-navigation/native', () => ({
  // Only the two hooks are stubbed. The rest is real, because the theme reads
  // DarkTheme out of this same module and a bare mock leaves it undefined.
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate}),
  useRoute: () => ({params: mockParams}),
}));

import {LoginScreen} from '../src/roles/common/screens/LoginScreen';

beforeEach(() => {
  mockNavigate.mockClear();
  mockParams = undefined;
});

/**
 * Signing in is the same for both, so one screen serves both - but the way out
 * of it for someone without an account is not. A staff member sent to
 * SetupTakeaway lands on a form for registering a restaurant they do not own,
 * and only finds out by filling it in.
 */
describe('the way out of sign-in for someone without an account', () => {
  it('offers a manager the account they can actually create', async () => {
    mockParams = {who: 'manager'};

    await render(<LoginScreen />);

    expect(screen.getByText('Create an account')).toBeTruthy();
    expect(screen.queryByText(/invite code/i)).toBeNull();
  });

  it('offers staff their invite code, not a restaurant to set up', async () => {
    mockParams = {who: 'staff'};

    await render(<LoginScreen />);

    expect(screen.getByText(/invite code/i)).toBeTruthy();
    expect(screen.queryByText('Create an account')).toBeNull();
  });

  it('treats an unattributed arrival as a manager, as it always did', async () => {
    // A password-reset link or a deep link says nothing about who is holding
    // the phone.
    mockParams = undefined;

    await render(<LoginScreen />);

    expect(screen.getByText('Create an account')).toBeTruthy();
  });
});
