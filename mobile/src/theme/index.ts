import {DarkTheme, type Theme} from '@react-navigation/native';

/**
 * Invisiko's dark theme: black and white, with amber kept as the one accent.
 *
 * `background` is also what the native launch assets are set to - the splash
 * screen and the Android adaptive icon read their colour from app.json, and
 * the iOS icon has it painted in. They were left on the logo's old navy for a
 * while, which made a cold launch flash navy and then turn black. Change
 * `brand.black` and those three have to change with it, or the flash comes
 * back.
 *
 * The app is dark-only. `userInterfaceStyle` is pinned to "dark" in app.json,
 * so there is no light variant to keep in step. If a light theme is ever
 * wanted, add a sibling palette and select between them here rather than
 * scattering conditionals through the screens.
 */

export const brand = {
  /** True black ground, not the old navy - see the note above. */
  black: '#0B0B0D',
  amber: '#FE9A02',
  white: '#FFFFFF',
} as const;

export const colors = {
  // Surfaces, darkest first. Each step is a lift in lightness only - no hue
  // creeps in, which is what keeps this reading as black-and-white rather
  // than "dark grey with a tint."
  background: brand.black,
  surface: '#1A1A1D',
  surfaceRaised: '#242427',
  border: '#333336',

  // Text. `textMuted` still clears 4.5:1 on `background`, so it is safe for
  // body copy and not just decoration.
  text: brand.white,
  textMuted: '#A6A6AC',

  // Actions. Amber is the one colour in an otherwise monochrome app, so it
  // has to stay rare - anything sitting on it needs dark ink.
  primary: brand.amber,
  primaryPressed: '#D98202',
  primaryDisabled: '#6B4A12',
  onPrimary: brand.black,

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
 * Only the header is configured here. The bar itself is drawn by
 * navigation/FloatingTabBar, which reads its colours from this file directly -
 * tabBarStyle and the tint colours would be settings nothing looks at.
 */
export const tabScreenOptions = {
  headerStyle: {backgroundColor: colors.background},
  headerTintColor: colors.text,
  headerShadowVisible: false,
} as const;

/** Size every tab glyph is drawn at. */
export const TAB_ICON_SIZE = 22;

/**
 * The product line. Used on the login screen and in store listings.
 *
 * Not "an attendance app" - staff, cost and compliance are three separate
 * screens today (Attendance, Payroll, Compliance) and the tagline should
 * read that way rather than describing only the first one built.
 */
export const TAGLINE = 'Staff, cost and compliance - sorted.';
