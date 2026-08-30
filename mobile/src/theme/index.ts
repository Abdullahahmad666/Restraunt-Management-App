import {DarkTheme, type Theme} from '@react-navigation/native';

/**
 * Invisiko's dark theme.
 *
 * The palette is taken from the logo rather than invented: the mark is a white
 * "i" with an amber dot on a deep navy badge, so navy is the ground and amber
 * is the single accent. Because `background` is the exact navy of the icon and
 * the splash screen, launch has no colour shift - the splash simply becomes the
 * app.
 *
 * The app is dark-only. `userInterfaceStyle` is pinned to "dark" in app.json,
 * so there is no light variant to keep in step. If a light theme is ever
 * wanted, add a sibling palette and select between them here rather than
 * scattering conditionals through the screens.
 */

/** Straight from the artwork - do not drift from these. */
export const brand = {
  navy: '#08172B',
  amber: '#FE9A02',
  white: '#FEFEFE',
} as const;

export const colors = {
  // Surfaces, darkest first. Each step is a lift, not a new hue.
  background: brand.navy,
  surface: '#0F2338',
  surfaceRaised: '#17304A',
  border: '#22405C',

  // Text. `textMuted` still clears 4.5:1 on `background`, so it is safe for
  // body copy and not just decoration.
  text: '#F2F6FA',
  textMuted: '#9DB0C6',

  // Actions. Amber is bright, so anything sitting on it needs dark ink.
  primary: brand.amber,
  primaryPressed: '#D98202',
  primaryDisabled: '#6B4A12',
  onPrimary: brand.navy,

  // Status. Lightened from their usual values - mid-tone greens and reds go
  // muddy against a dark ground.
  success: '#3DD68C',
  warning: '#FBBF24',
  danger: '#FF6B6B',

  // Compliance uses pass/fail constantly, so name them rather than making
  // every screen remember which status colour means what.
  pass: '#3DD68C',
  fail: '#FF6B6B',
  overdue: '#FBBF24',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: {fontSize: 28, fontWeight: '700'},
  heading: {fontSize: 22, fontWeight: '600'},
  body: {fontSize: 16, fontWeight: '400'},
  caption: {fontSize: 13, fontWeight: '400'},
} as const;

/**
 * Feeds NavigationContainer so the chrome React Navigation draws itself -
 * headers, tab bars, the card background behind every screen - matches the
 * palette. Without this the navigator keeps its own white background and every
 * screen transition flashes white.
 */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

/**
 * Shared bottom-tab options.
 *
 * navigationTheme handles the card and header, but the tab bar keeps its own
 * defaults - the inactive label lands on a grey that is close to unreadable
 * against this navy, and the top hairline shows as a light line.
 */
export const tabScreenOptions = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabBarLabelStyle: {fontSize: 11, fontWeight: '600' as const},
  headerStyle: {backgroundColor: colors.background},
  headerTintColor: colors.text,
  headerShadowVisible: false,
} as const;

/** The product line. Used on the login screen and in store listings. */
export const TAGLINE = 'Every shift tracked. Every check logged.';
