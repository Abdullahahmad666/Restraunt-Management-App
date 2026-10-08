import {Text} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

import {renderFloatingTabBar} from '../src/navigation/FloatingTabBar';
import {colors} from '../src/theme';

/**
 * React Navigation does not render the `tabBar` prop as an element - it calls
 * it: `insets => tabBar({...})`, in BottomTabView. So this test calls it the
 * same way and renders what comes back.
 *
 * That distinction is the whole reason the export is a wrapper. Handing the
 * component over directly, which looks tidier and satisfies the lint rule
 * about components defined in render, runs its hooks outside any component:
 * React throws "Invalid hook call" and the app is a blank screen with an error
 * box. Typecheck and lint both pass while it happens.
 */
function fakeProps(activeIndex: number): BottomTabBarProps {
  const routes = [
    {key: 'home-1', name: 'Home'},
    {key: 'checks-1', name: 'Checks'},
  ];

  const descriptors = Object.fromEntries(
    routes.map(route => [
      route.key,
      {
        options: {
          title: route.name,
          tabBarIcon: ({color}: {color: string}) => <Text style={{color}}>{route.name} icon</Text>,
        },
      },
    ]),
  );

  return {
    state: {index: activeIndex, routes},
    descriptors,
    navigation: {emit: jest.fn(() => ({defaultPrevented: false})), navigate: jest.fn()},
    insets: {top: 0, right: 0, bottom: 34, left: 0},
  } as unknown as BottomTabBarProps;
}

describe('the tab bar as the navigator uses it', () => {
  it('survives being called rather than rendered', async () => {
    await render(renderFloatingTabBar(fakeProps(0)));

    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Checks')).toBeTruthy();
  });

  it('marks the active tab selected', async () => {
    await render(renderFloatingTabBar(fakeProps(1)));

    expect(screen.getByLabelText('Checks').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('Home').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('draws every icon exactly once, before and after it is measured', async () => {
    // One icon per tab either way. The marker is a circle behind the active
    // icon rather than a second copy of it lifted out of the bar, which is
    // what this used to be and what put it over the content above.
    await render(renderFloatingTabBar(fakeProps(0)));

    expect(screen.getAllByText('Home icon')).toHaveLength(1);
    expect(screen.getAllByText('Checks icon')).toHaveLength(1);

    await act(async () => {
      fireEvent(screen.getByLabelText('Home').parent as never, 'layout', {
        nativeEvent: {layout: {width: 320, height: 64}},
      });
    });

    expect(screen.getAllByText('Home icon')).toHaveLength(1);
    expect(screen.getAllByText('Checks icon')).toHaveLength(1);
  });

  it('inks the active icon for the amber behind it', async () => {
    // White on this amber fails contrast, which is why onPrimary is near
    // black - the same ink every other picked thing in the app uses.
    await render(renderFloatingTabBar(fakeProps(1)));

    expect(screen.getByText('Checks icon').props.style).toMatchObject({
      color: colors.onPrimary,
    });
    expect(screen.getByText('Home icon').props.style).toMatchObject({
      color: colors.textMuted,
    });
  });
});
