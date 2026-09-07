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
  // Amber at low opacity: the ground behind an amber glyph in an IconBadge.
  // Solid amber behind every icon would turn a list of rows into a wall of
  // accent colour and leave nothing for the actual call to action.
  primarySoft: 'rgba(254, 154, 2, 0.14)',

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

/**
 * One type scale, used everywhere.
 *
 * The four entries this replaces covered so little that nine screens each
 * wrote their own heading instead - 18, 20, 22, 24 and 26pt, in two different
 * weights - and the app read as a set of unrelated pages rather than one
 * product. Sizes step deliberately here; if a screen wants something that is
 * not on the scale, the scale is wrong rather than the screen special.
 *
 * Every entry carries its own lineHeight. Leaving it to the platform is what
 * makes dense screens look cramped and headings look loose, and it differs
 * between iOS and Android, so the two never quite matched.
 */
export const typography = {
  /** Reserved for a screen's single hero number or the welcome headline. */
  display: {fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5},
  /** The title on an auth screen. */
  title: {fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4},
  /** What a screen opens with - see ScreenHeader. */
  heading: {fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3},
  /** A card title, or a section of a longer screen. */
  subheading: {fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2},
  body: {fontSize: 16, lineHeight: 22, fontWeight: '400'},
  /** Supporting copy under a heading, and list-row secondary text. */
  caption: {fontSize: 13, lineHeight: 18, fontWeight: '400'},
  /**
   * Small, upper-case, widely tracked - a section label above a group of
   * rows. The tracking is what stops it reading as shouted body text.
   */
  overline: {fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1},
} as const;

/**
 * Lift, for the few things that should sit above the page.
 *
 * A dark theme gets almost nothing from a black drop shadow, so depth here is
 * mostly the `surface` -> `surfaceRaised` step in the palette. These exist for
 * the cases where that is not enough on its own: the thumb of a segmented
 * control, a sheet over content. Used sparingly on purpose - shadows on every
 * card is exactly the look this is trying to avoid.
 */
export const elevation = {
  low: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
  medium: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
} as const;

/**
 * Glyph sizes. Named by role rather than number so an icon beside a label is
 * always the size that matches that label's type.
 */
export const iconSize = {
  /** Inline with caption text - a chevron, a small status mark. */
  sm: 16,
  /** Inline with body text, and the glyph inside a small IconBadge. */
  md: 20,
  /** The glyph inside a standard IconBadge. */
  lg: 24,
  /** A screen's empty state or permission prompt. */
  xl: 40,
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
