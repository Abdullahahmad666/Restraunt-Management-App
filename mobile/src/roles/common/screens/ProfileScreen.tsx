import React, {useState} from 'react';
import {Image, Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {describeApiError} from '../../../api/errors';
import {ConfirmDialog} from '../../../components/ConfirmDialog';
import {Field} from '../../../components/Field';
import {FormError} from '../../../components/FormError';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {updateProfile, uploadAvatar} from '../../../features/auth/api';
import {useAuthStore} from '../../../store/authStore';
import {colors, radii, spacing, typography} from '../../../theme';
import {ROLES} from '../../../types/roles';

function initialsOf(first: string, last: string, email: string): string {
  const fromName = `${first.trim()[0] ?? ''}${last.trim()[0] ?? ''}`.trim();
  return (fromName || email.trim()[0] || '?').toUpperCase();
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
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
      // Avatars render small. A full-resolution upload is slow on a kitchen's
      // wifi and gains nothing anyone can see.
      quality: 0.7,
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
      setUser(await uploadAvatar(result.assets[0].uri));
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
      <View style={styles.identity}>
        <Pressable
          onPress={() => setPhotoSheet(true)}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={styles.avatarWrap}>
          {user.profile_picture ? (
            <Image source={{uri: user.profile_picture}} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initialsOf(user.first_name, user.last_name, user.email)}
              </Text>
            </View>
          )}

          <View style={styles.cameraBadge}>
            <Ionicons
              name={uploading ? 'ellipsis-horizontal' : 'camera'}
              size={16}
              color={colors.onPrimary}
            />
          </View>
        </Pressable>

        <Text style={styles.name}>{fullName || user.email}</Text>

        <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeStaff]}>
          <Ionicons
            name={isAdmin ? 'shield-checkmark' : 'person'}
            size={12}
            color={isAdmin ? colors.onPrimary : colors.textMuted}
          />
          <Text style={[styles.badgeText, isAdmin && styles.badgeTextAdmin]}>
            {isAdmin ? 'Admin' : 'Staff'}
          </Text>
        </View>
      </View>

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

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Your details</Text>
          {!editing ? (
            <Pressable onPress={startEditing} hitSlop={8} style={styles.editButton}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

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
                variant="secondary"
                onPress={() => setEditing(false)}
                disabled={saving}
              />
            </View>
          </View>
        ) : (
          <>
            <Row icon="mail-outline" label="Email" value={user.email} />
            <Row icon="person-outline" label="Name" value={fullName || 'Not set'} />
            <Row icon="call-outline" label="Phone" value={user.phone || 'Not set'} />
            <Row
              icon="business-outline"
              label="Restaurant"
              value={user.restaurant ? 'Assigned' : 'Not assigned yet'}
            />
          </>
        )}
      </View>

      {!user.restaurant ? (
        <View style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.warningText}>
            Your account is not attached to a restaurant yet, so your screens will be empty. Ask an
            admin for an invite code, or to add you to the team.
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

      <ConfirmDialog
        visible={photoSheet}
        title="Profile photo"
        message="Take a new photo, or choose one you already have."
        confirmLabel="Take a photo"
        cancelLabel="Choose from library"
        onConfirm={() => pickPhoto('camera')}
        onCancel={() => pickPhoto('library')}
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

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.lg},
  identity: {alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md},
  avatarWrap: {width: 96, height: 96},
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: {...typography.title, color: colors.primary},
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {...typography.heading, color: colors.text},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  badgeStaff: {borderColor: colors.border, backgroundColor: colors.surface},
  badgeAdmin: {borderColor: colors.primary, backgroundColor: colors.primary},
  badgeText: {...typography.caption, fontWeight: '700', color: colors.textMuted},
  badgeTextAdmin: {color: colors.onPrimary},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editButton: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  editText: {...typography.caption, color: colors.primary, fontWeight: '700'},
  form: {gap: spacing.sm},
  formActions: {gap: spacing.sm, marginTop: spacing.sm},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowIcon: {width: 18},
  rowLabel: {...typography.body, color: colors.textMuted, flex: 1},
  rowValue: {...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right'},
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
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingsText: {...typography.caption, color: colors.textMuted},
});
