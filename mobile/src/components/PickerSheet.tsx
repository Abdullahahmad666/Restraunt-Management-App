import React, {useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {PressableScale} from './PressableScale';
import {colors, radii, spacing, typography} from '../theme';

export type PickerChoice = {
  value: string;
  label: string;
  /** A second line - a unit, a quantity on hand, whatever tells two similar
   * names apart. */
  hint?: string;
};

type Props = {
  visible: boolean;
  title: string;
  choices: PickerChoice[];
  /** The one currently picked, if any. It is pinned to the top so it stays
   * findable in a long list. */
  selected?: string | null;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /**
   * Adding something that is not in the list yet.
   *
   * `nameFor` turns what has been typed into the name that would be created,
   * or returns null when there is nothing to create - an empty box with no
   * fallback behind it. The sheet only offers the option when it comes back
   * with a name, so there is no way to tap "add" and be told to fill in a
   * field that is not on screen.
   */
  create?: {
    nameFor: (query: string) => string | null;
    label: (name: string) => string;
    onCreate: (name: string) => void;
    busy?: boolean;
  };
  onSelect: (value: string) => void;
  onClose: () => void;
};

/**
 * Pick one thing out of a list that may be long.
 *
 * The alternative this replaces is a wall of chips: fine for three warehouses,
 * unusable at fifty stock items, where finding the right one means reading
 * every wrong one. A list you can type into stays the same size whether a
 * restaurant stocks ten things or a thousand.
 *
 * Matching is a plain case-insensitive substring. Nothing cleverer, because
 * someone looking for "ketchup" types "ket", and a fuzzy match that also
 * returns "chicken stock" for that costs more trust than it earns.
 */
export function PickerSheet({
  visible,
  title,
  choices,
  selected,
  searchPlaceholder = 'Search',
  emptyLabel = 'Nothing matches that.',
  create,
  onSelect,
  onClose,
}: Props): React.JSX.Element {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? choices.filter(choice => choice.label.toLowerCase().includes(needle))
      : choices;
    if (!selected) {
      return matched;
    }
    // The current pick first, so changing your mind does not mean scrolling
    // for what you already chose.
    const current = matched.filter(choice => choice.value === selected);
    return [...current, ...matched.filter(choice => choice.value !== selected)];
  }, [choices, query, selected]);

  const newName = create?.nameFor(query) ?? null;

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={create ? `${searchPlaceholder}, or type a new name` : searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {results.length === 0 ? (
              <Text style={styles.empty}>{emptyLabel}</Text>
            ) : (
              results.map(choice => {
                const isSelected = choice.value === selected;
                return (
                  <PressableScale
                    key={choice.value}
                    onPress={() => {
                      onSelect(choice.value);
                      close();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{selected: isSelected}}
                    style={[styles.row, isSelected && styles.rowSelected]}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel} numberOfLines={1}>
                        {choice.label}
                      </Text>
                      {choice.hint ? <Text style={styles.rowHint}>{choice.hint}</Text> : null}
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </PressableScale>
                );
              })
            )}
          </ScrollView>

          {newName ? (
            <PressableScale
              onPress={() => {
                create?.onCreate(newName);
                close();
              }}
              disabled={create?.busy}
              accessibilityRole="button"
              style={[styles.create, create?.busy && styles.creating]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.createLabel} numberOfLines={1}>
                {create?.label(newName)}
              </Text>
            </PressableScale>
          ) : create ? (
            // Said where the button would be, rather than after tapping one.
            <Text style={styles.createHint}>Type a name above to add a new one.</Text>
          ) : null}

          <PressableScale onPress={close} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(3, 9, 18, 0.82)', justifyContent: 'flex-end'},
  sheet: {
    // Tall enough to show a handful of results without becoming the whole
    // screen - the line being matched stays visible above it.
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  title: {...typography.heading, color: colors.text},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  search: {flex: 1, paddingVertical: spacing.sm, color: colors.text, fontSize: 15},
  list: {flexGrow: 0},
  empty: {...typography.caption, color: colors.textMuted, paddingVertical: spacing.lg},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelected: {borderColor: colors.primary, backgroundColor: colors.surfaceRaised},
  rowText: {flex: 1, gap: 1},
  rowLabel: {...typography.body, color: colors.text},
  rowHint: {...typography.caption, color: colors.textMuted},
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  creating: {opacity: 0.5},
  createHint: {...typography.caption, color: colors.textMuted, textAlign: 'center'},
  createLabel: {...typography.body, fontWeight: '600', color: colors.primary, flexShrink: 1},
  cancel: {alignItems: 'center', paddingVertical: spacing.xs},
  cancelLabel: {...typography.body, fontWeight: '600', color: colors.textMuted},
});
