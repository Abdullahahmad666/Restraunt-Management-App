import React, {useState} from 'react';
import {ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {describeApiError} from '../../../api/errors';
import {AVATAR, compressImage} from '../../../utils/media';
import {ConfirmDialog} from '../../../components/ConfirmDialog';
import {FadeIn} from '../../../components/FadeIn';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {OptionSheet} from '../../../components/OptionSheet';
import {PressableScale} from '../../../components/PressableScale';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {updateProfile, uploadAvatar} from '../../../features/auth/api';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing, typography} from '../../../theme';
import {ROLES} from '../../../types/roles';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function initialsOf(first: string, last: string, email: string): string {
  const fromName = `${first.trim()[0] ?? ''}${last.trim()[0] ?? ''}`.trim();
  return (fromName || email.trim()[0] || '?').toUpperCase();
}

/**
 * One fact, as a label over its value rather than the two on one line.
 *
 * A label left and a value right reads like a receipt, and it breaks down
 * exactly where it matters most: a long email pushed against a right edge
 * wraps into an unreadable column. Stacked, every value gets the full width
 * and the eye has one left edge to follow down the card.
 */
function Detail({
  icon,
  label,
  value,
  muted = false,
  tag,
}: {
  icon: IconName;
  label: string;
  value: string;
  /** For "Not set" and the like - present, but not pretending to be data. */
  muted?: boolean;
  tag?: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <View style={styles.detailValueRow}>
          <Text style={[styles.detailValue, muted && styles.detailValueMuted]} selectable>
            {value}
          </Text>
          {tag}
        </View>
      </View>
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/** A hairline between rows, inset past the icon so it reads as a list rather
 * than a stack of separate boxes. */
function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

export function ProfileScreen(): React.JSX.Element {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const signOut = useAuthStore(state => state.signOut);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [settingsPrompt, setSettingsPrompt] = useState<string | null>(null);

  // The navigator only mounts this behind a session, so a null user means the
  // session was torn down mid-render. The navigator is already swapping this
  // screen out; render nothing rather than crash.
  if (!user) {
    return <View style={styles.screen} />;
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const isAdmin = user.role === ROLES.ADMIN;
  // "Manager", not "Admin" - it is the word the welcome screen asks people to
  // pick themselves, and the one every other sentence in the app uses.
  const roleName = isAdmin ? 'Manager' : 'Staff';

  function startEditing() {
    setFirstName(user!.first_name);
    setLastName(user!.last_name);
    setPhone(user!.phone);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      setUser(
        await updateProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        }),
      );
      setEditing(false);
    } catch (err) {
      setError(describeApiError(err, 'Could not save your details.'));
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setPhotoSheet(false);
    setError(null);
    setSettingsPrompt(null);

    // Permission is requested at the moment of use rather than on mount: a
    // prompt that appears before anyone asked for the camera is the one people
    // deny out of hand, and denials are sticky.
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      // Telling someone to visit Settings without taking them there is a dead
      // end - especially once the OS has stopped asking, when there is no
      // other route back.
      const what = source === 'camera' ? 'Camera' : 'Photo';
      setError(`${what} access is off for Invisiko.`);
      setSettingsPrompt(
        source === 'camera'
          ? 'Turn on camera access to take a profile photo.'
          : 'Turn on photo access to choose a profile photo.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      // Left uncompressed here and squeezed deliberately below - two lossy
      // passes with different settings is worse than one we control.
      quality: 1,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setUploading(true);
    try {
      const asset = result.assets[0];
      // Avatars render small. A full-resolution upload is slow on a kitchen's
      // wifi and gains nothing anyone can see.
      const prepared = await compressImage(asset.uri, AVATAR, {
        width: asset.width,
        height: asset.height,
        name: 'avatar.jpg',
      });
      setUser(await uploadAvatar(prepared.uri));
    } catch (err) {
      setError(describeApiError(err, 'Could not upload that photo.'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <FadeIn style={styles.identity}>
        <PressableScale
          onPress={() => setPhotoSheet(true)}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          accessibilityState={{busy: uploading}}
          style={styles.avatarWrap}>
          {/* A ring set off the photo rather than drawn on it, so a portrait
              is not cropped by its own border. */}
          <View style={styles.avatarRing}>
            {user.profile_picture ? (
              <Image source={{uri: user.profile_picture}} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initialsOf(user.first_name, user.last_name, user.email)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cameraBadge}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="camera" size={15} color={colors.onPrimary} />
            )}
          </View>
        </PressableScale>

        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName || user.email}
          </Text>
          {fullName ? (
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>

        <View style={styles.badge}>
          <Ionicons
            name={isAdmin ? 'shield-checkmark' : 'person'}
            size={12}
            color={colors.primary}
          />
          <Text style={styles.badgeText}>{roleName}</Text>
          {user.restaurant_name ? (
            <>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText} numberOfLines={1}>
                {user.restaurant_name}
              </Text>
            </>
          ) : null}
        </View>
      </FadeIn>

      <FormError message={error} />

      {settingsPrompt ? (
        <View style={styles.settingsBox}>
          <Text style={styles.settingsText}>{settingsPrompt}</Text>
          <PrimaryButton
            label="Open Settings"
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        </View>
      ) : null}

      <FadeIn delay={80}>
        <Section
          title="Your details"
          action={
            !editing ? (
              <PressableScale
                onPress={startEditing}
                accessibilityRole="button"
                style={styles.editButton}>
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={styles.editText}>Edit</Text>
              </PressableScale>
            ) : null
          }>
          {editing ? (
            <View style={styles.form}>
              <Field
                label="First name"
                placeholder="Alex"
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
                editable={!saving}
              />
              <Field
                label="Last name"
                placeholder="Morgan"
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
                editable={!saving}
              />
              <Field
                label="Phone"
                placeholder="+44 7700 900123"
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
                editable={!saving}
                hint="Used when a manager needs to reach you about a shift."
              />

              <View style={styles.formActions}>
                <PrimaryButton label="Save" onPress={save} loading={saving} />
                <PrimaryButton
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setEditing(false)}
                  disabled={saving}
                />
              </View>
            </View>
          ) : (
            <>
              <Detail
                icon="person-outline"
                label="Name"
                value={fullName || 'Not set'}
                muted={!fullName}
              />
              <Divider />
              <Detail
                icon="call-outline"
                label="Phone"
                value={user.phone || 'Not set'}
                muted={!user.phone}
              />
              <Divider />
              {/* Email is last of the three because it is the one nobody can
                  change here - it signs you in. */}
              <Detail icon="mail-outline" label="Email" value={user.email} />
            </>
          )}
        </Section>
      </FadeIn>

      <FadeIn delay={140}>
        <Section title="Workplace">
          <Detail
            icon="business-outline"
            label="Restaurant"
            value={user.restaurant_name ?? 'Not assigned yet'}
            muted={!user.restaurant_name}
            tag={
              user.restaurant && user.restaurant_is_approved === false ? (
                <View style={styles.pendingTag}>
                  <Text style={styles.pendingText}>Awaiting review</Text>
                </View>
              ) : null
            }
          />
          <Divider />
          <Detail
            icon={isAdmin ? 'shield-checkmark-outline' : 'people-outline'}
            label="Role"
            value={
              isAdmin
                ? 'Manager - can edit the rota, payroll and compliance'
                : 'Staff - check in, log checks and see your own hours'
            }
          />
        </Section>
      </FadeIn>

      {!user.restaurant ? (
        <View style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.warningText}>
            Your account is not attached to a restaurant yet, so your screens will be empty. Ask
            your manager to add you - an invite code is only read while an account is being created,
            so a new one will not fix this account.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Sign out"
          variant="danger"
          onPress={() => setSignOutOpen(true)}
          disabled={signingOut}
        />
      </View>

      <OptionSheet
        visible={photoSheet}
        title="Profile photo"
        options={[
          {
            label: 'Take a photo',
            hint: 'Opens the camera',
            icon: 'camera-outline',
            onPress: () => pickPhoto('camera'),
          },
          {
            label: 'Choose from library',
            hint: 'Pick one you already have',
            icon: 'images-outline',
            onPress: () => pickPhoto('library'),
          },
        ]}
        onCancel={() => setPhotoSheet(false)}
      />

      <ConfirmDialog
        visible={signOutOpen}
        title="Sign out?"
        message="You will need your email and password to sign back in."
        confirmLabel="Sign out"
        destructive
        busy={signingOut}
        onConfirm={async () => {
          setSigningOut(true);
          // No cleanup: signOut flips the navigator and this screen unmounts,
          // so setting state afterwards would warn.
          await signOut();
        }}
        onCancel={() => setSignOutOpen(false)}
      />
    </ScrollView>
  );
}

const AVATAR_SIZE = 104;
const RING = 3;

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl},

  identity: {alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm},
  avatarWrap: {width: AVATAR_SIZE, height: AVATAR_SIZE},
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.pill,
    padding: RING,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {flex: 1, borderRadius: radii.pill},
  avatarText: {...typography.title, color: colors.primary},
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    // Against the page, not the avatar - the gap is what stops it reading as
    // a hole punched in the photo.
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {alignItems: 'center', gap: 2},
  name: {...typography.title, fontSize: 24, color: colors.text},
  email: {...typography.caption, color: colors.textMuted},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  badgeText: {...typography.caption, fontWeight: '700', color: colors.text, flexShrink: 1},
  badgeDot: {width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textMuted},

  section: {gap: spacing.sm},
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editButton: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  editText: {...typography.caption, color: colors.primary, fontWeight: '700'},

  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {flex: 1, gap: 3},
  detailLabel: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  detailValueRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap'},
  detailValue: {...typography.body, fontSize: 15, color: colors.text, flexShrink: 1},
  detailValueMuted: {color: colors.textMuted, fontStyle: 'italic'},
  divider: {height: 1, backgroundColor: colors.border, marginLeft: 34 + spacing.md},

  pendingTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingText: {fontSize: 11, fontWeight: '700', color: colors.warning},

  form: {gap: spacing.sm, paddingVertical: spacing.sm},
  formActions: {gap: spacing.sm, marginTop: spacing.sm},

  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  warningText: {...typography.caption, color: colors.textMuted, flex: 1},
  actions: {marginTop: spacing.sm},
  settingsBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingsText: {...typography.caption, color: colors.textMuted},
});
