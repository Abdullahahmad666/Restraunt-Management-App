/**
 * Shrinking a picture before it leaves the phone.
 *
 * A modern phone camera produces 3-6MB per shot. Sent as-is that is a slow
 * upload on restaurant wifi, storage we pay for, and - for invoices - a bigger
 * payload for the reader with nothing gained.
 *
 * How hard to squeeze depends entirely on what the picture is for, which is
 * why this exports profiles rather than one function. An avatar is never
 * looked at closely; an invoice is read character by character, and squeezing
 * it the same way turns "1.25" into something no reader can recover. The cost
 * of over-compressing an invoice is not a blurry picture, it is a human
 * retyping the line.
 */
import {ImageManipulator, SaveFormat} from 'expo-image-manipulator';

export type CompressionProfile = {
  /** Longest edge, in pixels. Smaller images are left at their own size. */
  maxDimension: number;
  /** 0-1, passed to the encoder. */
  quality: number;
};

/** Faces in a small circle. Nobody zooms in, so this can be aggressive. */
export const AVATAR: CompressionProfile = {maxDimension: 512, quality: 0.7};

/**
 * Evidence that a fridge exists and looks like its label - it gets looked at,
 * but nothing is read off it.
 */
export const EQUIPMENT_PHOTO: CompressionProfile = {maxDimension: 1024, quality: 0.8};

/**
 * Text that a vision model has to read digit by digit.
 *
 * 1568px is the ceiling that matters: the reader downsamples anything larger,
 * so a 4000px photo spends upload time and storage delivering detail that is
 * discarded before it is read. Below that line every pixel counts, hence the
 * high quality - this is the one profile where saving a few hundred KB is a
 * false economy paid back in someone retyping a line.
 */
export const INVOICE: CompressionProfile = {maxDimension: 1568, quality: 0.85};

export type PreparedFile = {
  uri: string;
  mimeType: string;
  name: string;
};

type CompressOptions = {
  /** Source dimensions, when the caller knows them - every picker reports
   * them. Without them the image is re-encoded but not resized, because
   * resizing blind is how you end up enlarging a thumbnail. */
  width?: number;
  height?: number;
  name?: string;
};

/**
 * Resize and re-encode `uri` to JPEG under `profile`.
 *
 * Returns the original untouched if anything goes wrong. A failure here means
 * a bigger upload, not a lost invoice, and refusing to upload because the
 * resizer stumbled would be a far worse trade.
 */
export async function compressImage(
  uri: string,
  profile: CompressionProfile,
  {width, height, name = 'upload.jpg'}: CompressOptions = {},
): Promise<PreparedFile> {
  try {
    const context = ImageManipulator.manipulate(uri);

    const longestEdge = Math.max(width ?? 0, height ?? 0);
    if (longestEdge > profile.maxDimension) {
      // Constrain the long edge and let the other follow, so nothing is
      // stretched. Passing both dimensions would distort anything whose aspect
      // ratio we guessed wrong.
      const isLandscape = (width ?? 0) >= (height ?? 0);
      context.resize(isLandscape ? {width: profile.maxDimension} : {height: profile.maxDimension});
    }

    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: profile.quality,
      format: SaveFormat.JPEG,
    });

    return {uri: result.uri, mimeType: 'image/jpeg', name};
  } catch {
    return {uri, mimeType: mimeTypeForUri(uri), name};
  }
}

/** Best guess at a file's type from its extension, for the upload's form part. */
export function mimeTypeForUri(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}
