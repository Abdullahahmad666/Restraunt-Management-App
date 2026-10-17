import React, {useState} from 'react';
import {Image, Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Ionicons} from '@expo/vector-icons';

import {Card} from '../../../components/Card';
import {ConfirmDialog} from '../../../components/ConfirmDialog';
import {ErrorState} from '../../../components/ErrorState';
import {LoadingView} from '../../../components/LoadingView';
import {PrimaryButton} from '../../../components/PrimaryButton';
import {describeApiError} from '../../../api/errors';
import {describeExpiry, expiryStatus} from '../../../features/documents/expiry';
import {useDeleteDocument, useDocuments} from '../../../features/documents/hooks';
import {colors, radii, spacing, typography} from '../../../theme';
import {formatDate, formatDateTime} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

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

  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
        <Image
          source={{uri: document.file}}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={document.title}
        />
      ) : (
        <View style={styles.pdf}>
          <Ionicons name="document-text" size={48} color={colors.primary} />
          <Text style={styles.pdfLabel}>PDF document</Text>
          <Text style={styles.pdfHint}>Opens in your phone&apos;s own viewer.</Text>
        </View>
      )}

      <Text style={styles.title}>{document.title}</Text>

      <Card style={styles.details}>
        <Detail label="Category" value={document.category_name ?? 'Uncategorised'} />
        {document.expires_on ? (
          <Detail
            label={status === 'expired' ? 'Expired' : 'Valid until'}
            value={`${formatDate(document.expires_on)}${
              status === 'soon' ? ` - ${describeExpiry(document.expires_on)?.toLowerCase()}` : ''
            }`}
            tone={status === 'expired' ? 'danger' : status === 'soon' ? 'warning' : undefined}
          />
        ) : (
          <Detail label="Expires" value="Does not expire" />
        )}
        <Detail label="Added" value={formatDateTime(document.created_at)} />
        {document.uploaded_by_name ? (
          <Detail label="Filed by" value={document.uploaded_by_name} />
        ) : null}
        {document.notes ? <Detail label="Notes" value={document.notes} /> : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={document.is_image ? 'Open full size' : 'Open PDF'}
          onPress={() => Linking.openURL(document.file)}
        />
        <PrimaryButton
          label="Remove"
          variant="danger"
          onPress={() => setConfirmingDelete(true)}
          disabled={remove.isPending}
        />
      </View>

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
  error: {fontSize: 12, color: colors.danger},
  actions: {gap: spacing.sm},
});
