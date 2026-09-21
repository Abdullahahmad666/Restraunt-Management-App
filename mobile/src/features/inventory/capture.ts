/**
 * Getting an invoice off the phone and into a shape worth uploading.
 *
 * Three ways in, because that is how invoices actually arrive: photographed
 * off the counter, already in the camera roll, or emailed over as a PDF.
 *
 * A PDF is passed through untouched. It is already text rather than pixels -
 * the easiest thing the reader will ever see - and re-encoding it could only
 * make it worse. Photos are resized and re-compressed first; see
 * utils/media.ts for why invoices get their own profile.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import {compressImage, INVOICE, mimeTypeForUri, type PreparedFile} from '../../utils/media';

export type CaptureSource = 'camera' | 'library' | 'document';

export class PermissionDenied extends Error {
  constructor(public readonly source: CaptureSource) {
    super('permission denied');
  }
}

/** The file types the server will read. Kept in step with
 * apps.inventory.services.scanning.SUPPORTED_TYPES. */
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

async function fromCamera(): Promise<PreparedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new PermissionDenied('camera');
  }

  // quality: 1 here, then compressed deliberately below. Letting the picker
  // compress would apply its own settings on top of ours, and two lossy passes
  // over an invoice cost detail the reader needs.
  const result = await ImagePicker.launchCameraAsync({quality: 1});
  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return compressImage(asset.uri, INVOICE, {
    width: asset.width,
    height: asset.height,
    name: 'invoice.jpg',
  });
}

async function fromLibrary(): Promise<PreparedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new PermissionDenied('library');
  }

  const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 1});
  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return compressImage(asset.uri, INVOICE, {
    width: asset.width,
    height: asset.height,
    name: 'invoice.jpg',
  });
}

async function fromDocuments(): Promise<PreparedFile | null> {
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
    return {uri: asset.uri, mimeType, name: asset.name || 'invoice.pdf'};
  }

  // An image that happened to arrive through the file picker still benefits
  // from being shrunk. Its dimensions are unknown here, so compressImage
  // re-encodes without resizing rather than guessing.
  return compressImage(asset.uri, INVOICE, {name: asset.name || 'invoice.jpg'});
}

/** Returns the chosen file ready to upload, or null if the user backed out. */
export function captureInvoice(source: CaptureSource): Promise<PreparedFile | null> {
  switch (source) {
    case 'camera':
      return fromCamera();
    case 'library':
      return fromLibrary();
    case 'document':
      return fromDocuments();
  }
}

export function describePermissionDenied(source: CaptureSource): string {
  return source === 'camera'
    ? 'Camera access is off for Invisiko.'
    : 'Photo access is off for Invisiko.';
}
