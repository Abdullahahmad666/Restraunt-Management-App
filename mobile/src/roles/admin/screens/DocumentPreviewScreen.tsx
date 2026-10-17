import React, {useState} from 'react';
import {Image, Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Ionicons} from '@expo/vector-icons';

import {Card} from '../../../components/Card';
import {ConfirmDialog} from '../../../components/ConfirmDialog';
import {ErrorState} from '../../../components/ErrorState';
import {ImageViewer} from '../../../components/ImageViewer';
import {LoadingView} from '../../../components/LoadingView';
import {OptionalDateField} from '../../../components/OptionalDateField';
import {PickerRow} from '../../../components/PickerRow';
import {PickerSheet} from '../../../components/PickerSheet';
import {PressableScale} from '../../../components/PressableScale';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {describeApiError} from '../../../api/errors';
import {describeExpiry, expiryStatus} from '../../../features/documents/expiry';
import {
  useDeleteDocument,
  useDocumentCategories,
  useDocuments,
  useUpdateDocument,
} from '../../../features/documents/hooks';
import type {NewDocument} from '../../../features/documents/types';
import {colors, radii, spacing, typography} from '../../../theme';
import {formatDateTime} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

/** "Filed under nothing", as a value a picker can hold. */
const NO_CATEGORY = '__none__';

type Route = RouteProp<AdminStackParamList, 'DocumentPreview'>;
type Nav = NativeStackNavigationProp<AdminStackParamList>;

/**
 * One document, big enough to read.
 *
 * This is the screen that justifies the feature: somebody official is standing
 * at the counter, and the answer to "can I see your food hygiene certificate"
 * is two taps away. So the picture fills the screen and everything else -
 * category, notes, who filed it - sits underneath where it can be scrolled to
 * rather than competing with it.
 *
 * A PDF is handed to the phone's own viewer. Rendering one in-app would mean
 * carrying a PDF engine for a page that is opened a handful of times a year,
 * and every phone already has a better one than we would ship.
 */
export function DocumentPreviewScreen(): React.JSX.Element {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const documents = useDocuments();
  const remove = useDeleteDocument();

  const categories = useDocumentCategories();
  const update = useUpdateDocument();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (documents.isLoading) {
    return <LoadingView />;
  }

  const document = documents.data?.results.find(row => row.id === params.documentId);

  if (documents.error || !document) {
    return (
      <ErrorState
        message={describeApiError(documents.error, 'That document could not be found.')}
        onRetry={() => documents.refetch()}
      />
    );
  }

  const status = expiryStatus(document.expires_on);
  const categoryList = (categories.data?.results ?? []).filter(row => row.is_active);

  async function onChange(input: Partial<NewDocument>) {
    setError(null);
    try {
      await update.mutateAsync({id: params.documentId, input});
    } catch (err) {
      setError(describeApiError(err, 'Could not update that document.'));
    }
  }

  async function onDelete() {
    setError(null);
    try {
      await remove.mutateAsync(params.documentId);
      navigation.goBack();
    } catch (err) {
      setError(describeApiError(err, 'Could not remove that document.'));
      setConfirmingDelete(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {document.is_image ? (
        <PressableScale
          onPress={() => setViewing(true)}
          accessibilityRole="button"
          accessibilityLabel={`${document.title}. Open full screen`}>
          <Image
            source={{uri: document.file}}
            style={styles.image}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.zoomBadge}>
            <Ionicons name="scan-outline" size={14} color={colors.text} />
            <Text style={styles.zoomLabel}>Tap to zoom</Text>
          </View>
        </PressableScale>
      ) : (
        <View style={styles.pdf}>
          <Ionicons name="document-text" size={48} color={colors.primary} />
          <Text style={styles.pdfLabel}>PDF document</Text>
          <Text style={styles.pdfHint}>Opens in your phone&apos;s own viewer.</Text>
        </View>
      )}

      <Text style={styles.title}>{document.title}</Text>

      {/* Editable, because the moment of filing is the moment somebody is
          holding a phone over a certificate and is least likely to be thinking
          about where it belongs. Getting it wrong then should not mean
          deleting it and photographing it again. */}
      <PickerRow
        icon={document.category ? 'pricetag' : 'pricetag-outline'}
        tone={document.category ? 'done' : 'pending'}
        title={document.category_name ?? 'No category'}
        hint="Category"
        actionLabel={document.category ? 'Change' : 'Choose'}
        onPress={() => setPickingCategory(true)}
        disabled={update.isPending}
      />

      <Card style={styles.details}>
        <OptionalDateField
          label="Expires on"
          value={document.expires_on}
          onChange={value => onChange({expires_on: value})}
          emptyLabel="Does not expire"
        />
        {document.expires_on && status !== 'valid' ? (
          <Detail
            label={status === 'expired' ? 'Expired' : 'Expiring'}
            value={describeExpiry(document.expires_on) ?? ''}
            tone={status === 'expired' ? 'danger' : 'warning'}
          />
        ) : null}
        <Detail label="Added" value={formatDateTime(document.created_at)} />
        {document.uploaded_by_name ? (
          <Detail label="Filed by" value={document.uploaded_by_name} />
        ) : null}
        {document.notes ? <Detail label="Notes" value={document.notes} /> : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {/* Only a PDF leaves the app. An image opens full screen in it,
            where a browser's address bar is not part of what an inspector
            sees. */}
        {document.is_image ? (
          <PrimaryButton label="View full screen" onPress={() => setViewing(true)} />
        ) : (
          <PrimaryButton
            label="Open in your phone's viewer"
            onPress={() => Linking.openURL(document.file)}
          />
        )}
        <PrimaryButton
          label="Remove"
          variant="danger"
          onPress={() => setConfirmingDelete(true)}
          disabled={remove.isPending}
        />
      </View>

      <ImageViewer
        visible={viewing && document.is_image}
        uri={document.file}
        title={document.title}
        onClose={() => setViewing(false)}
      />

      <PickerSheet
        visible={pickingCategory}
        title="File this under"
        searchPlaceholder="Search categories"
        choices={[
          {value: NO_CATEGORY, label: 'No category'},
          ...categoryList.map(row => ({value: row.id, label: row.name})),
        ]}
        selected={document.category ?? NO_CATEGORY}
        onSelect={value => onChange({category: value === NO_CATEGORY ? null : value})}
        onClose={() => setPickingCategory(false)}
      />

      <ConfirmDialog
        visible={confirmingDelete}
        title="Remove this document?"
        message="It will no longer be here if somebody asks to see it. The file itself is deleted."
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </ScrollView>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'warning';
}): React.JSX.Element {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          tone === 'danger' && styles.detailDanger,
          tone === 'warning' && styles.detailWarning,
        ]}
        selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl},
  // Tall, because the point is reading what is on it. `contain` rather than
  // `cover`: a certificate cropped to fill a box is a certificate with its
  // registration number off the edge.
  image: {
    width: '100%',
    height: 420,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  pdf: {
    height: 220,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pdfLabel: {...typography.body, fontWeight: '700', color: colors.text},
  pdfHint: {...typography.caption, color: colors.textMuted},
  title: {...typography.title, fontSize: 22, color: colors.text},
  details: {gap: spacing.sm},
  detail: {gap: 2},
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  detailValue: {...typography.body, fontSize: 15, color: colors.text},
  detailDanger: {color: colors.danger, fontWeight: '700'},
  detailWarning: {color: colors.warning, fontWeight: '700'},
  zoomBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(11, 11, 13, 0.75)',
  },
  zoomLabel: {fontSize: 11, fontWeight: '600', color: colors.text},
  error: {fontSize: 12, color: colors.danger},
  actions: {gap: spacing.sm},
});
