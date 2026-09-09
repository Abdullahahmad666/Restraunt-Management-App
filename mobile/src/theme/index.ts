import {DarkTheme, type Theme} from '@react-navigation/native';

/**
 * Invisiko's dark theme: black and white, with amber kept as the one accent.
 *
 * This used to sit on the logo's navy badge exactly, so launch had no colour
 * shift - the splash screen simply became the app. It no longer does: the
 * splash screen and app icon backgrounds are separate native assets
 * (app.json's "backgroundColor"/"primaryColor", still #08172B) that were not
 * part of this pass. Changing those is an asset job, not a token edit, so
 * until they're redrawn to match, a cold launch will show a brief navy-to-
 * black handoff.
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
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarLabelStyle: {fontSize: 11, fontWeight: '600' as const},
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
