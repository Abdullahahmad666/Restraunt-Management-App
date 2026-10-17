import React, {useState} from 'react';
import {ActivityIndicator, Image, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Ionicons} from '@expo/vector-icons';

import {Card} from '../../../components/Card';
import {EmptyState} from '../../../components/EmptyState';
import {ErrorState} from '../../../components/ErrorState';
import {FadeIn} from '../../../components/FadeIn';
import {FilterChip} from '../../../components/FilterChip';
import {LoadingView} from '../../../components/LoadingView';
import {PickerSheet} from '../../../components/PickerSheet';
import {PressableScale} from '../../../components/PressableScale';
import {PromptDialog} from '../../../components/PromptDialog';
import {Screen} from '../../../components/Screen';
import {describeApiError} from '../../../api/errors';
import {
  captureFile,
  describePermissionDenied,
  PermissionDenied,
  type CaptureSource,
} from '../../../features/files/capture';
import {
  useCreateCategory,
  useDocumentCategories,
  useDocuments,
  useUploadDocument,
} from '../../../features/documents/hooks';
import type {ComplianceDocument} from '../../../features/documents/types';
import {DOCUMENT, type PreparedFile} from '../../../utils/media';
import {colors, radii, spacing} from '../../../theme';
import {formatDate} from '../../../utils/format';
import type {AdminStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SOURCES: {source: CaptureSource; label: string; icon: IconName}[] = [
  {source: 'camera', label: 'Take photo', icon: 'camera-outline'},
  {source: 'library', label: 'From gallery', icon: 'images-outline'},
  {source: 'document', label: 'Upload a PDF', icon: 'document-text-outline'},
];

/** Everything, as a filter value. A picker needs something behind every row,
 * and an id no restaurant can own is cheaper than making the sheet nullable. */
const ALL = '__all__';

/**
 * One document, as a card you can see at a glance.
 *
 * A photograph shows itself. A PDF cannot, so it gets a mark instead of a
 * blank square - the point of this screen is handing a phone to somebody and
 * having them find the right certificate without being talked through it.
 */
function DocumentCard({
  document,
  onPress,
}: {
  document: ComplianceDocument;
  onPress: () => void;
}): React.JSX.Element {
  const expired =
    document.expires_on !== null &&
    new Date(document.expires_on) < new Date(new Date().toDateString());

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${document.title}. Open`}
      style={styles.cardWrap}>
      <Card style={styles.card}>
        <View style={styles.thumb}>
          {document.is_image ? (
            <Image source={{uri: document.file}} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Ionicons name="document-text" size={28} color={colors.primary} />
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {document.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {document.category_name ?? 'Uncategorised'}
        </Text>
        {document.expires_on ? (
          <Text style={[styles.cardExpiry, expired && styles.cardExpired]} numberOfLines={1}>
            {expired ? 'Expired ' : 'Valid to '}
            {formatDate(document.expires_on)}
          </Text>
        ) : null}
      </Card>
    </PressableScale>
  );
}

/**
 * The restaurant's paperwork: licences, certificates, insurance.
 *
 * Built to be opened in front of somebody rather than browsed. The categories
 * are the restaurant's own words, in the restaurant's own order, because an
 * inspector asks for things in theirs - and the first tap after "can I see
 * your..." should land on the right shelf.
 */
export function DocumentsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const categories = useDocumentCategories();
  const [category, setCategory] = useState<string | undefined>();
  const documents = useDocuments(category);
  const upload = useUploadDocument();
  const createCategory = useCreateCategory();

  const [picking, setPicking] = useState(false);
  const [pendingFile, setPendingFile] = useState<PreparedFile | null>(null);
  const [busySource, setBusySource] = useState<CaptureSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryList = (categories.data?.results ?? []).filter(row => row.is_active);
  const documentList = documents.data?.results ?? [];

  async function onPick(source: CaptureSource) {
    setError(null);
    setBusySource(source);
    try {
      const file = await captureFile(source, {profile: DOCUMENT, name: 'document.jpg'});
      if (file) {
        setPendingFile(file);
      }
    } catch (err) {
      if (err instanceof PermissionDenied) {
        setError(describePermissionDenied(err.source));
      } else {
        setError(describeApiError(err, 'Could not open that file.'));
      }
    } finally {
      setBusySource(null);
    }
  }

  async function onSave(title: string) {
    if (!pendingFile) {
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync({
        file: pendingFile,
        // Filed under whatever is being viewed: somebody who filtered to
        // "Licences" and then photographed one means it to go there.
        details: {title, category: category ?? null},
      });
      setPendingFile(null);
    } catch (err) {
      setError(describeApiError(err, 'Could not save that document.'));
    }
  }

  if (categories.isLoading || documents.isLoading) {
    return <LoadingView />;
  }
  if (categories.error || documents.error) {
    return (
      <ErrorState
        message={describeApiError(
          categories.error ?? documents.error,
          'Could not load your documents.',
        )}
        onRetry={() => {
          categories.refetch();
          documents.refetch();
        }}
      />
    );
  }

  return (
    <Screen
      onRefresh={() => {
        categories.refetch();
        documents.refetch();
      }}
      refreshing={categories.isRefetching || documents.isRefetching}>
      <Text style={styles.intro}>
        Licences, certificates and insurance - whatever has to be produced on request. Only you can
        see these.
      </Text>

      {categoryList.length > 0 ? (
        <View style={styles.filters}>
          <FilterChip label="All" selected={!category} onPress={() => setCategory(undefined)} />
          {categoryList.map(row => (
            <FilterChip
              key={row.id}
              label={`${row.name} (${row.document_count})`}
              selected={category === row.id}
              onPress={() => setCategory(category === row.id ? undefined : row.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.addRow}>
        {SOURCES.map(option => (
          <PressableScale
            key={option.source}
            onPress={() => onPick(option.source)}
            disabled={busySource !== null}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            style={[styles.addTile, busySource === option.source && styles.addTileBusy]}>
            {busySource === option.source ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name={option.icon} size={20} color={colors.primary} />
            )}
            <Text style={styles.addLabel} numberOfLines={2}>
              {option.label}
            </Text>
          </PressableScale>
        ))}
      </View>

      <PressableScale
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        style={styles.categoryLink}>
        <Ionicons name="pricetags-outline" size={14} color={colors.primary} />
        <Text style={styles.categoryLinkLabel}>
          {category
            ? `Filing under ${categoryList.find(row => row.id === category)?.name}`
            : 'Choose a category'}
        </Text>
      </PressableScale>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {documentList.length === 0 ? (
        <EmptyState
          title="Nothing filed yet"
          body="Photograph a certificate or upload a PDF, and it will be here the next time somebody asks for it."
        />
      ) : (
        <View style={styles.grid}>
          {documentList.map((document, index) => (
            <FadeIn key={document.id} delay={index * 40} style={styles.gridCell}>
              <DocumentCard
                document={document}
                onPress={() => navigation.navigate('DocumentPreview', {documentId: document.id})}
              />
            </FadeIn>
          ))}
        </View>
      )}

      <PickerSheet
        visible={picking}
        title="File under"
        searchPlaceholder="Search categories"
        choices={[
          {value: ALL, label: 'No category'},
          ...categoryList.map(row => ({
            value: row.id,
            label: row.name,
            hint: `${row.document_count} document${row.document_count === 1 ? '' : 's'}`,
          })),
        ]}
        selected={category ?? ALL}
        emptyLabel="No category by that name yet - add it below."
        create={{
          nameFor: query => query.trim() || null,
          label: name => `Add "${name}" as a category`,
          onCreate: async name => {
            const created = await createCategory.mutateAsync(name);
            setCategory(created.id);
          },
          busy: createCategory.isPending,
        }}
        onSelect={value => setCategory(value === ALL ? undefined : value)}
        onClose={() => setPicking(false)}
      />

      {/* Named after choosing the file and before it is sent. A certificate
          called "document.jpg" is one nobody can find later, and the moment
          somebody knows what it is, is while they are looking at it. */}
      <PromptDialog
        visible={pendingFile !== null}
        title="Name this document"
        message="What would you call it if somebody asked to see it?"
        label="Title"
        placeholder="e.g. Food hygiene certificate"
        confirmLabel="Save document"
        busy={upload.isPending}
        onConfirm={onSave}
        onCancel={() => setPendingFile(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {fontSize: 13, color: colors.textMuted, lineHeight: 18},
  filters: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  addRow: {flexDirection: 'row', gap: spacing.sm},
  addTile: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  addTileBusy: {borderColor: colors.primary},
  addLabel: {fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center'},
  categoryLink: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  categoryLinkLabel: {fontSize: 13, fontWeight: '600', color: colors.primary},
  error: {fontSize: 12, color: colors.danger},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  gridCell: {flexBasis: '47%', flexGrow: 1},
  cardWrap: {width: '100%'},
  card: {gap: spacing.xs},
  thumb: {
    height: 96,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {width: '100%', height: '100%'},
  cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
  cardMeta: {fontSize: 11, color: colors.textMuted},
  cardExpiry: {fontSize: 11, color: colors.textMuted},
  cardExpired: {color: colors.danger, fontWeight: '700'},
});
