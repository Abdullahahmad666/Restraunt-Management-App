/**
 * Getting a file off the phone and into a shape worth uploading.
 *
 * Three ways in, because that is how paperwork actually arrives: photographed
 * off the counter, already in the camera roll, or emailed over as a PDF.
 *
 * A PDF is passed through untouched. Re-encoding one could only make it worse,
 * and for an invoice it is the easiest thing a reader will ever see. Photos are
 * resized and re-compressed first; see utils/media.ts for the profiles.
 *
 * Shared rather than owned by whichever feature needed it first: an invoice and
 * a hygiene certificate reach the app by exactly the same three routes, and two
 * copies of this would drift in the permission handling, which is the part
 * nobody tests by hand twice.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import {
  compressImage,
  mimeTypeForUri,
  type CompressionProfile,
  type PreparedFile,
} from '../../utils/media';

export type CaptureSource = 'camera' | 'library' | 'document';

export class PermissionDenied extends Error {
  constructor(public readonly source: CaptureSource) {
    super('permission denied');
  }
}

/** The file types the server will accept. Kept in step with
 * apps.common.files.SUPPORTED_TYPES. */
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

type Options = {
  /** How hard to squeeze a photograph. */
  profile: CompressionProfile;
  /** What to call the result. Only ever cosmetic - the server generates its
   * own storage key - but it is what a picker shows and what an extension is
   * read from if anything ever has to guess. */
  name: string;
};

async function fromCamera({profile, name}: Options): Promise<PreparedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new PermissionDenied('camera');
  }

  // quality: 1 here, then compressed deliberately below. Letting the picker
  // compress would apply its own settings on top of ours, and two lossy passes
  // cost detail that small print cannot spare.
  const result = await ImagePicker.launchCameraAsync({quality: 1});
  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return compressImage(asset.uri, profile, {
    width: asset.width,
    height: asset.height,
    name,
  });
}

async function fromLibrary({profile, name}: Options): Promise<PreparedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new PermissionDenied('library');
  }

  const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 1});
  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return compressImage(asset.uri, profile, {
    width: asset.width,
    height: asset.height,
    name,
  });
}

async function fromDocuments({profile, name}: Options): Promise<PreparedFile | null> {
  // No permission prompt: the document picker hands back only what the user
  // explicitly chose.
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_DOCUMENT_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? mimeTypeForUri(asset.uri);

  if (mimeType === 'application/pdf') {
    return {uri: asset.uri, mimeType, name: asset.name || name.replace(/\.jpg$/, '.pdf')};
  }

  // An image that happened to arrive through the file picker still benefits
  // from being shrunk. Its dimensions are unknown here, so compressImage
  // re-encodes without resizing rather than guessing.
  return compressImage(asset.uri, profile, {name: asset.name || name});
}

/** Returns the chosen file ready to upload, or null if the user backed out. */
export function captureFile(source: CaptureSource, options: Options): Promise<PreparedFile | null> {
  switch (source) {
    case 'camera':
      return fromCamera(options);
    case 'library':
      return fromLibrary(options);
    case 'document':
      return fromDocuments(options);
  }
}

export function describePermissionDenied(source: CaptureSource): string {
  return source === 'camera'
    ? 'Camera access is off for Invisiko.'
    : 'Photo access is off for Invisiko.';
}
